import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { format, isToday, isBefore, isAfter, addDays } from 'date-fns';
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
  Filter,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  School
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
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
        return <CheckCircle className="h-4 w-4 mr-1" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 mr-1" />;
      case 'today':
      case 'soon':
        return <Clock className="h-4 w-4 mr-1" />;
      default:
        return <CheckCircle className="h-4 w-4 mr-1" />;
    }
  };

  const canEditHomework = (homework: Homework): boolean => {
    return userProfile?.role === 'admin' || 
           (userProfile?.role === 'teacher' && homework.createdBy === userProfile.id);
  };

  if (!userProfile) return null;

  return (
    <PageContainer
      title="Compiti"
      description={
        userProfile.role === 'student'
          ? 'I tuoi compiti assegnati' 
          : preselectedClassName 
            ? `Compiti per ${preselectedClassName}`
            : 'Gestisci i compiti assegnati agli studenti'
      }
      actions={
        <>
          {returnTo === 'classes' && (
            <Button
              variant="outline"
              onClick={() => navigate('/admin/classes')}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              className="mr-2"
            >
              Torna alla Gestione Classi
            </Button>
          )}
          {(userProfile.role === 'teacher' || userProfile.role === 'admin') && (
          <Link to="/homework/new">
            <Button leftIcon={<Plus className="h-4 w-4" />} className="anime-button">
              Nuovo Compito
            </Button>
          </Link>
          )}
        </>
      }
    >
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

      {/* Filters and Search */}
      <Card variant="elevated" className="mb-6 bg-white/80 backdrop-blur-md border border-white/20 shadow-md rounded-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <CardTitle className="flex items-center text-gray-900">
            <Filter className="h-5 w-5 mr-2 text-blue-600" />
            Filtri e Ricerca
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {userProfile.role === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filtra per classe
                </label>
                <select
                  className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-3 px-4 transition-colors"
                  value={selectedClass}
                  onChange={handleClassChange}
                >
                  <option value="">Tutte le classi</option>
                  {Object.values(classes).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            
            {userProfile.role === 'teacher' && teacherClasses.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filtra per classe
                </label>
                <select
                  className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-3 px-4 transition-colors"
                  value={selectedClass}
                  onChange={handleClassChange}
                >
                  <option value="">Tutte le classi</option>
                  {teacherClasses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.isTemporary ? '(Supplenza)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className={userProfile.role === 'admin' ? 'lg:col-span-2' : 'lg:col-span-2'}>
              <Input
                label="Cerca compiti"
                placeholder="Titolo o descrizione..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="h-5 w-5" />}
                fullWidth
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtra per stato
              </label>
              <select
                className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-3 px-4 transition-colors"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">Tutti</option>
                <option value="active">Attivi</option>
                <option value="today">Scadenza oggi</option>
                <option value="overdue">Scaduti</option>
              </select>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSortChange('title')}
              leftIcon={sortField === 'title' ? (
                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
              ) : <ArrowUpDown className="h-4 w-4" />}
            >
              Titolo
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSortChange('dueDate')}
              leftIcon={sortField === 'dueDate' ? (
                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
              ) : <ArrowUpDown className="h-4 w-4" />}
            >
              Scadenza
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSortChange('className')}
              leftIcon={sortField === 'className' ? (
                sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
              ) : <ArrowUpDown className="h-4 w-4" />}
            >
              Classe
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-light">Caricamento dei compiti...</p>
        </div>
      ) : filteredHomeworks.length > 0 ? (
        <div className="space-y-6">
          {filteredHomeworks.map((homework) => {
            const status = getHomeworkStatus(homework);
            const isExpanded = expandedHomework === homework.id;
            const canEdit = canEditHomework(homework);
            
            return (
              <Card 
                key={homework.id}
                variant="bordered"
                className={`hover:shadow-md transition-shadow border-l-4 ${
                  status.status === 'overdue' ? 'border-l-error-500' : 
                  status.status === 'today' || status.status === 'soon' ? 'border-l-amber-500' : 
                  status.status === 'submitted' ? 'border-l-success-500' : 
                  'border-l-blue-500'
                }`}
              >
                <CardContent className="p-0">
                  <div 
                    className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedHomework(isExpanded ? null : homework.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{homework.title}</h3>
                          <div className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            {getStatusIcon(status.status)}
                            {status.label}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1 flex-shrink-0" />
                            <span>Scadenza: {formatDueDate(homework.dueDate)}</span>
                          </div>
                          
                          <div className="flex items-center">
                            <School className="h-4 w-4 mr-1 flex-shrink-0" />
                            <span>
                              Classe: {homework.className || classes[homework.classId]?.name || 'Classe non trovata'}
                            </span>
                          </div>

                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-1 flex-shrink-0" />
                            <span>
                              Assegnato da: {homework.teacherName || 'Insegnante non specificato'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Link to={`/homework/${homework.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={(e) => e.stopPropagation()}
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
                              className="text-gray-600 hover:text-gray-800 hover:bg-gray-50"
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
                              className="text-error-600 hover:text-error-800 hover:bg-error-50"
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
                          className="text-gray-400"
                        >
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-0 border-t border-gray-100">
                      <div className="pt-4">
                        <h4 className="font-medium text-gray-900 mb-2">Descrizione</h4>
                        <p className="text-gray-700 mb-4 whitespace-pre-line">{homework.description}</p>
                        
                        {homework.attachmentUrls && homework.attachmentUrls.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-medium text-gray-900 mb-2">Allegati</h4>
                            <div className="flex flex-wrap gap-2">
                              {homework.attachmentUrls.map((url, index) => (
                                <a
                                  key={index}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center px-3 py-2 rounded-md text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Allegato {index + 1}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex justify-end">
                          <Link to={`/homework/${homework.id}`}>
                            <Button
                              variant="outline"
                              rightIcon={<ExternalLink className="h-4 w-4" />}
                            >
                              Vedi dettagli completi
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
          <CardContent className="p-12 text-center">
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
                <Button leftIcon={<Plus className="h-4 w-4" />} className="anime-button">
                  Assegna un compito
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
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
    </PageContainer>
  );
};