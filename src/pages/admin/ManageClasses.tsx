import React, { useState, useEffect } from 'react';
import { Plus, Search, Users, X, School, BookOpen, FileText, UserCheck, Trash2, Shield, ClipboardList, Filter, ChevronLeft, ChevronRight, TrendingUp, UserPlus, UserMinus, Eye, Mail, Phone, Edit3, UserX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { CreateClassDialog } from '../../components/dialogs/CreateClassDialog';
import { AddStudentDialog } from '../../components/dialogs/AddStudentDialog';
import { collection, getDocs, query, where, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Class, User } from '../../types';
import { useNavigate } from 'react-router-dom';

export const ManageClasses: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [teachers, setTeachers] = useState<Record<string, User>>({});
  const [students, setStudents] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTurno, setSelectedTurno] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const classesPerPage = 6;
  const [classStats, setClassStats] = useState<{
    totalStudents: number;
    attendancePercentage: number;
    nextLesson: string | null;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false);
  const [isStudentDetailsOpen, setIsStudentDetailsOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isRemoveStudentDialogOpen, setIsRemoveStudentDialogOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<{id: string, name: string} | null>(null);
  const [isChangeTeacherDialogOpen, setIsChangeTeacherDialogOpen] = useState(false);
  const [isAssignAssistantDialogOpen, setIsAssignAssistantDialogOpen] = useState(false);
  const [availableTeachers, setAvailableTeachers] = useState<User[]>([]);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile || userProfile.role !== 'admin') return;
      
      setIsLoading(true);
      try {
        // Fetch all classes
        const classesQuery = query(collection(db, 'classes'));
        const classesDocs = await getDocs(classesQuery);
        const classesData = classesDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));
        setClasses(classesData);

        // Fetch all teachers
        const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const teachersDocs = await getDocs(teachersQuery);
        const teachersMap: Record<string, User> = {};
        teachersDocs.docs.forEach(doc => {
          const userData = { ...doc.data(), id: doc.id } as User;
          teachersMap[doc.id] = userData;
        });
        setTeachers(teachersMap);

        // Fetch all students from students collection
        const studentsQuery = query(collection(db, 'students'));
        const studentsDocs = await getDocs(studentsQuery);
        const studentsMap: Record<string, any> = {};
        studentsDocs.docs.forEach(doc => {
          const studentData = { ...doc.data(), id: doc.id };
          studentsMap[doc.id] = studentData;
        });
        setStudents(studentsMap);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userProfile, refreshKey]);

  // Filter classes based on search query and turno
  const filteredClasses = classes.filter(classItem => {
    const matchesSearch = !searchQuery || 
      classItem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      classItem.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTurno = !selectedTurno || classItem.turno === selectedTurno;
    
    return matchesSearch && matchesTurno;
  });

  // Get unique turnos for filter dropdown
  const uniqueTurnos = Array.from(new Set(classes.map(c => c.turno).filter(Boolean)));

  // Function to get turno color styling
  const getTurnoColorClass = (turno: string) => {
    const colors = {
      'Mattina': 'bg-gradient-to-r from-amber-100 to-yellow-200 text-amber-800 border-amber-300',
      'Pomeriggio': 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border-blue-300',
      'Sera': 'bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border-purple-300',
      'Serale': 'bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-800 border-indigo-300',
      'Weekend': 'bg-gradient-to-r from-green-100 to-emerald-200 text-green-800 border-green-300',
      'Intensivo': 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border-red-300',
      'Online': 'bg-gradient-to-r from-cyan-100 to-cyan-200 text-cyan-800 border-cyan-300',
    };
    return colors[turno as keyof typeof colors] || 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 border-gray-300';
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredClasses.length / classesPerPage);
  const startIndex = (currentPage - 1) * classesPerPage;
  const endIndex = startIndex + classesPerPage;
  const paginatedClasses = filteredClasses.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTurno]);

  // Fetch class statistics when a class is selected
  useEffect(() => {
    const fetchClassStats = async () => {
      if (!selectedClass) {
        setClassStats(null);
        return;
      }

      setLoadingStats(true);
      try {
        // Calculate total students
        const totalStudents = selectedClass.students?.length || 0;

        // Fetch attendance records for this class
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('classId', '==', selectedClass.id)
        );
        const attendanceDocs = await getDocs(attendanceQuery);
        
        // Calculate attendance percentage
        let attendancePercentage = 0;
        if (attendanceDocs.docs.length > 0 && totalStudents > 0) {
          const totalAttendanceRecords = attendanceDocs.docs.length;
          const presentCount = attendanceDocs.docs.reduce((count, doc) => {
            const data = doc.data();
            return count + (data.attendanceData?.filter((record: any) => record.status === 'present')?.length || 0);
          }, 0);
          
          attendancePercentage = Math.round((presentCount / (totalAttendanceRecords * totalStudents)) * 100);
        }

        // Fetch next lesson
        const lessonsQuery = query(
          collection(db, 'lessons'),
          where('classId', '==', selectedClass.id)
        );
        const lessonsDocs = await getDocs(lessonsQuery);
        
        let nextLesson = null;
        if (lessonsDocs.docs.length > 0) {
          const now = new Date();
          const futureLessons = lessonsDocs.docs
            .map(doc => ({ ...doc.data(), id: doc.id }))
            .filter((lesson: any) => new Date(lesson.date) > now)
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          if (futureLessons.length > 0) {
            const nextLessonData = futureLessons[0] as any;
            nextLesson = new Date(nextLessonData.date).toLocaleDateString('it-IT', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          }
        }

        setClassStats({
          totalStudents,
          attendancePercentage: isNaN(attendancePercentage) ? 0 : attendancePercentage,
          nextLesson
        });
      } catch (error) {
        console.error('Error fetching class stats:', error);
        setClassStats({
          totalStudents: selectedClass.students?.length || 0,
          attendancePercentage: 0,
          nextLesson: null
        });
      } finally {
        setLoadingStats(false);
      }
    };

    fetchClassStats();
  }, [selectedClass]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTurno('');
  };


  const handleAddStudents = async (studentIds: string[]) => {
    if (!selectedClass || studentIds.length === 0) return;

    try {
      const batch = writeBatch(db);
      
      // Add all selected students to the class
      const classRef = doc(db, 'classes', selectedClass.id);
      batch.update(classRef, {
        students: arrayUnion(...studentIds)
      });

      // Auto-approve any pending students being added to the class
      for (const studentId of studentIds) {
        const studentRef = doc(db, 'students', studentId);
        console.log(`Updating student ${studentId} to active status`);
        batch.update(studentRef, {
          accountStatus: 'active',
          isEnrolled: true,
          enrollmentDate: new Date()
        });
      }

      // Execute all updates in a batch
      await batch.commit();

      // Update local state
      setSelectedClass(prev => prev ? {
        ...prev,
        students: [...(prev.students || []), ...studentIds]
      } : null);

      setIsAddStudentDialogOpen(false);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error adding students:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
    }
  };

  const handleRemoveStudentClick = (studentId: string, studentName: string) => {
    setStudentToRemove({ id: studentId, name: studentName });
    setIsRemoveStudentDialogOpen(true);
  };

  const handleRemoveStudent = async () => {
    if (!selectedClass || !studentToRemove) return;

    try {
      await updateDoc(doc(db, 'classes', selectedClass.id), {
        students: arrayRemove(studentToRemove.id)
      });

      // Update local state
      setSelectedClass(prev => prev ? {
        ...prev,
        students: (prev.students || []).filter(id => id !== studentToRemove.id)
      } : null);

      setRefreshKey(prev => prev + 1);
      setIsRemoveStudentDialogOpen(false);
      setStudentToRemove(null);
    } catch (error) {
      console.error('Error removing student:', error);
    }
  };

  const handleViewStudentDetails = (student: any) => {
    setSelectedStudent(student);
    setIsStudentDetailsOpen(true);
  };

  // Fetch available teachers when dialogs open
  useEffect(() => {
    const fetchAvailableTeachers = async () => {
      if (!isChangeTeacherDialogOpen && !isAssignAssistantDialogOpen) return;
      
      try {
        const teachersQuery = query(
          collection(db, 'users'), 
          where('role', '==', 'teacher'),
          where('accountStatus', '==', 'active')
        );
        const teachersDocs = await getDocs(teachersQuery);
        const allTeachers = teachersDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        
        // Filter by teacher type based on dialog
        let filteredTeachers = allTeachers;
        if (isChangeTeacherDialogOpen) {
          // Main teacher: show regolare and volontario
          filteredTeachers = allTeachers.filter(teacher => 
            (teacher as any).teacherType === 'insegnante_regolare' || 
            (teacher as any).teacherType === 'insegnante_volontario'
          );
        } else if (isAssignAssistantDialogOpen) {
          // Assistant: show assistente
          filteredTeachers = allTeachers.filter(teacher => 
            (teacher as any).teacherType === 'assistente'
          );
        }
        
        setAvailableTeachers(filteredTeachers);
      } catch (error) {
        console.error('Error fetching available teachers:', error);
      }
    };

    fetchAvailableTeachers();
  }, [isChangeTeacherDialogOpen, isAssignAssistantDialogOpen]);

  const handleChangeTeacher = async (teacherId: string) => {
    if (!selectedClass) return;

    try {
      // Update class with new teacher
      await updateDoc(doc(db, 'classes', selectedClass.id), {
        teacherId: teacherId
      });

      // Update teacher status to assigned
      await updateDoc(doc(db, 'users', teacherId), {
        assigned: true
      });

      // If there was a previous teacher, update their status to unassigned
      if (selectedClass.teacherId && selectedClass.teacherId !== teacherId) {
        await updateDoc(doc(db, 'users', selectedClass.teacherId), {
          assigned: false
        });
      }

      // Update local state
      setSelectedClass(prev => prev ? {
        ...prev,
        teacherId: teacherId
      } : null);

      setIsChangeTeacherDialogOpen(false);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error changing teacher:', error);
    }
  };

  const handleAssignAssistant = async (assistantId: string) => {
    if (!selectedClass) return;

    try {
      // Update class with new assistant
      await updateDoc(doc(db, 'classes', selectedClass.id), {
        assistantId: assistantId
      });

      // Update assistant status to assigned
      await updateDoc(doc(db, 'users', assistantId), {
        assigned: true
      });

      // If there was a previous assistant, update their status to unassigned
      if ((selectedClass as any).assistantId && (selectedClass as any).assistantId !== assistantId) {
        await updateDoc(doc(db, 'users', (selectedClass as any).assistantId), {
          assigned: false
        });
      }

      // Update local state
      setSelectedClass(prev => prev ? {
        ...prev,
        assistantId: assistantId
      } : null);

      setIsAssignAssistantDialogOpen(false);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error assigning assistant:', error);
    }
  };

  const handleUnassignTeacher = async () => {
    if (!selectedClass || !selectedClass.teacherId) return;

    try {
      // Update class to remove teacher
      await updateDoc(doc(db, 'classes', selectedClass.id), {
        teacherId: null
      });

      // Update teacher status to unassigned
      await updateDoc(doc(db, 'users', selectedClass.teacherId), {
        assigned: false
      });

      // Update local state
      setSelectedClass(prev => prev ? {
        ...prev,
        teacherId: undefined
      } : null);

      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error unassigning teacher:', error);
    }
  };

  const handleRemoveAssistant = async () => {
    if (!selectedClass || !(selectedClass as any).assistantId) return;

    try {
      // Update class to remove assistant
      await updateDoc(doc(db, 'classes', selectedClass.id), {
        assistantId: null
      });

      // Update assistant status to unassigned
      await updateDoc(doc(db, 'users', (selectedClass as any).assistantId), {
        assigned: false
      });

      // Update local state
      setSelectedClass(prev => prev ? {
        ...prev,
        assistantId: null
      } : null);

      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error removing assistant:', error);
    }
  };


  const handleDeleteClass = async (classId: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa classe? Questa azione non può essere annullata.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'classes', classId));
      setClasses(prev => prev.filter(c => c.id !== classId));
      if (selectedClass?.id === classId) {
        setSelectedClass(null);
      }
    } catch (error) {
      console.error('Error deleting class:', error);
    }
  };

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-8 text-center max-w-md mx-auto">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Accesso Negato</h2>
          <p className="text-slate-600">Non hai i permessi per accedere a questa sezione.</p>
        </div>
      </div>
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
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
                <School className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold">Gestione Classi</h1>
                <p className="text-blue-100 mt-1 hidden sm:block">Crea, modifica e gestisci le classi della scuola</p>
              </div>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                aria-label="Crea Classe"
              >
                <Plus className="h-5 w-5 sm:mr-2" />
                <span className="hidden sm:inline">Crea Classe</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-light">Caricamento classi...</p>
          </div>
        ) : selectedClass ? (
          /* Class Details View */
          <div className="space-y-8">
            {/* Back to Classes Button */}
            <Button
              variant="outline"
              onClick={() => setSelectedClass(null)}
              className="mb-4"
            >
              ← Torna alle Classi
            </Button>

            <div className="space-y-6">
              {/* Class Info Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="p-6 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">{selectedClass.name}</h2>
                      <p className="text-slate-600 mt-1">{selectedClass.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClass(selectedClass.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Elimina
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Turno</label>
                      <div className="text-sm text-gray-900">{selectedClass.turno || 'Non specificato'}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Insegnante</label>
                      <div className="text-sm text-gray-900">
                        {selectedClass.teacherId 
                          ? teachers[selectedClass.teacherId]?.displayName || 'Insegnante non trovato'
                          : 'Nessun insegnante assegnato'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Class Statistics */}
              {loadingStats ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-slate-600">Caricamento statistiche...</span>
                  </div>
                </div>
              ) : classStats ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Students */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 bg-teal-100 rounded-lg flex items-center justify-center">
                        <Users className="h-4 w-4 text-teal-600" />
                      </div>
                      <span className="text-sm font-medium text-teal-600">Studenti Totali</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{classStats.totalStudents}</div>
                    <div className="text-xs text-slate-500 mt-1">Nelle tue classi</div>
                  </div>

                  {/* Attendance Percentage */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 bg-orange-100 rounded-lg flex items-center justify-center">
                        <UserCheck className="h-4 w-4 text-orange-600" />
                      </div>
                      <span className="text-sm font-medium text-orange-600">Tasso Presenze</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{classStats.attendancePercentage}%</div>
                    <div className="text-xs text-slate-500 mt-1">Media generale</div>
                  </div>

                  {/* Active Classes */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <School className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-blue-600">Classi Gestite</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">1</div>
                    <div className="text-xs text-slate-500 mt-1">Attive</div>
                  </div>

                  {/* Completed Activities */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-purple-600" />
                      </div>
                      <span className="text-sm font-medium text-purple-600">Compiti Attivi</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">1</div>
                    <div className="text-xs text-slate-500 mt-1">In scadenza</div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">Impossibile caricare le statistiche</p>
                  </div>
                </div>
              )}

              {/* Teacher Management */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="p-6 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    Gestione Docenti
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Teacher */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-slate-900">Docente Principale</h4>
                        <div className="flex gap-2">
                          {selectedClass.teacherId ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsChangeTeacherDialogOpen(true)}
                                className="flex items-center gap-2"
                              >
                                <Edit3 className="h-4 w-4" />
                                Cambia
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleUnassignTeacher}
                                className="flex items-center gap-2 text-red-600 hover:text-red-700"
                              >
                                <UserX className="h-4 w-4" />
                                Rimuovi
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsChangeTeacherDialogOpen(true)}
                              className="flex items-center gap-2"
                            >
                              <UserPlus className="h-4 w-4" />
                              Assegna
                            </Button>
                          )}
                        </div>
                      </div>
                      {selectedClass.teacherId && teachers[selectedClass.teacherId] ? (
                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                          <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">
                            {teachers[selectedClass.teacherId]?.displayName?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">
                              {teachers[selectedClass.teacherId]?.displayName}
                            </div>
                            <div className="text-sm text-slate-600">
                              {teachers[selectedClass.teacherId]?.email}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                          Nessun docente assegnato
                        </div>
                      )}
                    </div>

                    {/* Assistant */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-slate-900">Assistente</h4>
                        <div className="flex gap-2">
                          {(selectedClass as any).assistantId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleRemoveAssistant}
                              className="flex items-center gap-2 text-red-600 hover:text-red-700"
                            >
                              <UserX className="h-4 w-4" />
                              Rimuovi
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsAssignAssistantDialogOpen(true)}
                              className="flex items-center gap-2"
                            >
                              <UserPlus className="h-4 w-4" />
                              Assegna
                            </Button>
                          )}
                        </div>
                      </div>
                      {(selectedClass as any).assistantId && teachers[(selectedClass as any).assistantId] ? (
                        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                          <div className="h-10 w-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-medium">
                            {teachers[(selectedClass as any).assistantId]?.displayName?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">
                              {teachers[(selectedClass as any).assistantId]?.displayName}
                            </div>
                            <div className="text-sm text-slate-600">
                              {teachers[(selectedClass as any).assistantId]?.email}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                          Nessun assistente assegnato
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Students List */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="p-6 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Studenti ({selectedClass.students?.length || 0})
                    </h3>
                    <Button
                      onClick={() => setIsAddStudentDialogOpen(true)}
                      className="flex items-center gap-2"
                    >
                      <UserPlus className="h-4 w-4" />
                      Aggiungi Studente
                    </Button>
                  </div>
                </div>
                <div className="p-6">
                  {!selectedClass.students || selectedClass.students.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500 mb-4">Nessuno studente in questa classe</p>
                      <Button
                        onClick={() => setIsAddStudentDialogOpen(true)}
                        variant="outline"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Aggiungi il primo studente
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedClass.students.map((studentId) => {
                        const student = students[studentId];
                        return (
                          <div key={studentId} className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                            <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">
                              {student?.displayName?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-900 truncate">
                                {student?.displayName || 'Studente non trovato'}
                              </div>
                              <div className="text-sm text-slate-600 truncate">{student?.email}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewStudentDetails(student)}
                                className="p-2"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRemoveStudentClick(studentId, student?.displayName || 'Studente')}
                                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onClick={() => navigate(`/lessons?classId=${selectedClass.id}&className=${encodeURIComponent(selectedClass.name)}&returnTo=classes`)}
                  className="bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-4">
                    <Users className="h-8 w-8 text-white/90" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">Le Mie Classi</h3>
                  <p className="text-sm text-white/80">Gestisci classi e studenti</p>
                </div>

                <div
                  onClick={() => navigate(`/attendance?classId=${selectedClass.id}&className=${encodeURIComponent(selectedClass.name)}&returnTo=classes`)}
                  className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-4">
                    <UserCheck className="h-8 w-8 text-white/90" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">Presenze</h3>
                  <p className="text-sm text-white/80">Registra presenze</p>
                </div>

                <div
                  onClick={() => navigate(`/homework?classId=${selectedClass.id}&className=${encodeURIComponent(selectedClass.name)}&returnTo=classes`)}
                  className="bg-gradient-to-br from-pink-500 to-pink-700 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-4">
                    <ClipboardList className="h-8 w-8 text-white/90" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">Compiti</h3>
                  <p className="text-sm text-white/80">Gestisci compiti</p>
                </div>

                <div
                  onClick={() => navigate(`/materials?classId=${selectedClass.id}&className=${encodeURIComponent(selectedClass.name)}&returnTo=classes`)}
                  className="bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-4">
                    <FileText className="h-8 w-8 text-white/90" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">Materiali</h3>
                  <p className="text-sm text-white/80">Carica materiali</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Classes Grid View */
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Tutte le Classi</h2>
                <p className="text-slate-600 mt-1">Clicca su una classe per gestirla</p>
              </div>
              <div className="text-sm text-slate-500">
                {filteredClasses.length} di {classes.length} {classes.length === 1 ? 'classe' : 'classi'}
                {totalPages > 1 && (
                  <span className="ml-2">• Pagina {currentPage} di {totalPages}</span>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cerca per nome o descrizione..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                      value={selectedTurno}
                      onChange={(e) => setSelectedTurno(e.target.value)}
                      className="pl-10 pr-8 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[140px]"
                    >
                      <option value="">Tutti i turni</option>
                      {uniqueTurnos.map(turno => (
                        <option key={turno} value={turno}>{turno}</option>
                      ))}
                    </select>
                  </div>
                  
                  {(searchQuery || selectedTurno) && (
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="px-3"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {filteredClasses.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="p-12 text-center">
                  <School className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {classes.length === 0 ? 'Nessuna classe trovata' : 'Nessun risultato'}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {classes.length === 0 
                      ? 'Crea la prima classe per iniziare' 
                      : 'Prova a modificare i filtri di ricerca'
                    }
                  </p>
                  {classes.length === 0 ? (
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Crea Prima Classe
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-2" />
                      Cancella Filtri
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedClasses.map((classItem) => (
                    <div
                      key={classItem.id}
                      onClick={() => setSelectedClass(classItem)}
                      className="group relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1"
                    >
                      {/* Background gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 via-blue-50/0 to-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      <div className="relative p-6">
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-700 transition-colors duration-200 truncate">
                              {classItem.name}
                            </h3>
                            <p className="text-sm text-slate-600 mt-2 line-clamp-2 leading-relaxed">{classItem.description}</p>
                          </div>
                          <div className="ml-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                            <School className="h-6 w-6" />
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors duration-200">
                            <div className="flex items-center gap-2 text-slate-700">
                              <Users className="h-4 w-4 text-blue-600" />
                              <span className="font-medium">Studenti</span>
                            </div>
                            <span className="font-bold text-slate-900 text-lg">{classItem.students?.length || 0}</span>
                          </div>
                          
                          {classItem.turno && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600 font-medium">Turno</span>
                              <span className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${getTurnoColorClass(classItem.turno)}`}>
                                {classItem.turno}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 font-medium">Insegnante</span>
                            <span className="font-semibold text-slate-900 text-sm text-right max-w-[140px] truncate">
                              {classItem.teacherId 
                                ? teachers[classItem.teacherId]?.displayName || 'Non assegnato'
                                : 'Non assegnato'
                              }
                            </span>
                          </div>
                        </div>
                        
                        <div className="mt-6 pt-4 border-t border-slate-200 group-hover:border-blue-200 transition-colors duration-200">
                          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 group-hover:text-blue-600 transition-colors duration-200">
                            <div className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                            <span className="font-medium">Clicca per gestire la classe</span>
                            <div className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Hover border effect */}
                      <div className="absolute inset-0 rounded-2xl border-2 border-blue-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                    </div>
                  ))}
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-8">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Precedente</span>
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <Button
                          key={page}
                          variant={page === currentPage ? undefined : "outline"}
                          onClick={() => setCurrentPage(page)}
                          className="w-10 h-10 p-0"
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-2"
                    >
                      <span className="hidden sm:inline">Successiva</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Class Dialog */}
      <CreateClassDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreated={() => {
          setRefreshKey(prev => prev + 1);
          setIsCreateDialogOpen(false);
        }}
      />

      {/* Add Student Dialog */}
      <AddStudentDialog
        isOpen={isAddStudentDialogOpen}
        onClose={() => setIsAddStudentDialogOpen(false)}
        onAddStudents={handleAddStudents}
        excludeStudentIds={selectedClass?.students || []}
      />

      {/* Student Details Dialog */}
      {isStudentDetailsOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Dettagli Studente</h3>
                <button
                  onClick={() => setIsStudentDetailsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-medium">
                  {selectedStudent.displayName?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-900">{selectedStudent.displayName}</h4>
                  <p className="text-gray-600">{selectedStudent.role}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Email</div>
                    <div className="text-gray-900">{selectedStudent.email}</div>
                  </div>
                </div>
                
                {(selectedStudent as any).phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-700">Telefono</div>
                      <div className="text-gray-900">{(selectedStudent as any).phone}</div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <UserCheck className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">ID Utente</div>
                    <div className="text-gray-900 font-mono text-sm">{selectedStudent.id}</div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Button
                  onClick={() => handleRemoveStudentClick(selectedStudent.id, selectedStudent.displayName || 'Studente')}
                  variant="outline"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Rimuovi dalla classe
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Student Confirmation Dialog */}
      {isRemoveStudentDialogOpen && studentToRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                  <UserX className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Rimuovi Studente</h3>
                  <p className="text-gray-600">Questa azione non può essere annullata</p>
                </div>
              </div>
              
              <p className="text-gray-700 mb-6">
                Sei sicuro di voler rimuovere <strong>{studentToRemove.name}</strong> dalla classe?
              </p>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setIsRemoveStudentDialogOpen(false);
                    setStudentToRemove(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Annulla
                </Button>
                <Button
                  onClick={handleRemoveStudent}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  Rimuovi
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Teacher Dialog */}
      {isChangeTeacherDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Cambia Docente</h3>
                <button
                  onClick={() => setIsChangeTeacherDialogOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cerca docente
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    value={teacherSearchQuery}
                    onChange={(e) => setTeacherSearchQuery(e.target.value)}
                    placeholder="Nome o email del docente..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {availableTeachers
                  .filter(teacher => 
                    (!teacherSearchQuery || 
                    teacher.displayName?.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
                    teacher.email?.toLowerCase().includes(teacherSearchQuery.toLowerCase()))
                  )
                  .map(teacher => (
                    <div
                      key={teacher.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                      onClick={() => handleChangeTeacher(teacher.id)}
                    >
                      <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">
                        {teacher.displayName?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{teacher.displayName}</div>
                        <div className="text-sm text-gray-600">{teacher.email}</div>
                      </div>
                    </div>
                  ))}
                {availableTeachers.filter(teacher => 
                  (!teacherSearchQuery || 
                  teacher.displayName?.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
                  teacher.email?.toLowerCase().includes(teacherSearchQuery.toLowerCase()))
                ).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    {teacherSearchQuery ? 'Nessun docente trovato' : 'Nessun docente disponibile'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Assistant Dialog */}
      {isAssignAssistantDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Assegna Assistente</h3>
                <button
                  onClick={() => setIsAssignAssistantDialogOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cerca assistente
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    value={teacherSearchQuery}
                    onChange={(e) => setTeacherSearchQuery(e.target.value)}
                    placeholder="Nome o email dell'assistente..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {availableTeachers
                  .filter(teacher => 
                    (!teacherSearchQuery || 
                    teacher.displayName?.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
                    teacher.email?.toLowerCase().includes(teacherSearchQuery.toLowerCase()))
                  )
                  .map(teacher => (
                    <div
                      key={teacher.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                      onClick={() => handleAssignAssistant(teacher.id)}
                    >
                      <div className="h-8 w-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-medium">
                        {teacher.displayName?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{teacher.displayName}</div>
                        <div className="text-sm text-gray-600">{teacher.email} • {teacher.role}</div>
                      </div>
                    </div>
                  ))}
                {availableTeachers.filter(teacher => 
                  (!teacherSearchQuery || 
                  teacher.displayName?.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
                  teacher.email?.toLowerCase().includes(teacherSearchQuery.toLowerCase()))
                ).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    {teacherSearchQuery ? 'Nessun assistente trovato' : 'Nessun assistente disponibile'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageClasses;