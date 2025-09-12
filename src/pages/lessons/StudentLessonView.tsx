import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  BookOpen, 
  FileText, 
  ClipboardList, 
  Download, 
  Upload, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  User,
  Clock,
  Target,
  Search,
  Eye,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { HomeworkSubmissionDialog } from '../../components/homework/HomeworkSubmissionDialog';
import { Lesson, Homework, LessonMaterial, HomeworkSubmission } from '../../types';

export const StudentLessonView: React.FC = () => {
  const { userProfile } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [filteredLessons, setFilteredLessons] = useState<Lesson[]>([]);
  const [homeworks, setHomeworks] = useState<Record<string, Homework[]>>({});
  const [materials, setMaterials] = useState<Record<string, LessonMaterial[]>>({});
  const [submissions, setSubmissions] = useState<Record<string, HomeworkSubmission>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?.classId) return;

      setIsLoading(true);
      try {
        // Fetch lessons for student's class
        const lessonsQuery = query(
          collection(db, 'lessons'),
          where('classId', '==', userProfile.classId),
          orderBy('date', 'desc')
        );
        const lessonsDocs = await getDocs(lessonsQuery);
        const fetchedLessons = lessonsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date?.toDate() || new Date(),
            materials: data.materials || [],
            homeworks: data.homeworks || []
          } as Lesson;
        });
        setLessons(fetchedLessons);
        setFilteredLessons(fetchedLessons);

        // Fetch all homeworks for the class
        const homeworksQuery = query(
          collection(db, 'homework'),
          where('classId', '==', userProfile.classId),
          orderBy('dueDate', 'desc')
        );
        const homeworksDocs = await getDocs(homeworksQuery);
        const allHomeworks = homeworksDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            dueDate: data.dueDate?.toDate() || new Date()
          } as Homework;
        });

        // Group homeworks by lesson
        const homeworksByLesson: Record<string, Homework[]> = {};
        allHomeworks.forEach(homework => {
          if (homework.lessonId) {
            if (!homeworksByLesson[homework.lessonId]) {
              homeworksByLesson[homework.lessonId] = [];
            }
            homeworksByLesson[homework.lessonId].push(homework);
          }
        });
        setHomeworks(homeworksByLesson);

        // Fetch all materials for the class
        const materialsQuery = query(
          collection(db, 'materials'),
          where('classId', '==', userProfile.classId)
        );
        const materialsDocs = await getDocs(materialsQuery);
        const allMaterials = materialsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate() || new Date()
          } as LessonMaterial;
        });

        // Group materials by lesson
        const materialsByLesson: Record<string, LessonMaterial[]> = {};
        allMaterials.forEach(material => {
          if (material.lessonId) {
            if (!materialsByLesson[material.lessonId]) {
              materialsByLesson[material.lessonId] = [];
            }
            materialsByLesson[material.lessonId].push(material);
          }
        });
        setMaterials(materialsByLesson);

        // Fetch student's homework submissions
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

      } catch (error) {
        console.error('Error fetching student lesson data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userProfile]);

  useEffect(() => {
    let filtered = [...lessons];

    // Filter by month
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    filtered = filtered.filter(lesson => 
      lesson.date >= monthStart && lesson.date <= monthEnd
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

    setFilteredLessons(filtered);
  }, [lessons, currentMonth, searchQuery, selectedTopic]);

  const handleSubmitHomework = (homework: Homework) => {
    setSelectedHomework(homework);
    setIsSubmissionDialogOpen(true);
  };

  const handleSubmissionComplete = () => {
    // Refresh submissions data
    if (userProfile?.classId) {
      const fetchSubmissions = async () => {
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
      };
      fetchSubmissions();
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      return direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1);
    });
  };

  const formatDate = (date: Date): string => {
    return format(date, 'd MMMM yyyy', { locale: it });
  };

  const formatTime = (date: Date): string => {
    return format(date, 'HH:mm', { locale: it });
  };

  const getAllTopics = () => {
    const topics = new Set<string>();
    lessons.forEach(lesson => {
      lesson.topics.forEach(topic => topics.add(topic));
    });
    return Array.from(topics).sort();
  };

  const getHomeworkStatus = (homework: Homework) => {
    const submission = submissions[homework.id];
    if (submission) {
      if (submission.status === 'graded') {
        return { 
          status: 'graded', 
          color: 'bg-success-100 text-success-800 border-success-200', 
          text: `Valutato (${submission.grade}/10)`,
          icon: <CheckCircle className="h-4 w-4" />
        };
      }
      return { 
        status: 'submitted', 
        color: 'bg-blue-100 text-blue-800 border-blue-200', 
        text: 'Consegnato',
        icon: <Clock className="h-4 w-4" />
      };
    }
    
    if (homework.dueDate && homework.dueDate < new Date()) {
      return { 
        status: 'overdue', 
        color: 'bg-error-100 text-error-800 border-error-200', 
        text: 'Scaduto',
        icon: <AlertTriangle className="h-4 w-4" />
      };
    }
    
    return { 
      status: 'pending', 
      color: 'bg-amber-100 text-amber-800 border-amber-200', 
      text: 'Da consegnare',
      icon: <Clock className="h-4 w-4" />
    };
  };

  if (!userProfile?.classId) {
    return (
      <PageContainer title="Lezioni">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">Non sei assegnato a nessuna classe.</p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const allTopics = getAllTopics();
  const currentMonthLessons = lessons.filter(lesson => isSameMonth(lesson.date, currentMonth));
  const totalHomeworks = Object.values(homeworks).flat().length;
  const completedHomeworks = Object.values(submissions).filter(sub => sub.status === 'graded').length;

  return (
    <PageContainer
      title="Le Mie Lezioni"
      description="Esplora le lezioni, i compiti e i materiali didattici"
    >
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Caricamento delle lezioni...</p>
        </div>
      ) : (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card variant="bordered">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary-600">{lessons.length}</div>
                <div className="text-sm text-gray-600">Lezioni Totali</div>
              </CardContent>
            </Card>
            
            <Card variant="bordered">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-secondary-600">{currentMonthLessons.length}</div>
                <div className="text-sm text-gray-600">Questo Mese</div>
              </CardContent>
            </Card>
            
            <Card variant="bordered">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-accent-600">{totalHomeworks}</div>
                <div className="text-sm text-gray-600">Compiti Assegnati</div>
              </CardContent>
            </Card>
            
            <Card variant="bordered">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-success-600">{completedHomeworks}</div>
                <div className="text-sm text-gray-600">Compiti Completati</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Navigation */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                {/* Month Navigation */}
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('prev')}
                    leftIcon={<ChevronLeft className="h-4 w-4" />}
                  >
                    Precedente
                  </Button>
                  
                  <div className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
                    {format(currentMonth, 'MMMM yyyy', { locale: it })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('next')}
                    rightIcon={<ChevronRight className="h-4 w-4" />}
                  >
                    Successivo
                  </Button>
                </div>

                {/* Search */}
                <div className="flex-1">
                  <Input
                    placeholder="Cerca lezioni..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="h-5 w-5" />}
                  />
                </div>

                {/* Topic Filter */}
                <div className="min-w-[200px]">
                  <select
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm bg-white border p-2"
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                  >
                    <option value="">Tutti gli argomenti</option>
                    {allTopics.map(topic => (
                      <option key={topic} value={topic}>{topic}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lessons List */}
          {filteredLessons.length > 0 ? (
            <div className="space-y-6">
              {filteredLessons.map(lesson => {
                const lessonHomeworks = homeworks[lesson.id] || [];
                const lessonMaterials = materials[lesson.id] || [];
                const isExpanded = expandedLesson === lesson.id;
                
                return (
                  <Card key={lesson.id} variant="elevated" className="overflow-hidden">
                    <CardHeader className="cursor-pointer" onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center">
                            <BookOpen className="h-5 w-5 mr-2 text-primary-600" />
                            {lesson.title}
                          </CardTitle>
                          <div className="flex items-center mt-2 space-x-4 text-sm text-gray-500">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              {formatDate(lesson.date)}
                            </div>
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              {lesson.teacherName}
                            </div>
                            {lessonHomeworks.length > 0 && (
                              <div className="flex items-center">
                                <ClipboardList className="h-4 w-4 mr-1" />
                                {lessonHomeworks.length} compito/i
                              </div>
                            )}
                            {lessonMaterials.length > 0 && (
                              <div className="flex items-center">
                                <FileText className="h-4 w-4 mr-1" />
                                {lessonMaterials.length} materiale/i
                              </div>
                            )}
                          </div>
                        </div>
                        <Link to={`/lessons/${lesson.id}`}>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </CardHeader>
                    
                    {isExpanded && (
                      <CardContent className="border-t border-gray-200 space-y-6">
                        {/* Description */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Descrizione</h4>
                          <p className="text-gray-700">{lesson.description}</p>
                        </div>

                        {/* Topics */}
                        {lesson.topics.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">Argomenti Trattati</h4>
                            <div className="flex flex-wrap gap-2">
                              {lesson.topics.map((topic, index) => (
                                <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800">
                                  <Target className="h-3 w-3 mr-1" />
                                  {topic}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Materials */}
                        {lessonMaterials.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                              <FileText className="h-4 w-4 mr-2" />
                              Materiali Didattici ({lessonMaterials.length})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {lessonMaterials.map(material => (
                                <div key={material.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <h5 className="font-medium text-gray-900">{material.title}</h5>
                                      <p className="text-sm text-gray-500 mt-1">{material.description}</p>
                                    </div>
                                    <a
                                      href={material.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="ml-3 text-primary-600 hover:text-primary-700"
                                    >
                                      <Download className="h-5 w-5" />
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Homework */}
                        {lessonHomeworks.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                              <ClipboardList className="h-4 w-4 mr-2" />
                              Compiti Assegnati ({lessonHomeworks.length})
                            </h4>
                            <div className="space-y-4">
                              {lessonHomeworks.map(homework => {
                                const submission = submissions[homework.id];
                                const status = getHomeworkStatus(homework);
                                const isOverdue = homework.dueDate < new Date() && !submission;
                                
                                return (
                                  <div key={homework.id} className="p-4 border border-gray-200 rounded-lg">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center mb-2">
                                          <h5 className="font-medium text-gray-900">{homework.title}</h5>
                                          <span className={`ml-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                                            {status.icon}
                                            <span className="ml-1">{status.text}</span>
                                          </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">{homework.description}</p>
                                        <p className="text-sm text-gray-500">
                                          Scadenza: {formatDate(homework.dueDate)}
                                          {isOverdue && (
                                            <span className="ml-2 text-error-600 font-medium">Scaduto</span>
                                          )}
                                        </p>
                                        
                                        {submission && (
                                          <div className="mt-3 p-3 bg-success-50 rounded-lg">
                                            <p className="text-sm text-success-700">
                                              ✓ Consegnato il {formatDate(submission.submittedAt)}
                                              {submission.status === 'graded' && submission.grade && (
                                                <span className="ml-2 font-medium">- Voto: {submission.grade}/10</span>
                                              )}
                                            </p>
                                            {submission.feedback && (
                                              <p className="text-sm text-success-600 mt-1">
                                                Feedback: {submission.feedback}
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      
                                      <div className="flex items-center space-x-2">
                                        <Link to={`/homework/${homework.id}`}>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                          >
                                            Dettagli
                                          </Button>
                                        </Link>
                                        
                                        {!submission && (
                                          <Button
                                            size="sm"
                                            onClick={() => handleSubmitHomework(homework)}
                                            leftIcon={<Upload className="h-4 w-4" />}
                                            variant={isOverdue ? "outline" : "primary"}
                                          >
                                            Consegna
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {lessonMaterials.length === 0 && lessonHomeworks.length === 0 && (
                          <div className="text-center py-8">
                            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">
                              Nessun materiale o compito associato a questa lezione.
                            </p>
                          </div>
                        )}

                        <div className="flex justify-center pt-4 border-t border-gray-200">
                          <Link to={`/lessons/${lesson.id}`}>
                            <Button>
                              Visualizza Dettagli Completi
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  {searchQuery || selectedTopic 
                    ? 'Nessuna lezione trovata' 
                    : 'Nessuna lezione per questo mese'
                  }
                </h3>
                <p className="text-gray-500">
                  {searchQuery || selectedTopic
                    ? 'Prova a modificare i filtri di ricerca.'
                    : `Non ci sono lezioni programmate per ${format(currentMonth, 'MMMM yyyy', { locale: it })}.`
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <HomeworkSubmissionDialog
        homework={selectedHomework}
        isOpen={isSubmissionDialogOpen}
        onClose={() => {
          setIsSubmissionDialogOpen(false);
          setSelectedHomework(null);
        }}
        onSubmissionComplete={handleSubmissionComplete}
      />
    </PageContainer>
  );
};