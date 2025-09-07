import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, query, where, addDoc, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { format, isWeekend, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isSameMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  Calendar, 
  Check, 
  X, 
  AlertCircle, 
  ArrowLeft,
  ShieldCheck, 
  CheckCircle, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Users,
  Edit,
  Trash2,
  School,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CreateAttendanceDialog } from '../../components/dialogs/CreateAttendanceDialog';
import { EditAttendanceDialog } from '../../components/dialogs/EditAttendanceDialog';
import { StudentDetailsDialog } from '../../components/dialogs/StudentDetailsDialog';
import { Class, User, Attendance } from '../../types';

interface GroupedAttendance {
  [date: string]: Attendance[];
}

export const AttendanceTracking: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const preselectedClassId = queryParams.get('classId');
  const preselectedClassName = queryParams.get('className');
  const returnTo = queryParams.get('returnTo');
  // removed unused 'classes' state
  const [students, setStudents] = useState<Record<string, User>>({});
  const [selectedClass, setSelectedClass] = useState<string>(preselectedClassId || '');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<Class[]>([]);
  const [groupedAttendance, setGroupedAttendance] = useState<GroupedAttendance>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [isStudentDetailsOpen, setIsStudentDetailsOpen] = useState(false);
  const [selectedDateForDialog, setSelectedDateForDialog] = useState<string | null>(null);
  const [showOnlyRecordedDays, setShowOnlyRecordedDays] = useState(false);

  useEffect(() => {
    // load persisted filters
    try {
      const raw = localStorage.getItem('attendanceFilters');
      if (raw) {
        const saved = JSON.parse(raw);
        if (typeof saved.showOnlyRecordedDays === 'boolean') setShowOnlyRecordedDays(saved.showOnlyRecordedDays);
        if (typeof saved.year === 'number' && typeof saved.month === 'number') {
          setCurrentMonth(new Date(saved.year, saved.month, 1));
        }
      }
    } catch {}

    const fetchClasses = async () => {
      if (!userProfile) return;
      
      try {
        let classQuery;
        if (userProfile.role === 'admin') {
          classQuery = query(collection(db, 'classes'));
        } else if (userProfile.role === 'teacher') {
          // Fetch regular classes
          classQuery = query(collection(db, 'classes'), where('teacherId', '==', userProfile.id));
        }

        const classDocs = await getDocs(classQuery);
        let fetchedClasses = classDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));
        
        // For teachers, also fetch temporary classes (substitutions)
        if (userProfile.role === 'teacher' && userProfile.temporaryClasses && userProfile.temporaryClasses.length > 0) {
          const tempClassesQuery = query(
            collection(db, 'classes'),
            where('__name__', 'in', userProfile.temporaryClasses)
          );
          const tempClassesDocs = await getDocs(tempClassesQuery);
          const temporaryClasses = tempClassesDocs.docs.map(doc => ({ 
            ...doc.data(), 
            id: doc.id, 
            isTemporary: true // Mark as temporary class
          } as Class));
          
          fetchedClasses = [...fetchedClasses, ...temporaryClasses];
        }
        setTeacherClasses(fetchedClasses);
        
        // Auto-select class: prefer regular classes over temporary ones, then first available
        if (!selectedClass && fetchedClasses.length > 0) {
          const regular = fetchedClasses.find(c => !c.isTemporary);
          const first = regular ?? fetchedClasses[0];
          if (first) setSelectedClass(first.id);
        }
      } catch (error) {
        console.error('Error fetching classes:', error);
        setMessage({ type: 'error', text: 'Errore nel caricamento delle classi' });
      }
    };
    
    fetchClasses();
  }, [userProfile]);

  // persist filters
  useEffect(() => {
    try {
      localStorage.setItem('attendanceFilters', JSON.stringify({
        showOnlyRecordedDays,
        year: currentMonth.getFullYear(),
        month: currentMonth.getMonth(),
      }));
    } catch {}
  }, [showOnlyRecordedDays, currentMonth]);

  useEffect(() => {
    const fetchAttendanceData = async () => {
      if (!selectedClass) return;
      
      setIsLoading(true);
      
      try {
        // Fetch students using the class document's students array (same as ClassManagement)
        let studentsMap: Record<string, User> = {};
        try {
          console.log('Fetching students for class:', selectedClass);
          
          // Get the class document to access the students array
          const classDoc = await getDoc(doc(db, 'classes', selectedClass));
          if (classDoc.exists()) {
            const classData = classDoc.data();
            const studentIds = classData.students || [];
            console.log('Student IDs from class document:', studentIds);
            
            if (studentIds.length > 0) {
              // Fetch student documents in batches (Firestore 'in' query limit is 10)
              const studentBatches = [];
              for (let i = 0; i < studentIds.length; i += 10) {
                const batch = studentIds.slice(i, i + 10);
                const studentsQuery = query(
                  collection(db, 'students'),
                  where('__name__', 'in', batch)
                );
                const studentsDocs = await getDocs(studentsQuery);
                const batchStudents = studentsDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
                studentBatches.push(...batchStudents);
              }
              
              // Convert to map format
              studentBatches.forEach(student => {
                studentsMap[student.id] = student;
              });
              
              console.log('Fetched students:', studentBatches.map(s => ({ id: s.id, displayName: s.displayName })));
            } else {
              console.log('No students found in class document');
            }
          } else {
            console.log('Class document not found:', selectedClass);
          }
        } catch (studentsError) {
          console.error('Error fetching students:', studentsError);
        }
        
        setStudents(studentsMap);

        // Fetch all attendance records for this class
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('classId', '==', selectedClass)
        );

        const attendanceDocs = await getDocs(attendanceQuery);
        const records = attendanceDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date?.toDate() || null,
            studentName: studentsMap[data.studentId]?.displayName || 'Studente non trovato'
          } as Attendance;
        });

        // Group by date
        const grouped = records.reduce((acc, record) => {
          const dateKey = format(record.date, 'yyyy-MM-dd');
          if (!acc[dateKey]) {
            acc[dateKey] = [];
          }
          acc[dateKey].push(record);
          return acc;
        }, {} as GroupedAttendance);

        setAttendanceRecords(records);
        setGroupedAttendance(grouped);
      } catch (error) {
        console.error('Error fetching data:', error);
        setMessage({ type: 'error', text: 'Errore nel caricamento dei dati' });
      } finally {
        setIsLoading(false);
      }
    };
    
    if (selectedClass) {
      fetchAttendanceData();
    }
  }, [selectedClass]);

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedClass(e.target.value);
    setSelectedDate(null);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      return direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1);
    });
  };

  const months = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const handleMonthSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const m = parseInt(e.target.value, 10);
    setCurrentMonth(prev => new Date(prev.getFullYear(), m, 1));
  };

  const handleYearSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const y = parseInt(e.target.value, 10);
    setCurrentMonth(prev => new Date(y, prev.getMonth(), 1));
  };

  const handleDateClick = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setSelectedDate(selectedDate === dateKey ? null : dateKey);
  };

  const handleCreateAttendance = (date: Date) => {
    // Set the date in the state for the dialog
    setSelectedDateForDialog(format(date, 'yyyy-MM-dd'));
    setIsCreateDialogOpen(true);
  };

  const handleEditAttendance = (attendance: Attendance) => {
    setEditingAttendance(attendance);
    setIsEditDialogOpen(true);
  };

  const handleDeleteAttendance = async (attendanceId: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo record di presenza?')) return;
    
    try {
      await deleteDoc(doc(db, 'attendance', attendanceId));
      
      // Update local state
      setAttendanceRecords(prev => prev.filter(record => record.id !== attendanceId));
      
      // Update grouped attendance
      const newGrouped = { ...groupedAttendance };
      Object.keys(newGrouped).forEach(dateKey => {
        newGrouped[dateKey] = newGrouped[dateKey].filter(record => record.id !== attendanceId);
        if (newGrouped[dateKey].length === 0) {
          delete newGrouped[dateKey];
        }
      });
      setGroupedAttendance(newGrouped);
      
      setMessage({ type: 'success', text: 'Record di presenza eliminato con successo' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting attendance record:', error);
      setMessage({ type: 'error', text: 'Errore nell\'eliminazione del record di presenza' });
    }
  };

  const handleViewStudentDetails = (student: User) => {
    setSelectedStudent(student);
    setIsStudentDetailsOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'text-success-600 bg-success-100';
      case 'absent':
        return 'text-error-600 bg-error-100';
      case 'justified':
        return 'text-amber-600 bg-amber-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <Check className="h-4 w-4 text-success-600" />;
      case 'absent':
        return <X className="h-4 w-4 text-error-600" />;
      case 'justified':
        return <ShieldCheck className="h-4 w-4 text-amber-600" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'present':
        return 'Presente';
      case 'absent':
        return 'Assente';
      case 'justified':
        return 'Giustificato';
      default:
        return status;
    }
  };

  // Get all days in the current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Create calendar grid (6 weeks x 7 days)
  const calendarStart = startOfMonth(currentMonth);
  const firstDayOfWeek = calendarStart.getDay();
  const startDate = new Date(calendarStart);
  startDate.setDate(startDate.getDate() - (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1));

  const calendarDays = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    calendarDays.push(date);
  }

  // Get attendance stats for the selected class
  const getAttendanceStats = () => {
    const totalStudents = Object.keys(students).length;
    console.log('Students count:', totalStudents, 'Students object:', students);
    
    const stats = {
      totalStudents,
      presentCount: 0,
      absentCount: 0,
      justifiedCount: 0,
      daysWithRecords: new Set<string>()
    };

    attendanceRecords.forEach(record => {
      const dateKey = format(record.date, 'yyyy-MM-dd');
      stats.daysWithRecords.add(dateKey);
      
      if (record.status === 'present') stats.presentCount++;
      else if (record.status === 'absent') stats.absentCount++;
      else if (record.status === 'justified') stats.justifiedCount++;
    });

    return stats;
  };

  const stats = getAttendanceStats();

  if (!userProfile || (userProfile.role !== 'teacher' && userProfile.role !== 'admin')) {
    return (
      <PageContainer title="Accesso non autorizzato">
        <p>Non hai i permessi per accedere a questa pagina.</p>
      </PageContainer>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-white/5" />
        
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
                  <Calendar className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Registro Presenze</h1>
                  <p className="text-blue-100 mt-1">Registra e gestisci le presenze giornaliere degli studenti</p>
                </div>
              </div>
              
              {/* Class Filter for Teachers with Multiple Classes */}
              {userProfile?.role === 'teacher' && teacherClasses.length > 1 && (
                <div className="min-w-[280px]">
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Seleziona Classe
                  </label>
                  <select
                    className="block w-full rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm text-white shadow-sm focus:border-white/40 focus:ring-white/20 sm:text-sm py-3 px-4 transition-colors"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                  >
                    <option value="" className="text-gray-900">Seleziona una classe</option>
                    {teacherClasses.map(c => (
                      <option key={c.id} value={c.id} className="text-gray-900">
                        {c.name} {c.isTemporary ? '(Supplenza)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-8">
              {returnTo === 'classes' && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/admin/classes')}
                  leftIcon={<ArrowLeft className="h-4 w-4" />}
                  className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
                >
                  Torna alla Gestione Classi
                </Button>
              )}
              {selectedClass && (
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  leftIcon={<Plus className="h-4 w-4" />}
                  className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
                >
                  Crea Registro Presenze
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center ${
            message.type === 'success' ? 'bg-success-50 text-success-700 border border-success-200' : 'bg-error-50 text-error-700 border border-error-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-3 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}
      
      {selectedClass ? (
        isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600 font-light">Caricamento dei dati di presenza...</p>
          </div>
        ) : (
          <>
            {/* Attendance Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
              <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-50" />
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-medium text-emerald-700">Studenti</div>
                  </div>
                  <div className="mt-4 text-3xl font-bold text-slate-900">
                    {isLoading ? '...' : stats.totalStudents}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">Totali</div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-green-200 bg-white shadow-sm">
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-green-50" />
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-medium text-green-700">Presenze</div>
                  </div>
                  <div className="mt-4 text-3xl font-bold text-slate-900">{stats.presentCount}</div>
                  <div className="mt-1 text-sm text-slate-500">Registrate</div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-red-50" />
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
                      <X className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-medium text-red-700">Assenze</div>
                  </div>
                  <div className="mt-4 text-3xl font-bold text-slate-900">{stats.absentCount}</div>
                  <div className="mt-1 text-sm text-slate-500">Registrate</div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-50" />
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="text-sm font-medium text-amber-700">Giustificati</div>
                  </div>
                  <div className="mt-4 text-3xl font-bold text-slate-900">{stats.justifiedCount}</div>
                  <div className="mt-1 text-sm text-slate-500">Registrati</div>
                </div>
              </div>
            </div>


            {/* Class Selection and Month Navigation */}
      <Card className="mb-6 bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="flex items-center text-slate-900">
            <School className="h-5 w-5 mr-2 text-blue-600" />
            Selezione Classe e Periodo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Class info (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Classe</label>
              {selectedClass ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200">
                    {(() => {
                      const c = teacherClasses.find(c => c.id === selectedClass);
                      const baseName = preselectedClassName || c?.name;
                      if (!baseName) return '—';
                      const turno = (c as any)?.turno;
                      return `${baseName}${turno ? ` - ${turno}` : ''}`;
                    })()}
                  </span>
                  {teacherClasses.find(c => c.id === selectedClass && (c as any).isTemporary) && (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">Supplenza</span>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  Nessuna classe selezionata. Seleziona una classe dalla pagina Classi.
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(returnTo || '/admin/classes')}
                    >
                      Vai a Classi
                    </Button>
                  </div>
                </div>
              )}
              <p className="mt-2 text-xs text-slate-500">Le presenze possono essere registrate solo per Sabato o Domenica.</p>
            </div>

            {/* Right: Period toolbar + secondary actions */}
            <div className="flex flex-col gap-3 md:items-end justify-between">
              <div className="inline-flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigateMonth('prev')}
                  disabled={isLoading}
                  leftIcon={<ChevronLeft className="h-4 w-4" />}
                >
                  Precedente
                </Button>

                <select
                  className="rounded-xl border border-slate-200 bg-white h-10 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  value={currentMonth.getMonth()}
                  onChange={handleMonthSelect}
                  aria-label="Mese"
                >
                  {months.map((m, i) => (
                    <option key={m} value={i}>{m}</option>
                  ))}
                </select>

                <select
                  className="rounded-xl border border-slate-200 bg-white h-10 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  value={currentMonth.getFullYear()}
                  onChange={handleYearSelect}
                  aria-label="Anno"
                >
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const base = new Date().getFullYear();
                    const year = base - 2 + idx;
                    return <option key={year} value={year}>{year}</option>;
                  })}
                </select>

                <Button
                  variant="outline"
                  onClick={() => setCurrentMonth(new Date())}
                  disabled={isLoading}
                >
                  Questo mese
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigateMonth('next')}
                  disabled={isLoading}
                  rightIcon={<ChevronRight className="h-4 w-4" />}
                >
                  Successivo
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-4 w-full md:justify-end">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-slate-700 focus:ring-slate-500"
                    checked={showOnlyRecordedDays}
                    onChange={(e) => setShowOnlyRecordedDays(e.target.checked)}
                  />
                  Mostra solo giorni con registri
                </label>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-600 hover:text-slate-900"
                  onClick={() => {
                    setShowOnlyRecordedDays(false);
                    setOnlyTemporary(false);
                    setClassSearch('');
                    setCurrentMonth(new Date());
                  }}
                >
                  Reset filtri
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

            {/* Calendar View */}
            <Card className="mb-8 bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="flex items-center text-slate-900">
                  <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                  Calendario Presenze
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {/* Calendar Header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((date, index) => {
                    const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                    const isSchoolDay = isWeekend(date);
                    const dateKey = format(date, 'yyyy-MM-dd');
                    const hasAttendance = groupedAttendance[dateKey] !== undefined;
                    const isToday = isSameDay(date, new Date());
                    const isSelected = dateKey === selectedDate;
                    
                    // Calculate attendance stats for this day
                    let presentCount = 0;
                    let absentCount = 0;
                    let justifiedCount = 0;
                    
                    if (hasAttendance) {
                      groupedAttendance[dateKey].forEach(record => {
                        if (record.status === 'present') presentCount++;
                        else if (record.status === 'absent') absentCount++;
                        else if (record.status === 'justified') justifiedCount++;
                      });
                    }
                    
                    return (
                      <div
                        key={index}
                        className={`
                          relative p-2 min-h-[100px] border rounded-lg cursor-pointer transition-colors
                          ${!isCurrentMonth ? 'bg-slate-50 text-slate-400 border-slate-100' : 'bg-white border-slate-200'}
                          ${isToday ? 'ring-2 ring-slate-400' : ''}
                          ${isSchoolDay && isCurrentMonth ? 'bg-slate-50 hover:bg-slate-100' : ''}
                          ${isSelected ? 'ring-2 ring-slate-500 bg-slate-100' : ''}
                          ${showOnlyRecordedDays && !hasAttendance ? 'opacity-40 cursor-not-allowed' : ''}
                        `}
                        onClick={() => {
                          if (!isCurrentMonth) return;
                          if (hasAttendance) {
                            handleDateClick(date);
                          } else if (!showOnlyRecordedDays && isSchoolDay) {
                            handleCreateAttendance(date);
                          }
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="text-sm font-medium">
                            {format(date, 'd')}
                          </div>
                          
                          {isCurrentMonth && isSchoolDay && !hasAttendance && !showOnlyRecordedDays && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateAttendance(date);
                              }}
                            >
                              <Plus className="h-4 w-4 text-blue-500" />
                            </Button>
                          )}
                        </div>
                        
                        {hasAttendance && isCurrentMonth && (
                          <div className="mt-2 space-y-1">
                            {presentCount > 0 && (
                              <div className="flex items-center text-xs">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></div>
                                <span className="text-emerald-700">{presentCount} presenti</span>
                              </div>
                            )}
                            {absentCount > 0 && (
                              <div className="flex items-center text-xs">
                                <div className="w-2 h-2 rounded-full bg-rose-500 mr-1"></div>
                                <span className="text-rose-700">{absentCount} assenti</span>
                              </div>
                            )}
                            {justifiedCount > 0 && (
                              <div className="flex items-center text-xs">
                                <div className="w-2 h-2 rounded-full bg-amber-500 mr-1"></div>
                                <span className="text-amber-700">{justifiedCount} giustificati</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {isCurrentMonth && isSchoolDay && !hasAttendance && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <div className="bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded">
                              Crea Presenze
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center justify-center gap-4 pt-4 mt-4 border-t border-gray-200">
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-success-100 border border-success-200 mr-2 flex items-center justify-center">
                      <Check className="h-3 w-3 text-success-600" />
                    </div>
                    <span className="text-sm text-gray-600">Presente</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-error-100 border border-error-200 mr-2 flex items-center justify-center">
                      <X className="h-3 w-3 text-error-600" />
                    </div>
                    <span className="text-sm text-gray-600">Assente</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-amber-100 border border-amber-200 mr-2 flex items-center justify-center">
                      <ShieldCheck className="h-3 w-3 text-amber-600" />
                    </div>
                    <span className="text-sm text-gray-600">Giustificato</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full bg-blue-50 border border-blue-200 mr-2"></div>
                    <span className="text-sm text-gray-600">Giorno di scuola</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Selected Day Attendance Details */}
            {selectedDate && groupedAttendance[selectedDate] && (
              <Card className="mb-8 bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
                <CardHeader className="border-b border-slate-200">
                  <CardTitle className="flex items-center justify-between text-slate-900">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-blue-600" />
                      Presenze del {format(new Date(selectedDate), 'd MMMM yyyy', { locale: it })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate(null)}
                    >
                      Chiudi
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Studente
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Stato
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Note
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Azioni
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {groupedAttendance[selectedDate].map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                                  <span className="text-blue-700 font-medium text-sm">
                                    {record.studentName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {record.studentName}
                                  </div>
                                  <button
                                    onClick={() => {
                                      const student = students[record.studentId];
                                      if (student) {
                                        handleViewStudentDetails(student);
                                      }
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    Vedi dettagli
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                                {getStatusIcon(record.status)}
                                <span className="ml-1">{getStatusText(record.status)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {record.notes || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditAttendance(record)}
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteAttendance(record.id)}
                                  className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bottom action removed; primary create action moved to header */}
          </>
        )
      ) : (
        <Card className="bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
          <CardContent className="p-12 text-center">
            <School className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <h3 className="text-2xl font-light text-gray-900 mb-3">Seleziona una classe</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-8">
              Seleziona una classe per visualizzare e gestire le presenze degli studenti.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create Attendance Dialog */}
      {selectedClass && (
        <CreateAttendanceDialog
          classId={selectedClass}
          isOpen={isCreateDialogOpen}
          onClose={() => {
            setIsCreateDialogOpen(false);
            setSelectedDateForDialog(null);
          }}
          selectedDate={selectedDateForDialog || undefined}
          onSuccess={() => {
            // Refresh attendance data
            const fetchAttendanceData = async () => {
              const attendanceQuery = query(
                collection(db, 'attendance'),
                where('classId', '==', selectedClass)
              );
              const attendanceDocs = await getDocs(attendanceQuery);
              const records = attendanceDocs.docs.map(doc => {
                const data = doc.data();
                return {
                  ...data,
                  id: doc.id,
                  date: data.date?.toDate() || null,
                  studentName: students[data.studentId]?.displayName || 'Studente non trovato'
                } as Attendance;
              });

              const grouped = records.reduce((acc, record) => {
                const dateKey = format(record.date, 'yyyy-MM-dd');
                if (!acc[dateKey]) {
                  acc[dateKey] = [];
                }
                acc[dateKey].push(record);
                return acc;
              }, {} as GroupedAttendance);

              setAttendanceRecords(records);
              setGroupedAttendance(grouped);
            };
            fetchAttendanceData();
          }}
        />
      )}

      {/* Edit Attendance Dialog */}
      {editingAttendance && (
        <EditAttendanceDialog
          attendance={editingAttendance}
          studentName={editingAttendance.studentName}
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setEditingAttendance(null);
          }}
          onUpdate={(updatedAttendance) => {
            // Update local state
            setAttendanceRecords(prev => 
              prev.map(record => record.id === updatedAttendance.id ? updatedAttendance : record)
            );
            
            // Update grouped attendance
            const dateKey = format(updatedAttendance.date, 'yyyy-MM-dd');
            setGroupedAttendance(prev => ({
              ...prev,
              [dateKey]: prev[dateKey].map(record => 
                record.id === updatedAttendance.id ? updatedAttendance : record
              )
            }));
          }}
        />
      )}

      {/* Student Details Dialog */}
      <StudentDetailsDialog
        student={selectedStudent}
        isOpen={isStudentDetailsOpen}
        onClose={() => {
          setIsStudentDetailsOpen(false);
          setSelectedStudent(null);
        }}
      />
    </div>
  </div>
);
};