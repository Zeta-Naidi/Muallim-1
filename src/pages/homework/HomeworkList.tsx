import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { format, isToday, isBefore, isAfter, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  Plus, 
  FileText, 
  Trash2, 
  ArrowLeft,
  Calendar, 
  ExternalLink, 
  User, 
  Edit, 
  Eye, 
  Search, 
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  School,
  BookOpenText
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EditHomeworkDialog } from '../../components/dialogs/EditHomeworkDialog';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { Homework, Class, HomeworkSubmission } from '../../types';

type SortField = 'title' | 'dueDate' | 'className';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'overdue' | 'today';

export const HomeworkList: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const preselectedClassId = queryParams.get('classId');
  const preselectedClassName = queryParams.get('className');
  const returnTo = queryParams.get('returnTo');
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [filteredHomeworks, setFilteredHomeworks] = useState<Homework[]>([]);
  const [classes, setClasses] = useState<Record<string, Class>>({});
  const [submissions, setSubmissions] = useState<Record<string, HomeworkSubmission>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>(preselectedClassId || '');
  const [teacherClasses, setTeacherClasses] = useState<Class[]>([]);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [expandedHomework, setExpandedHomework] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [calendarView, setCalendarView] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const fetchClasses = async () => {
      if (!userProfile) return;
      
      try {
        // Fetch all classes for the class filter dropdown
        if (userProfile.role === 'admin') {
          const classQuery = query(collection(db, 'classes'));
          const classDocs = await getDocs(classQuery);
          
          const classesMap: Record<string, Class> = {};
          const fetchedClasses: Class[] = [];
          
          classDocs.docs.forEach(doc => {
            const classData = { ...doc.data(), id: doc.id } as Class;
            classesMap[classData.id] = classData;
            fetchedClasses.push(classData);
          });
          
          setClasses(classesMap);
          setTeacherClasses(fetchedClasses);
        } else if (userProfile.role === 'teacher') {
          // Fetch regular classes
          const classQuery = query(
            collection(db, 'classes'),
            where('teacherId', '==', userProfile.id)
          );
          const classDocs = await getDocs(classQuery);
          const teacherClasses = classDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));
          
          // Fetch temporary classes (substitutions)
          let temporaryClasses: Class[] = [];
          if (userProfile.temporaryClasses && userProfile.temporaryClasses.length > 0) {
            const tempClassesQuery = query(
              collection(db, 'classes'),
              where('__name__', 'in', userProfile.temporaryClasses)
            );
            const tempClassesDocs = await getDocs(tempClassesQuery);
            temporaryClasses = tempClassesDocs.docs.map(doc => ({ 
              ...doc.data(), 
              id: doc.id,
              isTemporary: true
            } as Class));
          }
          
          // Combine regular and temporary classes
          const allClasses = [...teacherClasses, ...temporaryClasses];
          
          // Create classes map
          const classesMap: Record<string, Class> = {};
          allClasses.forEach(classItem => {
            classesMap[classItem.id] = classItem;
          });
          
          setClasses(classesMap);
          setTeacherClasses(allClasses);
        }
      } catch (error) {
        console.error('Errore nel recupero delle classi:', error);
      }
    };
    
    fetchClasses();
  }, [userProfile]);

  useEffect(() => {
    const fetchHomeworks = async () => {
      if (!userProfile) return;
      
      setIsLoading(true);
      
      try {
        let homeworkQuery;

        if (userProfile.role === 'student') {
          // Only query if classId is defined
          if (userProfile.classId) {
            homeworkQuery = query(
              collection(db, 'homework'),
              where('classId', '==', userProfile.classId),
              orderBy('dueDate', 'desc')
            );
            
            // Also fetch student's submissions
            const submissionsQuery = query(
              collection(db, 'homeworkSubmissions'),
              where('studentId', '==', userProfile.id)
            );
            const submissionsDocs = await getDocs(submissionsQuery);
            const submissionsMap: Record<string, HomeworkSubmission> = {};
            submissionsDocs.docs.forEach(doc => {
              const data = doc.data();
              const submission = {
                ...data,
                id: doc.id,
                submittedAt: data.submittedAt?.toDate() || new Date(),
                gradedAt: data.gradedAt?.toDate() || null
              } as HomeworkSubmission;
              submissionsMap[submission.homeworkId] = submission;
            });
            setSubmissions(submissionsMap);
          } else {
            // If no classId, return empty array
            setHomeworks([]);
            setFilteredHomeworks([]);
            setIsLoading(false);
            return;
          }
        } else if (userProfile.role === 'teacher') {
          // Get homework for classes where teacher is the main teacher
          const teacherClassesQuery = query(
            collection(db, 'classes'),
            where('teacherId', '==', userProfile.id)
          );
          const teacherClassesDocs = await getDocs(teacherClassesQuery);
          const teacherClassIds = teacherClassesDocs.docs.map(doc => doc.id);
          
          // Add temporary classes (substitutions) if any
          let allClassIds = [...teacherClassIds];
          if (userProfile.temporaryClasses && userProfile.temporaryClasses.length > 0) {
            allClassIds = [...allClassIds, ...userProfile.temporaryClasses];
          }
          
          if (selectedClass) {
            homeworkQuery = query(
              collection(db, 'homework'),
              where('classId', '==', selectedClass),
              orderBy('dueDate', 'desc')
            );
          } else if (allClassIds.length > 0) {
            homeworkQuery = query(
              collection(db, 'homework'),
              where('classId', 'in', allClassIds),
              orderBy('dueDate', 'desc')
            );
          } else {
            // Fallback if no classes found
            homeworkQuery = query(
              collection(db, 'homework'),
              where('createdBy', '==', userProfile.id),
              orderBy('dueDate', 'desc')
            );
          }
        } else if (userProfile.role === 'admin') {
          if (selectedClass) {
            homeworkQuery = query(
              collection(db, 'homework'),
              where('classId', '==', selectedClass),
              orderBy('dueDate', 'desc')
            );
          } else {
            // If no class selected for admin, get all homework
            homeworkQuery = query(
              collection(db, 'homework'),
              orderBy('dueDate', 'desc')
            );
          }
        }
        
        if (homeworkQuery) {
          const homeworkDocs = await getDocs(homeworkQuery);
          const fetchedHomeworks = homeworkDocs.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              dueDate: data.dueDate?.toDate() || null
            } as Homework;
          });
          setHomeworks(fetchedHomeworks);
          applyFiltersAndSort(fetchedHomeworks);
        }
      } catch (error) {
        console.error('Errore nel recupero dei compiti:', error);
        setMessage({ type: 'error', text: 'Errore nel recupero dei compiti' });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchHomeworks();
  }, [userProfile, selectedClass]);

  const applyFiltersAndSort = (homeworkList: Homework[] = homeworks) => {
    let filtered = [...homeworkList];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(hw => 
        hw.title.toLowerCase().includes(query) || 
        hw.description.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(hw => 
        hw.dueDate && isAfter(hw.dueDate, new Date()) && !isToday(hw.dueDate)
      );
    } else if (statusFilter === 'overdue') {
      filtered = filtered.filter(hw => 
        hw.dueDate && isBefore(hw.dueDate, new Date()) && !isToday(hw.dueDate)
      );
    } else if (statusFilter === 'today') {
      filtered = filtered.filter(hw => 
        hw.dueDate && isToday(hw.dueDate)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      if (sortField === 'title') {
        return sortDirection === 'asc' 
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title);
      } else if (sortField === 'dueDate') {
        if (!a.dueDate) return sortDirection === 'asc' ? 1 : -1;
        if (!b.dueDate) return sortDirection === 'asc' ? -1 : 1;
        return sortDirection === 'asc' 
          ? a.dueDate.getTime() - b.dueDate.getTime()
          : b.dueDate.getTime() - a.dueDate.getTime();
      } else if (sortField === 'className') {
        const classNameA = a.className || classes[a.classId]?.name || '';
        const classNameB = b.className || classes[b.classId]?.name || '';
        return sortDirection === 'asc' 
          ? classNameA.localeCompare(classNameB)
          : classNameB.localeCompare(classNameA);
      }
      return 0;
    });
    
    setFilteredHomeworks(filtered);
  };

  useEffect(() => {
    applyFiltersAndSort();
  }, [searchQuery, sortField, sortDirection, statusFilter, homeworks]);

  const handleDeleteHomework = async (id: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo compito?')) return;
    
    try {
      await deleteDoc(doc(db, 'homework', id));
      setHomeworks(prev => prev.filter(homework => homework.id !== id));
      setFilteredHomeworks(prev => prev.filter(homework => homework.id !== id));
      setMessage({ type: 'success', text: 'Compito eliminato con successo' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Errore nell\'eliminazione del compito:', error);
      setMessage({ type: 'error', text: 'Errore nell\'eliminazione del compito' });
    }
  };

  const handleEditHomework = (homework: Homework) => {
    setEditingHomework(homework);
    setIsEditDialogOpen(true);
  };

  const handleHomeworkUpdate = (updatedHomework: Homework) => {
    setHomeworks(prev => prev.map(hw => 
      hw.id === updatedHomework.id ? updatedHomework : hw
    ));
    applyFiltersAndSort();
    setMessage({ type: 'success', text: 'Compito aggiornato con successo' });
    
    // Clear success message after 3 seconds
    setTimeout(() => setMessage(null), 3000);
  };

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedClass(e.target.value);
  };

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const calendarDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const getHomeworksForDay = (date: Date) => {
    return filteredHomeworks.filter(homework => 
      homework.dueDate && isSameDay(homework.dueDate, date)
    );
  };

  const formatDueDate = (dueDate: Date | null): string => {
    if (!dueDate || !(dueDate instanceof Date) || isNaN(dueDate.getTime())) {
      return 'Data non valida';
    }
    return format(dueDate, 'd MMMM yyyy', { locale: it });
  };

  const getHomeworkStatus = (homework: Homework) => {
    if (!homework.dueDate) return { status: 'unknown', label: 'Senza scadenza', color: 'bg-gray-100 text-gray-800' };
    
    if (userProfile?.role === 'student' && submissions[homework.id]) {
      return { 
        status: 'submitted', 
        label: submissions[homework.id].status === 'graded' 
          ? `Valutato (${submissions[homework.id].grade}/10)` 
          : 'Consegnato', 
        color: 'bg-success-100 text-success-800' 
      };
    }
    
    if (isToday(homework.dueDate)) {
      return { status: 'today', label: 'Scade oggi', color: 'bg-amber-100 text-amber-800' };
    }
    
    if (isBefore(homework.dueDate, new Date())) {
      return { status: 'overdue', label: 'Scaduto', color: 'bg-error-100 text-error-800' };
    }
    
    if (isBefore(homework.dueDate, addDays(new Date(), 3))) {
      return { status: 'soon', label: 'Scadenza vicina', color: 'bg-amber-100 text-amber-800' };
    }
    
    return { status: 'active', label: 'Attivo', color: 'bg-blue-100 text-blue-800' };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <CheckCircle className="h-4 w-4" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4" />;
      case 'today':
      case 'soon':
        return <Clock className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const canEditHomework = (homework: Homework): boolean => {
    return userProfile?.role === 'admin' || 
           (userProfile?.role === 'teacher' && homework.createdBy === userProfile.id);
  };

  if (!userProfile) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-white/5" />
        
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
                <FileText className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Compiti</h1>
                <p className="text-blue-100 mt-1">
                {userProfile.role === 'student'
                  ? 'I tuoi compiti assegnati' 
                  : preselectedClassName 
                    ? `Compiti per ${preselectedClassName}`
                    : 'Gestisci i compiti assegnati agli studenti'
                }
              </p>
            </div>
          </div>
          
            <div className="flex items-center gap-2 mt-8">
              {returnTo === 'classes' && (
                <Button
                  variant="outline"
                  onClick={() => navigate('/admin/classes')}
                  leftIcon={<ArrowLeft className="h-4 w-4" />}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
                >
                  Torna alla Gestione Classi
                </Button>
              )}
              {(userProfile.role === 'teacher' || userProfile.role === 'admin') && (
                <Link to="/homework/new">
                  <Button
                    leftIcon={<Plus className="h-4 w-4" />}
                    className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
                  >
                    Nuovo Compito
                  </Button>
                </Link>
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
            <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

        {/* Compact Filters Bar */}
        <div className="mb-6 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
              {/* Class Selection */}
              {(userProfile.role === 'admin' || (userProfile.role === 'teacher' && teacherClasses.length > 1)) && (
                <div className="lg:w-64">
                  <div className="relative">
                    <select
                      className="w-full appearance-none bg-gradient-to-r from-blue-50 to-indigo-50 border-0 rounded-xl py-3 pl-4 pr-10 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={selectedClass}
                      onChange={handleClassChange}
                    >
                      <option value="">🏫 Tutte le classi</option>
                      {userProfile.role === 'admin' 
                        ? Object.values(classes).map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))
                        : teacherClasses.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.isTemporary ? '(Supplenza)' : ''}
                            </option>
                          ))
                      }
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Status Filter */}
              <div className="lg:w-48">
                <div className="relative">
                  <select
                    className="w-full appearance-none bg-slate-50 border-0 rounded-xl py-3 pl-4 pr-10 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  >
                    <option value="all">📋 Tutti gli stati</option>
                    <option value="active">✅ Attivi</option>
                    <option value="today">⏰ Scadenza oggi</option>
                    <option value="overdue">⚠️ Scaduti</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>
              
              {/* Month Navigation */}
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateMonth('prev')}
                  className="h-8 w-8 p-0 hover:bg-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-semibold text-slate-700 px-3 min-w-[140px] text-center">
                  {format(currentMonth, 'MMMM yyyy', { locale: it }).replace(/^\w/, c => c.toUpperCase())}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateMonth('next')}
                  className="h-8 w-8 p-0 hover:bg-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              {/* View Toggle */}
              <div className="flex items-center bg-slate-50 rounded-xl p-1">
                <Button
                  variant={!calendarView ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setCalendarView(false)}
                  className={`h-8 px-3 text-xs font-medium transition-all ${!calendarView ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                >
                  <BookOpenText className="h-3 w-3 mr-1" />
                  Lista
                </Button>
                <Button
                  variant={calendarView ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setCalendarView(true)}
                  className={`h-8 px-3 text-xs font-medium transition-all ${calendarView ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Calendario
                </Button>
              </div>
            </div>

            {/* Search and Sort */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cerca per titolo o descrizione..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Additional Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSortChange('title')}
                  className="whitespace-nowrap"
                  leftIcon={<ArrowUpDown className="h-4 w-4" />}
                  rightIcon={sortField === 'title' ? (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  ) : undefined}
                >
                  Titolo
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSortChange('dueDate')}
                  className="whitespace-nowrap"
                  leftIcon={<Calendar className="h-4 w-4" />}
                  rightIcon={sortField === 'dueDate' ? (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  ) : undefined}
                >
                  Scadenza
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSortChange('className')}
                  className="whitespace-nowrap"
                  leftIcon={<School className="h-4 w-4" />}
                  rightIcon={sortField === 'className' ? (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  ) : undefined}
                >
                  Classe
                </Button>
              </div>
          </div>
        </div>

        {/* Action Button Below Filters */}
      
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-light">Caricamento dei compiti...</p>
        </div>
      ) : (
        <>
          {calendarView ? (
            <div className="mb-8 bg-white/80 backdrop-blur-md border border-white/20 shadow-lg rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 p-6">
                <h3 className="flex items-center text-gray-900 text-lg font-semibold">
                  <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                  Calendario Compiti - {format(currentMonth, 'MMMM yyyy', { locale: it }).replace(/^\w/, c => c.toUpperCase())}
                </h3>
              </div>
              <div className="p-6">
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
                    const homeworksForDay = getHomeworksForDay(date);
                    const hasHomeworks = homeworksForDay.length > 0;
                    const isCurrentDay = isToday(date);
                    
                    return (
                      <div
                        key={index}
                        className={`
                          relative p-2 min-h-[100px] border rounded-lg transition-all
                          ${!isCurrentMonth ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-white border-gray-200'}
                          ${isCurrentDay ? 'ring-2 ring-blue-500' : ''}
                          ${hasHomeworks ? 'hover:shadow-md' : ''}
                        `}
                      >
                        <div className="flex justify-between items-start">
                          <div className="text-sm font-medium">
                            {format(date, 'd')}
                          </div>
                        </div>
                        
                        {hasHomeworks && isCurrentMonth && (
                          <div className="mt-2 space-y-1">
                            {homeworksForDay.slice(0, 2).map((homework, idx) => {
                              const status = getHomeworkStatus(homework);
                              return (
                                <div 
                                  key={idx} 
                                  className={`text-xs p-1 rounded truncate ${
                                    status.status === 'overdue' ? 'bg-red-100 text-red-800' : 
                                    status.status === 'today' || status.status === 'soon' ? 'bg-amber-100 text-amber-800' : 
                                    status.status === 'submitted' ? 'bg-green-100 text-green-800' : 
                                    'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {homework.title}
                                </div>
                              );
                            })}
                            {homeworksForDay.length > 2 && (
                              <div className="text-xs text-blue-600 font-medium">
                                +{homeworksForDay.length - 2} altri
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            filteredHomeworks.length > 0 ? (
              <div className="space-y-6">
          {filteredHomeworks.map((homework) => {
            const status = getHomeworkStatus(homework);
            const isExpanded = expandedHomework === homework.id;
            const canEdit = canEditHomework(homework);
            
            return (
              <div 
                key={homework.id}
                className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* Card Header */}
                <div 
                  className="cursor-pointer p-6 hover:bg-slate-50/50 transition-colors"
                  onClick={() => setExpandedHomework(isExpanded ? null : homework.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`h-10 w-10 rounded-xl text-white flex items-center justify-center shadow-sm ${
                          status.status === 'overdue' ? 'bg-gradient-to-br from-red-500 to-red-600' : 
                          status.status === 'today' || status.status === 'soon' ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 
                          status.status === 'submitted' ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 
                          'bg-gradient-to-br from-blue-500 to-indigo-600'
                        }`}>
                          <div className="flex items-center justify-center w-full h-full">
                            {getStatusIcon(status.status)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-slate-900 truncate">{homework.title}</h3>
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${status.color}`}>
                            {status.label}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">{formatDueDate(homework.dueDate)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <School className="h-4 w-4 text-emerald-500" />
                          <span>{homework.className || classes[homework.classId]?.name || 'Classe non trovata'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4 text-purple-500" />
                          <span>{homework.teacherName || 'Insegnante non specificato'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Link to={`/homework/${homework.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditHomework(homework);
                            }}
                            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteHomework(homework.id);
                            }}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedHomework(isExpanded ? null : homework.id);
                        }}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
                      >
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-slate-200 p-6 bg-slate-50/30">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-2">Descrizione</h4>
                        <p className="text-slate-700 whitespace-pre-line">{homework.description}</p>
                      </div>
                      
                      {homework.attachmentUrls && homework.attachmentUrls.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-3">Allegati</h4>
                          <div className="space-y-2">
                            {homework.attachmentUrls.map((url, index) => (
                              <a
                                key={index}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-200 transition-colors"
                              >
                                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <span className="font-medium text-slate-900">Allegato {index + 1}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex justify-end pt-2">
                        <Link to={`/homework/${homework.id}`}>
                          <Button
                            variant="outline"
                            rightIcon={<ExternalLink className="h-4 w-4" />}
                            className="bg-white hover:bg-slate-50"
                          >
                            Vedi dettagli completi
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
          <div className="p-12 text-center">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <h3 className="text-2xl font-light text-gray-900 mb-3">Nessun compito trovato</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-8">
              {searchQuery || statusFilter !== 'all'
                ? 'Nessun risultato per i filtri selezionati. Prova a modificare i criteri di ricerca.'
                : userProfile.role === 'student'
                  ? (!userProfile.classId 
                    ? 'Non sei assegnato ad alcuna classe.'
                    : 'Non ci sono compiti assegnati in questo momento.')
                  : 'Non hai ancora assegnato alcun compito.'
              }
            </p>
            {(userProfile.role === 'teacher' || userProfile.role === 'admin') && !searchQuery && statusFilter === 'all' && (
              <Link to="/homework/new">
                <Button leftIcon={<Plus className="h-4 w-4" />} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
                  Assegna un compito
                </Button>
              </Link>
            )}
          </div>
        </div>
            )
          )}
        </>
      )}

      {/* Edit Homework Dialog */}
      <EditHomeworkDialog
        homework={editingHomework}
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingHomework(null);
        }}
        onUpdate={handleHomeworkUpdate}
      />
      </div>
    </div>
  );
};