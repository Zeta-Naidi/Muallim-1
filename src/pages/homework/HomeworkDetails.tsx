import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  ArrowLeft, Calendar, User, FileText, Download, Upload, 
  CheckCircle, Clock, AlertTriangle, Star, MessageSquare,
  Save, X
} from 'lucide-react';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { HomeworkSubmissionDialog } from '../../components/homework/HomeworkSubmissionDialog';
import { Homework, HomeworkSubmission } from '../../types';

export const HomeworkDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [homework, setHomework] = useState<Homework | null>(null);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [mySubmission, setMySubmission] = useState<HomeworkSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState<HomeworkSubmission | null>(null);
  const [gradeValue, setGradeValue] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isGrading, setIsGrading] = useState(false);

  useEffect(() => {
    const fetchHomeworkDetails = async () => {
      if (!id || !userProfile) return;

      setIsLoading(true);
      try {
        // Fetch homework details
        const homeworkDoc = await getDoc(doc(db, 'homework', id));
        if (homeworkDoc.exists()) {
          const data = homeworkDoc.data();
          setHomework({
            ...data,
            id: homeworkDoc.id,
            dueDate: data.dueDate?.toDate() || null,
            createdAt: data.createdAt?.toDate() || new Date()
          } as Homework);
        }

        // Fetch submissions based on user role
        if (userProfile.role === 'student') {
          // Students see only their own submission
          const submissionQuery = query(
            collection(db, 'homeworkSubmissions'),
            where('homeworkId', '==', id),
            where('studentId', '==', userProfile.id)
          );
          const submissionDocs = await getDocs(submissionQuery);
          if (!submissionDocs.empty) {
            const data = submissionDocs.docs[0].data();
            setMySubmission({
              ...data,
              id: submissionDocs.docs[0].id,
              submittedAt: data.submittedAt?.toDate() || new Date(),
              gradedAt: data.gradedAt?.toDate() || null
            } as HomeworkSubmission);
          }
        } else if (userProfile.role === 'teacher' || userProfile.role === 'admin') {
          // Teachers and admins see all submissions
          const submissionsQuery = query(
            collection(db, 'homeworkSubmissions'),
            where('homeworkId', '==', id)
          );
          const submissionsDocs = await getDocs(submissionsQuery);
          const allSubmissions = submissionsDocs.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              submittedAt: data.submittedAt?.toDate() || new Date(),
              gradedAt: data.gradedAt?.toDate() || null
            } as HomeworkSubmission;
          });
          setSubmissions(allSubmissions);
        }
      } catch (error) {
        console.error('Error fetching homework details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHomeworkDetails();
  }, [id, userProfile]);

  const handleSubmissionComplete = () => {
    // Refresh the page to show the new submission
    window.location.reload();
  };

  const handleGradeSubmission = async () => {
    if (!gradingSubmission || !userProfile) return;
    
    const grade = parseFloat(gradeValue);
    if (isNaN(grade) || grade < 0 || grade > 10) {
      alert('Il voto deve essere un numero tra 0 e 10');
      return;
    }

    setIsGrading(true);
    try {
      await updateDoc(doc(db, 'homeworkSubmissions', gradingSubmission.id), {
        grade,
        feedback: feedback.trim(),
        status: 'graded',
        gradedBy: userProfile.id,
        gradedAt: new Date()
      });

      // Update local state
      setSubmissions(prev => prev.map(sub => 
        sub.id === gradingSubmission.id 
          ? { 
              ...sub, 
              grade, 
              feedback: feedback.trim(), 
              status: 'graded',
              gradedBy: userProfile.id,
              gradedAt: new Date()
            }
          : sub
      ));

      setGradingSubmission(null);
      setGradeValue('');
      setFeedback('');
    } catch (error) {
      console.error('Error grading submission:', error);
      alert('Errore durante la valutazione');
    } finally {
      setIsGrading(false);
    }
  };

  const startGrading = (submission: HomeworkSubmission) => {
    setGradingSubmission(submission);
    setGradeValue(submission.grade?.toString() || '');
    setFeedback(submission.feedback || '');
  };

  const cancelGrading = () => {
    setGradingSubmission(null);
    setGradeValue('');
    setFeedback('');
  };

  const formatDate = (date: Date | null): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return 'Data non valida';
    }
    return format(date, 'd MMMM yyyy HH:mm', { locale: it });
  };

  const isOverdue = homework?.dueDate && homework.dueDate < new Date();
  const canSubmit = userProfile?.role === 'student' && !mySubmission && homework?.dueDate;

  if (isLoading) {
    return (
      <PageContainer>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Caricamento dei dettagli del compito...</p>
        </div>
      </PageContainer>
    );
  }

  if (!homework) {
    return (
      <PageContainer title="Compito non trovato">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">Il compito richiesto non è stato trovato.</p>
            <Button onClick={() => navigate('/homework')} className="mt-4">
              Torna ai Compiti
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={homework.title}
      description="Dettagli del compito"
      actions={
        <Button
          variant="outline"
          onClick={() => navigate('/homework')}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Torna ai Compiti
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Homework Details */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <FileText className="h-5 w-5 mr-2 text-primary-600" />
                {homework.title}
              </span>
              {isOverdue && !mySubmission && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-error-100 text-error-800">
                  Scaduto
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Descrizione</h4>
                <p className="text-gray-700">{homework.description}</p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Scadenza: {formatDate(homework.dueDate)}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <User className="h-4 w-4 mr-2" />
                  <span>Assegnato da: {homework.teacherName}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <FileText className="h-4 w-4 mr-2" />
                  <span>Classe: {homework.className}</span>
                </div>
              </div>
            </div>

            {/* Attachments */}
            {homework.attachmentUrls && homework.attachmentUrls.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Allegati</h4>
                <div className="space-y-2">
                  {homework.attachmentUrls.map((url, index) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-2 rounded-md text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Allegato {index + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student Submission Section */}
        {userProfile?.role === 'student' && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="h-5 w-5 mr-2 text-secondary-600" />
                La Mia Consegna
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mySubmission ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Consegnato</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(mySubmission.submittedAt)}
                      </p>
                    </div>
                    <div className="flex items-center">
                      {mySubmission.status === 'graded' ? (
                        <div className="flex items-center">
                          <Star className="h-5 w-5 text-yellow-500 mr-2" />
                          <span className="font-bold text-lg">{mySubmission.grade}/10</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-amber-600">
                          <Clock className="h-4 w-4 mr-1" />
                          <span className="text-sm">In attesa di valutazione</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {mySubmission.submissionText && (
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Note</h5>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                        {mySubmission.submissionText}
                      </p>
                    </div>
                  )}

                  {mySubmission.submissionUrls && mySubmission.submissionUrls.length > 0 && (
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">File Consegnati</h5>
                      <div className="space-y-2">
                        {mySubmission.submissionUrls.map((url, index) => (
                          <a
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-2 rounded-md text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors mr-2"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            File {index + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {mySubmission.feedback && (
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Feedback dell'Insegnante</h5>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-blue-900">{mySubmission.feedback}</p>
                        {mySubmission.gradedAt && (
                          <p className="text-xs text-blue-600 mt-2">
                            Valutato il {formatDate(mySubmission.gradedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  {canSubmit ? (
                    <>
                      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Non hai ancora consegnato questo compito
                      </h3>
                      <p className="text-gray-500 mb-4">
                        {isOverdue 
                          ? 'Questo compito è scaduto, ma puoi ancora consegnarlo.'
                          : 'Clicca il pulsante qui sotto per consegnare il tuo lavoro.'
                        }
                      </p>
                      <Button
                        onClick={() => setIsSubmissionDialogOpen(true)}
                        leftIcon={<Upload className="h-4 w-4" />}
                        variant={isOverdue ? "outline" : "primary"}
                      >
                        Consegna Compito
                      </Button>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Compito scaduto
                      </h3>
                      <p className="text-gray-500">
                        La scadenza per questo compito è passata.
                      </p>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Teacher/Admin Submissions View */}
        {(userProfile?.role === 'teacher' || userProfile?.role === 'admin') && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle className="h-5 w-5 mr-2 text-success-600" />
                Consegne ({submissions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submissions.length > 0 ? (
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <div key={submission.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900 flex items-center">
                            {submission.studentName}
                            {submission.status === 'graded' && (
                              <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-success-100 text-success-800">
                                Valutato
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-gray-500">
                            Consegnato: {formatDate(submission.submittedAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          {submission.status === 'graded' ? (
                            <div className="flex items-center">
                              <Star className="h-4 w-4 text-yellow-500 mr-1" />
                              <span className="font-bold">{submission.grade}/10</span>
                            </div>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              In attesa
                            </span>
                          )}
                        </div>
                      </div>

                      {submission.submissionText && (
                        <div className="mb-3">
                          <p className="text-sm text-gray-700">{submission.submissionText}</p>
                        </div>
                      )}

                      {submission.submissionUrls && submission.submissionUrls.length > 0 && (
                        <div className="mb-3">
                          <div className="flex flex-wrap gap-2">
                            {submission.submissionUrls.map((url, index) => (
                              <a
                                key={index}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700 hover:bg-gray-200"
                              >
                                <>
                                  <Download className="h-3 w-3 mr-1" />
                                  File {index + 1}
                                </>
                              </a>
                            ))}
                            {submission.gradedAt && (
                              <span className="ml-2 text-xs text-gray-500">
                                ({formatDate(submission.gradedAt)})
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {submission.feedback && (
                        <div className="p-3 bg-blue-50 rounded-lg mb-3">
                          <div className="flex items-start">
                            <MessageSquare className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-blue-900">Feedback:</p>
                              <p className="text-sm text-blue-800">{submission.feedback}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Grading Interface */}
                      {gradingSubmission?.id === submission.id ? (
                        <div className="border-t border-gray-200 pt-3 mt-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Voto (0-10)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="10"
                                step="0.5"
                                value={gradeValue}
                                onChange={(e) => setGradeValue(e.target.value)}
                                placeholder="Es: 8.5"
                                className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Feedback (opzionale)
                              </label>
                              <textarea
                                className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2"
                                rows={3}
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="Commenti sulla consegna..."
                              />
                            </div>
                          </div>
                          <div className="flex justify-end space-x-2 mt-4">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={cancelGrading}
                              leftIcon={<X className="h-4 w-4" />}
                            >
                              Annulla
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={handleGradeSubmission}
                              disabled={!gradeValue || isGrading}
                              isLoading={isGrading}
                              leftIcon={<Save className="h-4 w-4" />}
                            >
                              Salva Valutazione
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-t border-gray-200 pt-3 mt-3 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startGrading(submission)}
                          >
                            {submission.status === 'graded' ? 'Modifica Voto' : 'Valuta'}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Nessuna consegna</h3>
                  <p className="text-gray-500">
                    Non ci sono ancora consegne per questo compito.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Submission Dialog */}
      <HomeworkSubmissionDialog
        homework={homework}
        isOpen={isSubmissionDialogOpen}
        onClose={() => setIsSubmissionDialogOpen(false)}
        onSubmissionComplete={handleSubmissionComplete}
      />
    </PageContainer>
  );
};