import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { collection, getDocs, query, where, updateDoc, doc, orderBy, deleteDoc } from 'firebase/firestore';
import { format, isWeekend, startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths, isSameDay, isToday } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  Calendar, 
  BookOpen, 
  BookOpenText, 
  ArrowLeft,
  Plus, 
  X, 
  AlertCircle, 
  CheckCircle, 
  Search, 
  Edit, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
  FileText,
  ClipboardList,
  Target,
  Eye,
  Download,
  School,
  Filter,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Clock,
  Paperclip
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { CreateLessonDialog } from '../../components/dialogs/CreateLessonDialog';
import { EditLessonDialog } from '../../components/dialogs/EditLessonDialog';
import { Class, Lesson, LessonMaterial, Homework } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

export const LessonTracking: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const preselectedClassId = queryParams.get('classId');
  const preselectedClassName = queryParams.get('className');
  const returnTo = queryParams.get('returnTo');
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>(preselectedClassId || '');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [filteredLessons, setFilteredLessons] = useState<Lesson[]>([]);
  const [materials, setMaterials] = useState<Record<string, LessonMaterial[]>>({});
  const [homeworks, setHomeworks] = useState<Record<string, Homework[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [sortField, setSortField] = useState<'title' | 'date'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [calendarView, setCalendarView] = useState(false);

  // Fetch available classes based on user role
  useEffect(() => {
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

        if (classQuery) {
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
          
          setClasses(fetchedClasses);
          
          // Automatically select class for teachers with single class
          if (fetchedClasses.length === 1) {
            setSelectedClass(fetchedClasses[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching classes:', error);
        setMessage({ type: 'error', text: 'Error fetching classes' });
      }
    };
    
    fetchClasses();
  }, [userProfile]);

  // Fetch lessons for selected class
  useEffect(() => {
    const fetchLessons = async () => {
      if (!selectedClass) return;
      
      setIsLoading(true);
      
      try {
        let lessonsQuery;
        
        if (userProfile?.role === 'teacher') {
          // Teachers can only see their own lessons
          lessonsQuery = query(
            collection(db, 'lessons'),
            where('classId', '==', selectedClass),
            where('createdBy', '==', userProfile.id),
            orderBy('date', 'desc')
          );
        } else {
          // Admin sees all lessons for the class
          lessonsQuery = query(
            collection(db, 'lessons'),
            where('classId', '==', selectedClass),
            orderBy('date', 'desc')
          );
        }
        
        const lessonDocs = await getDocs(lessonsQuery);
        const fetchedLessons = lessonDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date?.toDate() || null
          } as Lesson;
        });
        
        setLessons(fetchedLessons);
        applyFiltersAndSort(fetchedLessons);

        // Fetch materials for each lesson
        const materialsByLesson: Record<string, LessonMaterial[]> = {};
        for (const lesson of fetchedLessons) {
          if (lesson.materials && lesson.materials.length > 0) {
            const materialsQuery = query(
              collection(db, 'materials'),
              where('__name__', 'in', lesson.materials)
            );
            const materialsDocs = await getDocs(materialsQuery);
            const lessonMaterials = materialsDocs.docs.map(doc => {
              const data = doc.data();
              return {
                ...data,
                id: doc.id,
                createdAt: data.createdAt?.toDate() || new Date()
              } as LessonMaterial;
            });
            materialsByLesson[lesson.id] = lessonMaterials;
          }
        }
        setMaterials(materialsByLesson);

        // Fetch homeworks for each lesson
        const homeworksByLesson: Record<string, Homework[]> = {};
        for (const lesson of fetchedLessons) {
          const homeworksQuery = query(
            collection(db, 'homework'),
            where('lessonId', '==', lesson.id)
          );
          const homeworksDocs = await getDocs(homeworksQuery);
          const lessonHomeworks = homeworksDocs.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              dueDate: data.dueDate?.toDate() || null
            } as Homework;
          });
          if (lessonHomeworks.length > 0) {
            homeworksByLesson[lesson.id] = lessonHomeworks;
          }
        }
        setHomeworks(homeworksByLesson);
      } catch (error) {
        console.error('Error fetching lessons:', error);
        setMessage({ type: 'error', text: 'Error fetching lessons' });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLessons();
  }, [selectedClass, userProfile]);

  const applyFiltersAndSort = (lessonList: Lesson[] = lessons) => {
    let filtered = [...lessonList];
    
    // Filter by month
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    filtered = filtered.filter(lesson => 
      lesson.date && isSameMonth(lesson.date, currentMonth)
    );

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lesson =>
        lesson.title.toLowerCase().includes(query) ||
        lesson.description.toLowerCase().includes(query) ||
        lesson.topics.some(topic => topic.toLowerCase().includes(query))
      );
    }

    // Filter by topic
    if (selectedTopic) {
      filtered = filtered.filter(lesson =>
        lesson.topics.some(topic => topic.toLowerCase().includes(selectedTopic.toLowerCase()))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortField === 'title') {
        return sortDirection === 'asc' 
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title);
      } else if (sortField === 'date') {
        if (!a.date) return sortDirection === 'asc' ? 1 : -1;
        if (!b.date) return sortDirection === 'asc' ? -1 : 1;
        return sortDirection === 'asc' 
          ? a.date.getTime() - b.date.getTime()
          : b.date.getTime() - a.date.getTime();
      }
      return 0;
    });

    setFilteredLessons(filtered);
  };

  useEffect(() => {
    applyFiltersAndSort();
  }, [lessons, currentMonth, searchQuery, selectedTopic, sortField, sortDirection]);

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedClass(e.target.value);
    setExpandedLesson(null);
  };

  const handleEditLesson = (lesson: Lesson) => {
    // Only allow editing if user is admin or the teacher who created the lesson
    if (!canEditLessons || (userProfile?.role === 'teacher' && lesson.createdBy !== userProfile.id)) return;

    setEditingLesson(lesson);
    setIsEditDialogOpen(true);
  };

  const handleDeleteLesson = async (lessonId: string, lesson?: Lesson) => {
    // Only allow deletion if user is admin or the teacher who created the lesson
    if (!canEditLessons || (userProfile?.role === 'teacher' && lesson && lesson.createdBy !== userProfile.id)) return;

    if (!window.confirm('Sei sicuro di voler eliminare questa lezione?')) return;

    try {
      await deleteDoc(doc(db, 'lessons', lessonId));
      setLessons(prev => prev.filter(l => l.id !== lessonId));
      setFilteredLessons(prev => prev.filter(l => l.id !== lessonId));
      setMessage({ type: 'success', text: 'Lezione eliminata con successo' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting lesson:', error);
      setMessage({ type: 'error', text: 'Errore nell\'eliminazione della lezione' });
    }
  };

  const handleLessonUpdate = (updatedLesson: Lesson) => {
    setLessons(prev => prev.map(lesson => 
      lesson.id === updatedLesson.id ? updatedLesson : lesson
    ));
    applyFiltersAndSort();
    setMessage({ type: 'success', text: 'Lezione aggiornata con successo' });
    
    // Clear success message after 3 seconds
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateLessonSuccess = (newLesson: Lesson) => {
    setLessons(prev => [newLesson, ...prev]);
    if (newLesson.date && isSameMonth(newLesson.date, currentMonth)) {
      setFilteredLessons(prev => [newLesson, ...prev]);
    }
    setMessage({ type: 'success', text: 'Lezione creata con successo' });
    
    // Clear success message after 3 seconds
    setTimeout(() => setMessage(null), 3000);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      return direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1);
    });
  };

  const handleSortChange = (field: 'title' | 'date') => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return format(date, 'd MMMM yyyy', { locale: it });
  };

  const getAllTopics = () => {
    const topics = new Set<string>();
    lessons.forEach(lesson => {
      if (lesson.topics && Array.isArray(lesson.topics)) {
        lesson.topics.forEach(topic => topics.add(topic));
      }
    });
    return Array.from(topics).sort();
  };

  // Check if user can edit lessons (admin or teacher of the selected class)
  const canEditLessons = userProfile?.role === 'admin' || 
    (userProfile?.role === 'teacher' && classes.some(c => c.id === selectedClass && c.teacherId === userProfile.id));

  const canEditSpecificLesson = (lesson: Lesson): boolean => {
    return userProfile?.role === 'admin' || 
           (userProfile?.role === 'teacher' && lesson.createdBy === userProfile.id);
  };

  const selectedClassName = classes.find(c => c.id === selectedClass)?.name || '';
  const allTopics = getAllTopics();

  // Calendar view helpers
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const firstDayOfWeek = monthStart.getDay();
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1));

  const calendarDays = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    calendarDays.push(date);
  }

  const getLessonsForDay = (date: Date) => {
    return filteredLessons.filter(lesson => 
      lesson.date && isSameDay(lesson.date, date)
    );
  };

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
                <BookOpen className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  {preselectedClassName ? `Lezioni - ${preselectedClassName}` : "Gestione Lezioni"}
                </h1>
                <p className="text-blue-100 mt-1">
                  {userProfile?.role === 'admin' 
                    ? preselectedClassName 
                      ? `Gestisci le lezioni per ${preselectedClassName}` 
                      : 'Gestisci tutte le lezioni del sistema' 
                    : 'Crea e gestisci le lezioni delle tue classi'}
                </p>
              </div>
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
              {canEditLessons && (
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  leftIcon={<Plus className="h-4 w-4" />}
                  className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
                >
                  Nuova Lezione
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence>
          {message && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className={`mb-6 p-4 rounded-xl flex items-center ${
                message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 mr-3 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
              )}
              <span>{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compact Filters Bar */}
        <div className="mb-8 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
              {/* Class Selection */}
              <div className="lg:w-64">
                <div className="relative">
                  <select
                    className="w-full appearance-none bg-gradient-to-r from-blue-50 to-indigo-50 border-0 rounded-xl py-3 pl-4 pr-10 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    value={selectedClass}
                    onChange={handleClassChange}
                    disabled={isLoading}
                  >
                    <option value="">🏫 Seleziona una classe</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
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
                  disabled={isLoading}
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
                  disabled={isLoading}
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

            {/* Search and Topic Filter */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cerca per titolo, descrizione o argomento..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
              
              <div className="sm:w-48">
                <div className="relative">
                  <select
                    className="w-full appearance-none bg-slate-50 border-0 rounded-xl py-3 pl-4 pr-10 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                  >
                    <option value="">📚 Tutti gli argomenti</option>
                    {allTopics.map(topic => (
                      <option key={topic} value={topic}>{topic}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Additional Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSortChange('title')}
                className="flex-1 whitespace-nowrap"
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
                onClick={() => handleSortChange('date')}
                className="flex-1 whitespace-nowrap"
                leftIcon={<Calendar className="h-4 w-4" />}
                rightIcon={sortField === 'date' ? (
                  sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                ) : undefined}
              >
                Data
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCalendarView(!calendarView)}
                className="whitespace-nowrap"
                leftIcon={calendarView ? <BookOpenText className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
              >
                {calendarView ? 'Lista' : 'Calendario'}
              </Button>
            </div>
          </div>
        </div>
        
        {selectedClass ? (
          isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 font-light">Caricamento lezioni...</p>
            </div>
          ) : (
            <>
              {calendarView ? (
                <Card className="mb-8 bg-white/80 backdrop-blur-md border border-white/20 shadow-lg rounded-xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                    <CardTitle className="flex items-center text-gray-900">
                      <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                      Calendario Lezioni - {format(currentMonth, 'MMMM yyyy', { locale: it })}
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
                        const isWeekendDay = isWeekend(date);
                        const lessonsForDay = getLessonsForDay(date);
                        const hasLessons = lessonsForDay.length > 0;
                        const isCurrentDay = isToday(date);
                        
                        return (
                          <div
                            key={index}
                            className={`
                              relative p-2 min-h-[100px] border rounded-lg cursor-pointer transition-all
                              ${!isCurrentMonth ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-white border-gray-200'}
                              ${isCurrentDay ? 'ring-2 ring-primary-500' : ''}
                              ${isWeekendDay && isCurrentMonth ? 'bg-blue-50 hover:bg-blue-100' : ''}
                              ${hasLessons ? 'hover:shadow-md' : ''}
                            `}
                            onClick={() => isCurrentMonth && isWeekendDay && !hasLessons && setIsCreateDialogOpen(true)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="text-sm font-medium">
                                {format(date, 'd')}
                              </div>
                              
                              {isCurrentMonth && isWeekendDay && !hasLessons && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsCreateDialogOpen(true);
                                  }}
                                >
                                  <Plus className="h-4 w-4 text-blue-500" />
                                </Button>
                              )}
                            </div>
                            
                            {hasLessons && isCurrentMonth && (
                              <div className="mt-2 space-y-1">
                                {lessonsForDay.slice(0, 2).map((lesson, idx) => (
                                  <div key={idx} className="text-xs p-1 bg-blue-100 text-blue-800 rounded truncate">
                                    {lesson.title}
                                  </div>
                                ))}
                                {lessonsForDay.length > 2 && (
                                  <div className="text-xs text-blue-600 font-medium">
                                    +{lessonsForDay.length - 2} altre
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                filteredLessons.length > 0 ? (
                  <div className="space-y-6">
                    {filteredLessons.map((lesson) => {
                      const isExpanded = expandedLesson === lesson.id;
                      const lessonMaterials = materials[lesson.id] || [];
                      const lessonHomeworks = homeworks[lesson.id] || [];
                      
                      return (
                        <motion.div
                          key={lesson.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                            {/* Card Header */}
                            <div 
                              className="cursor-pointer p-6 hover:bg-slate-50/50 transition-colors"
                              onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-sm">
                                      <BookOpen className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="text-lg font-semibold text-slate-900 truncate">{lesson.title}</h3>
                                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{lesson.description}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-4 w-4 text-blue-500" />
                                      <span className="font-medium">{formatDate(lesson.date)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Users className="h-4 w-4 text-emerald-500" />
                                      <span>{lesson.teacherName || 'Insegnante non specificato'}</span>
                                    </div>
                                    {lesson.topics && lesson.topics.length > 0 && (
                                      <div className="flex items-center gap-1">
                                        <BookOpen className="h-4 w-4 text-purple-500" />
                                        <span>{lesson.topics.length} argomenti</span>
                                      </div>
                                    )}
                                    {lessonMaterials.length > 0 && (
                                      <div className="flex items-center gap-1">
                                        <Paperclip className="h-4 w-4 text-amber-500" />
                                        <span>{lessonMaterials.length} materiali</span>
                                      </div>
                                    )}
                                    {lessonHomeworks.length > 0 && (
                                      <div className="flex items-center gap-1">
                                        <FileText className="h-4 w-4 text-red-500" />
                                        <span>{lessonHomeworks.length} compiti</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-3">
                                  <div className="flex items-center gap-2">
                                    {lesson.topics && lesson.topics.slice(0, 3).map((topic, index) => (
                                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        {topic}
                                      </span>
                                    ))}
                                    {lesson.topics && lesson.topics.length > 3 && (
                                      <span className="text-xs text-slate-500">+{lesson.topics.length - 3} altri</span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <Link to={`/lessons/${lesson.id}`}>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </Link>
                                    {canEditSpecificLesson(lesson) && (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingLesson(lesson);
                                            setIsEditDialogOpen(true);
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
                                            handleDeleteLesson(lesson.id, lesson);
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
                                        setExpandedLesson(isExpanded ? null : lesson.id);
                                      }}
                                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
                                    >
                                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Expanded Content */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className="border-t border-slate-200 p-6 bg-slate-50/30"
                                >
                                  <div className="space-y-6">
                                    {/* Topics Details */}
                                    {lesson.topics && lesson.topics.length > 0 && (
                                      <div>
                                        <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                          <BookOpenText className="h-4 w-4 text-purple-600" />
                                          Argomenti Trattati
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                          {lesson.topics.map((topic, index) => (
                                            <div key={index} className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200">
                                              <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                                              <span className="text-sm font-medium text-slate-700">{topic}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Materials */}
                                    {lessonMaterials.length > 0 && (
                                      <div>
                                        <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                          <Paperclip className="h-4 w-4 text-amber-600" />
                                          Materiali Didattici
                                        </h4>
                                        <div className="space-y-2">
                                          {lessonMaterials.map((material) => (
                                            <div key={material.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-amber-200 transition-colors">
                                              <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                                                  <FileText className="h-4 w-4" />
                                                </div>
                                                <span className="font-medium text-slate-900">{material.title}</span>
                                              </div>
                                              <a
                                                href={material.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
                                              >
                                                Visualizza
                                              </a>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Homeworks */}
                                    {lessonHomeworks.length > 0 && (
                                      <div>
                                        <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                          <FileText className="h-4 w-4 text-red-600" />
                                          Compiti Assegnati
                                        </h4>
                                        <div className="space-y-2">
                                          {lessonHomeworks.map((homework) => (
                                            <div key={homework.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-red-200 transition-colors">
                                              <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
                                                  <FileText className="h-4 w-4" />
                                                </div>
                                                <div>
                                                  <div className="font-medium text-slate-900">{homework.title}</div>
                                                  <div className="text-sm text-slate-500">
                                                    Scadenza: {homework.dueDate ? format(homework.dueDate, 'd MMMM yyyy', { locale: it }) : 'Non specificata'}
                                                  </div>
                                                </div>
                                              </div>
                                              <Link
                                                to={`/homeworks/${homework.id}`}
                                                className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                                              >
                                                Visualizza
                                              </Link>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-xl overflow-hidden">
                    <CardContent className="p-12 text-center">
                      <BookOpenText className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                      <h3 className="text-2xl font-light text-gray-900 mb-3">
                        {searchQuery || selectedTopic 
                          ? 'Nessuna lezione trovata' 
                          : 'Nessuna lezione per questo mese'
                        }
                      </h3>
                      <p className="text-gray-600 max-w-md mx-auto mb-8">
                        {searchQuery || selectedTopic
                          ? 'Prova a modificare i filtri di ricerca.'
                          : `Non ci sono lezioni programmate per ${format(currentMonth, 'MMMM yyyy', { locale: it })}.`
                        }
                      </p>
                      {canEditLessons && (
                        <Button
                          onClick={() => setIsCreateDialogOpen(true)}
                          className="anime-button"
                          leftIcon={<Plus className="h-4 w-4" />}
                        >
                          Crea Nuova Lezione
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              )}
            </>
          )
        ) : (
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-xl overflow-hidden">
            <CardContent className="p-12 text-center">
              <School className="h-16 w-16 text-gray-400 mx-auto mb-6" />
              <h3 className="text-2xl font-light text-gray-900 mb-3">Seleziona una classe</h3>
              <p className="text-gray-600 max-w-md mx-auto mb-8">
                Seleziona una classe per visualizzare e gestire le lezioni.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Create Lesson Dialog */}
        <CreateLessonDialog
          classId={selectedClass}
          className={selectedClassName}
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          onSuccess={(newLesson) => {
            handleCreateLessonSuccess(newLesson);
            setIsCreateDialogOpen(false);
          }}
        />

        {/* Edit Lesson Dialog */}
        <EditLessonDialog
          lesson={editingLesson}
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setEditingLesson(null);
          }}
          onUpdate={handleLessonUpdate}
        />
      </div>
    </div>
  );
};