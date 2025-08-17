import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  FileText, 
  Download, 
  Upload, 
  BookOpen,
  Target,
  ClipboardList,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { HomeworkSubmissionDialog } from '../../components/homework/HomeworkSubmissionDialog';
import { Lesson, Homework, LessonMaterial, HomeworkSubmission } from '../../types';

export const LessonDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [materials, setMaterials] = useState<LessonMaterial[]>([]);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, HomeworkSubmission>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);

  useEffect(() => {
    const fetchLessonDetails = async () => {
      if (!id || !userProfile) return;

      setIsLoading(true);
      try {
        // Fetch lesson details
        const lessonDoc = await getDoc(doc(db, 'lessons', id));
        if (lessonDoc.exists()) {
          const data = lessonDoc.data();
          setLesson({
            ...data,
            id: lessonDoc.id,
            date: data.date?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date()
          } as Lesson);

          // Fetch materials for this lesson
          if (data.materials && data.materials.length > 0) {
            const materialsQuery = query(
              collection(db, 'materials'),
              where('__name__', 'in', data.materials)
            );
            const materialsDocs = await getDocs(materialsQuery);
            const lessonMaterials = materialsDocs.docs.map(doc => {
              const materialData = doc.data();
              return {
                ...materialData,
                id: doc.id,
                createdAt: materialData.createdAt?.toDate() || new Date()
              } as LessonMaterial;
            });
            setMaterials(lessonMaterials);
          }

          // Fetch homeworks for this lesson
          const homeworksQuery = query(
            collection(db, 'homework'),
            where('lessonId', '==', id)
          );
          const homeworksDocs = await getDocs(homeworksQuery);
          const lessonHomeworks = homeworksDocs.docs.map(doc => {
            const homeworkData = doc.data();
            return {
              ...homeworkData,
              id: doc.id,
              dueDate: homeworkData.dueDate?.toDate() || null
            } as Homework;
          });
          setHomeworks(lessonHomeworks);

          // If student, fetch their submissions for these homeworks
          if (userProfile.role === 'student' && lessonHomeworks.length > 0) {
            const homeworkIds = lessonHomeworks.map(hw => hw.id);
            const submissionsQuery = query(
              collection(db, 'homeworkSubmissions'),
              where('studentId', '==', userProfile.id),
              where('homeworkId', 'in', homeworkIds)
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
          }
        }
      } catch (error) {
        console.error('Error fetching lesson details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLessonDetails();
  }, [id, userProfile]);

  const handleSubmitHomework = (homework: Homework) => {
    setSelectedHomework(homework);
    setIsSubmissionDialogOpen(true);
  };

  const handleSubmissionComplete = () => {
    // Refresh the page to show the new submission
    window.location.reload();
  };

  const formatDate = (date: Date | null): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return 'Data non valida';
    }
    return format(date, 'd MMMM yyyy', { locale: it });
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

  if (isLoading) {
    return (
      <PageContainer>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Caricamento dettagli lezione...</p>
        </div>
      </PageContainer>
    );
  }

  if (!lesson) {
    return (
      <PageContainer title="Lezione non trovata">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">La lezione richiesta non è stata trovata.</p>
            <Button onClick={() => navigate('/lessons')} className="mt-4">
              Torna alle Lezioni
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={lesson.title}
      description={`Lezione del ${formatDate(lesson.date)}`}
      actions={
        <Button
          variant="outline"
          onClick={() => navigate('/lessons')}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Torna alle Lezioni
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Lesson Details */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="h-5 w-5 mr-2 text-primary-600" />
              {lesson.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Descrizione</h4>
                <p className="text-gray-700">{lesson.description}</p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Data: {formatDate(lesson.date)}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <User className="h-4 w-4 mr-2" />
                  <span>Insegnante: {lesson.teacherName}</span>
                </div>
              </div>
            </div>

            {/* Topics */}
            {lesson.topics && lesson.topics.length > 0 && (
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
          </CardContent>
        </Card>

        {/* Materials */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-secondary-600" />
              Materiali Didattici ({materials.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {materials.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {materials.map(material => (
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
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nessun materiale didattico associato a questa lezione.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Homeworks */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center">
              <ClipboardList className="h-5 w-5 mr-2 text-accent-600" />
              Compiti Assegnati ({homeworks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {homeworks.length > 0 ? (
              <div className="space-y-4">
                {homeworks.map(homework => {
                  const isStudent = userProfile?.role === 'student';
                  const status = isStudent ? getHomeworkStatus(homework) : null;
                  
                  return (
                    <div key={homework.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <h5 className="font-medium text-gray-900">{homework.title}</h5>
                            {isStudent && status && (
                              <span className={`ml-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                                {status.icon}
                                <span className="ml-1">{status.text}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{homework.description}</p>
                          <p className="text-sm text-gray-500">
                            Scadenza: {formatDate(homework.dueDate)}
                          </p>
                          
                          {isStudent && submissions[homework.id] && (
                            <div className="mt-3 p-3 bg-success-50 rounded-lg">
                              <p className="text-sm text-success-700">
                                ✓ Consegnato il {formatDate(submissions[homework.id].submittedAt)}
                                {submissions[homework.id].status === 'graded' && submissions[homework.id].grade && (
                                  <span className="ml-2 font-medium">- Voto: {submissions[homework.id].grade}/10</span>
                                )}
                              </p>
                              {submissions[homework.id].feedback && (
                                <p className="text-sm text-success-600 mt-1">
                                  Feedback: {submissions[homework.id].feedback}
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
                          
                          {isStudent && !submissions[homework.id] && (
                            <Button
                              size="sm"
                              onClick={() => handleSubmitHomework(homework)}
                              leftIcon={<Upload className="h-4 w-4" />}
                              variant={homework.dueDate && homework.dueDate < new Date() ? "outline" : "primary"}
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
            ) : (
              <div className="text-center py-8">
                <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nessun compito associato a questa lezione.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Submission Dialog */}
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