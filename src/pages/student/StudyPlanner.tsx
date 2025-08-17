import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { format, addDays, startOfWeek, endOfWeek, isSameDay, parseISO, isToday, startOfDay, endOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  Calendar, 
  Clock, 
  BookOpen, 
  ClipboardList, 
  Target,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle,
  AlertTriangle,
  Edit,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  Save
} from 'lucide-react';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Homework, Lesson, HomeworkSubmission } from '../../types';

interface StudySession {
  id: string;
  title: string;
  subject: string;
  date: Date;
  duration: number; // in minutes
  completed: boolean;
  notes?: string;
  studentId: string;
  createdAt: Date;
}

interface StudyTimer {
  isRunning: boolean;
  startTime: Date | null;
  elapsedTime: number; // in seconds
  sessionTitle: string;
}

export const StudyPlanner: React.FC = () => {
  const { userProfile } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [homework, setHomework] = useState<Homework[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, HomeworkSubmission>>({});
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [studyTimer, setStudyTimer] = useState<StudyTimer>({
    isRunning: false,
    startTime: null,
    elapsedTime: 0,
    sessionTitle: ''
  });

  // Form state
  const [sessionForm, setSessionForm] = useState({
    title: '',
    subject: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    duration: 60,
    notes: ''
  });

  useEffect(() => {
    const fetchStudyData = async () => {
      if (!userProfile || userProfile.role !== 'student' || !userProfile.classId) return;
      
      setIsLoading(true);
      try {
        // Fetch upcoming homework
        const homeworkQuery = query(
          collection(db, 'homework'),
          where('classId', '==', userProfile.classId),
          where('dueDate', '>=', new Date()),
          orderBy('dueDate', 'asc')
        );
        const homeworkDocs = await getDocs(homeworkQuery);
        const homeworkList = homeworkDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            dueDate: data.dueDate?.toDate() || null
          } as Homework;
        });
        setHomework(homeworkList);

        // Fetch recent and upcoming lessons
        const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
        
        const lessonsQuery = query(
          collection(db, 'lessons'),
          where('classId', '==', userProfile.classId),
          where('date', '>=', weekStart),
          where('date', '<=', weekEnd),
          orderBy('date', 'asc')
        );
        const lessonsDocs = await getDocs(lessonsQuery);
        const lessonsList = lessonsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date?.toDate() || new Date()
          } as Lesson;
        });
        setLessons(lessonsList);

        // Fetch student submissions
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
            submittedAt: data.submittedAt?.toDate() || new Date()
          } as HomeworkSubmission;
          submissionsMap[submission.homeworkId] = submission;
        });
        setSubmissions(submissionsMap);

        // Fetch study sessions
        const sessionsQuery = query(
          collection(db, 'studySessions'),
          where('studentId', '==', userProfile.id),
          orderBy('date', 'desc')
        );
        const sessionsDocs = await getDocs(sessionsQuery);
        const sessionsList = sessionsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date()
          } as StudySession;
        });
        setStudySessions(sessionsList);

      } catch (error) {
        console.error('Error fetching study data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudyData();
  }, [userProfile, currentWeek]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (studyTimer.isRunning && studyTimer.startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - studyTimer.startTime!.getTime()) / 1000);
        setStudyTimer(prev => ({ ...prev, elapsedTime: elapsed }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [studyTimer.isRunning, studyTimer.startTime]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    if (direction === 'prev') {
      newWeek.setDate(newWeek.getDate() - 7);
    } else {
      newWeek.setDate(newWeek.getDate() + 7);
    }
    setCurrentWeek(newWeek);
  };

  const getWeekDays = () => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  };

  const getHomeworkForDay = (date: Date) => {
    return homework.filter(hw => 
      hw.dueDate && isSameDay(hw.dueDate, date) && !submissions[hw.id]
    );
  };

  const getLessonsForDay = (date: Date) => {
    return lessons.filter(lesson => isSameDay(lesson.date, date));
  };

  const getSessionsForDay = (date: Date) => {
    return studySessions.filter(session => isSameDay(session.date, date));
  };

  const handleCreateSession = async () => {
    if (!userProfile || !sessionForm.title.trim()) return;

    try {
      const newSession = {
        title: sessionForm.title.trim(),
        subject: sessionForm.subject.trim(),
        date: new Date(sessionForm.date),
        duration: sessionForm.duration,
        notes: sessionForm.notes.trim(),
        completed: false,
        studentId: userProfile.id,
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'studySessions'), newSession);
      setStudySessions(prev => [{ ...newSession, id: docRef.id }, ...prev]);
      
      // Reset form
      setSessionForm({
        title: '',
        subject: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        duration: 60,
        notes: ''
      });
      setShowNewSessionForm(false);
    } catch (error) {
      console.error('Error creating study session:', error);
    }
  };

  const handleUpdateSession = async (session: StudySession, updates: Partial<StudySession>) => {
    try {
      await updateDoc(doc(db, 'studySessions', session.id), updates);
      setStudySessions(prev => prev.map(s => 
        s.id === session.id ? { ...s, ...updates } : s
      ));
    } catch (error) {
      console.error('Error updating study session:', error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa sessione di studio?')) return;

    try {
      await deleteDoc(doc(db, 'studySessions', sessionId));
      setStudySessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (error) {
      console.error('Error deleting study session:', error);
    }
  };

  const startTimer = (title: string) => {
    setStudyTimer({
      isRunning: true,
      startTime: new Date(),
      elapsedTime: 0,
      sessionTitle: title
    });
  };

  const pauseTimer = () => {
    setStudyTimer(prev => ({ ...prev, isRunning: false }));
  };

  const resetTimer = () => {
    setStudyTimer({
      isRunning: false,
      startTime: null,
      elapsedTime: 0,
      sessionTitle: ''
    });
  };

  const saveTimerSession = async () => {
    if (!userProfile || !studyTimer.sessionTitle || studyTimer.elapsedTime < 60) return;

    try {
      const duration = Math.floor(studyTimer.elapsedTime / 60); // Convert to minutes
      const newSession = {
        title: studyTimer.sessionTitle,
        subject: 'Studio',
        date: new Date(),
        duration,
        completed: true,
        notes: `Sessione cronometrata - ${Math.floor(duration / 60)}h ${duration % 60}m`,
        studentId: userProfile.id,
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'studySessions'), newSession);
      setStudySessions(prev => [{ ...newSession, id: docRef.id }, ...prev]);
      resetTimer();
    } catch (error) {
      console.error('Error saving timer session:', error);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date): string => {
    return format(date, 'd MMMM yyyy', { locale: it });
  };

  const getDayName = (date: Date): string => {
    return format(date, 'EEEE', { locale: it });
  };

  const getUrgentHomework = () => {
    const threeDaysFromNow = addDays(new Date(), 3);
    return homework.filter(hw => 
      hw.dueDate && 
      hw.dueDate <= threeDaysFromNow && 
      hw.dueDate >= new Date() &&
      !submissions[hw.id]
    );
  };

  const getTotalStudyTime = () => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    
    return studySessions
      .filter(session => session.date >= weekStart && session.date <= weekEnd && session.completed)
      .reduce((total, session) => total + session.duration, 0);
  };

  if (!userProfile || userProfile.role !== 'student') {
    return (
      <PageContainer title="Accesso non autorizzato">
        <p>Non hai i permessi per accedere a questa pagina.</p>
      </PageContainer>
    );
  }

  if (!userProfile.classId) {
    return (
      <PageContainer title="Pianificatore Studio">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Classe non assegnata</h3>
            <p className="text-gray-500">
              Non sei ancora stato assegnato a una classe.
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const weekDays = getWeekDays();
  const urgentHomework = getUrgentHomework();
  const totalStudyTime = getTotalStudyTime();

  return (
    <PageContainer
      title="Pianificatore Studio"
      description="Organizza il tuo studio e monitora i tuoi progressi"
    >
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Caricamento pianificatore...</p>
        </div>
      ) : (
        <>
          {/* Study Timer */}
          <Card variant="elevated" className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2 text-primary-600" />
                Timer Studio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-3xl font-mono font-bold text-primary-600">
                    {formatTime(studyTimer.elapsedTime)}
                  </div>
                  {studyTimer.sessionTitle && (
                    <div className="text-sm text-gray-600">
                      {studyTimer.sessionTitle}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {!studyTimer.isRunning && studyTimer.elapsedTime === 0 && (
                    <Input
                      placeholder="Titolo sessione..."
                      value={studyTimer.sessionTitle}
                      onChange={(e) => setStudyTimer(prev => ({ ...prev, sessionTitle: e.target.value }))}
                      className="w-48"
                    />
                  )}
                  {!studyTimer.isRunning ? (
                    <Button
                      onClick={() => studyTimer.sessionTitle ? startTimer(studyTimer.sessionTitle) : null}
                      disabled={!studyTimer.sessionTitle}
                      leftIcon={<Play className="h-4 w-4" />}
                    >
                      Inizia
                    </Button>
                  ) : (
                    <Button
                      onClick={pauseTimer}
                      variant="outline"
                      leftIcon={<Pause className="h-4 w-4" />}
                    >
                      Pausa
                    </Button>
                  )}
                  {studyTimer.elapsedTime > 0 && (
                    <>
                      <Button
                        onClick={resetTimer}
                        variant="outline"
                        leftIcon={<RotateCcw className="h-4 w-4" />}
                      >
                        Reset
                      </Button>
                      {studyTimer.elapsedTime >= 60 && (
                        <Button
                          onClick={saveTimerSession}
                          leftIcon={<Save className="h-4 w-4" />}
                        >
                          Salva
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card variant="bordered">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary-600">{Math.floor(totalStudyTime / 60)}h {totalStudyTime % 60}m</div>
                <div className="text-sm text-gray-600">Studio questa settimana</div>
              </CardContent>
            </Card>
            
            <Card variant="bordered">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-secondary-600">{Object.keys(submissions).length}</div>
                <div className="text-sm text-gray-600">Compiti completati</div>
              </CardContent>
            </Card>
            
            <Card variant="bordered">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-accent-600">{urgentHomework.length}</div>
                <div className="text-sm text-gray-600">Scadenze urgenti</div>
              </CardContent>
            </Card>
          </div>

          {/* Urgent Tasks Alert */}
          {urgentHomework.length > 0 && (
            <Card variant="bordered" className="mb-6 border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mr-3 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-amber-900">Compiti Urgenti</h3>
                    <p className="text-sm text-amber-700 mt-1">
                      Hai {urgentHomework.length} compito/i in scadenza nei prossimi 3 giorni
                    </p>
                    <div className="mt-2 space-y-1">
                      {urgentHomework.map(hw => (
                        <div key={hw.id} className="text-sm text-amber-800">
                          • {hw.title} - Scadenza: {formatDate(hw.dueDate!)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Week Navigation */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek('prev')}
                  leftIcon={<ChevronLeft className="h-4 w-4" />}
                >
                  Settimana Precedente
                </Button>
                
                <h2 className="text-lg font-semibold text-gray-900">
                  {format(startOfWeek(currentWeek, { weekStartsOn: 1 }), 'd MMM', { locale: it })} - {' '}
                  {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: it })}
                </h2>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateWeek('next')}
                  rightIcon={<ChevronRight className="h-4 w-4" />}
                >
                  Settimana Successiva
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 mb-8">
            {weekDays.map((day, index) => {
              const dayHomework = getHomeworkForDay(day);
              const dayLessons = getLessonsForDay(day);
              const daySessions = getSessionsForDay(day);
              const isCurrentDay = isToday(day);
              
              return (
                <Card 
                  key={index} 
                  variant="bordered" 
                  className={`${isCurrentDay ? 'ring-2 ring-primary-500 bg-primary-50' : ''}`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      <div className="text-center">
                        <div className="font-medium capitalize">{getDayName(day)}</div>
                        <div className={`text-lg ${isCurrentDay ? 'text-primary-700' : 'text-gray-900'}`}>
                          {format(day, 'd')}
                        </div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {/* Lessons */}
                    {dayLessons.map(lesson => (
                      <div key={lesson.id} className="p-2 bg-blue-50 rounded text-xs">
                        <div className="flex items-center">
                          <BookOpen className="h-3 w-3 text-blue-600 mr-1" />
                          <span className="font-medium text-blue-900">{lesson.title}</span>
                        </div>
                      </div>
                    ))}

                    {/* Homework Due */}
                    {dayHomework.map(hw => (
                      <div key={hw.id} className="p-2 bg-amber-50 rounded text-xs">
                        <div className="flex items-center">
                          <ClipboardList className="h-3 w-3 text-amber-600 mr-1" />
                          <span className="font-medium text-amber-900">Scadenza</span>
                        </div>
                        <div className="text-amber-700 mt-1">{hw.title}</div>
                      </div>
                    ))}

                    {/* Study Sessions */}
                    {daySessions.map(session => (
                      <div key={session.id} className="p-2 bg-green-50 rounded text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Target className="h-3 w-3 text-green-600 mr-1" />
                            <span className="font-medium text-green-900">{session.title}</span>
                          </div>
                          {session.completed && (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          )}
                        </div>
                        <div className="text-green-700 mt-1">{session.duration}min</div>
                      </div>
                    ))}

                    {dayLessons.length === 0 && dayHomework.length === 0 && daySessions.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-2">
                        Nessun impegno
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Study Sessions Management */}
          <Card variant="elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Target className="h-5 w-5 mr-2 text-secondary-600" />
                  Sessioni di Studio
                </CardTitle>
                <Button
                  onClick={() => setShowNewSessionForm(true)}
                  leftIcon={<Plus className="h-4 w-4" />}
                  size="sm"
                >
                  Nuova Sessione
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showNewSessionForm && (
                <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h4 className="font-medium text-gray-900 mb-4">Nuova Sessione di Studio</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Titolo"
                      value={sessionForm.title}
                      onChange={(e) => setSessionForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Es: Studio Matematica"
                    />
                    <Input
                      label="Materia"
                      value={sessionForm.subject}
                      onChange={(e) => setSessionForm(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="Es: Matematica"
                    />
                    <Input
                      label="Data"
                      type="date"
                      value={sessionForm.date}
                      onChange={(e) => setSessionForm(prev => ({ ...prev, date: e.target.value }))}
                    />
                    <Input
                      label="Durata (minuti)"
                      type="number"
                      value={sessionForm.duration}
                      onChange={(e) => setSessionForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                      min="15"
                      step="15"
                    />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                    <textarea
                      className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2"
                      rows={2}
                      value={sessionForm.notes}
                      onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Note aggiuntive..."
                    />
                  </div>
                  <div className="flex justify-end space-x-2 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowNewSessionForm(false)}
                    >
                      Annulla
                    </Button>
                    <Button
                      onClick={handleCreateSession}
                      disabled={!sessionForm.title.trim()}
                    >
                      Crea Sessione
                    </Button>
                  </div>
                </div>
              )}

              {studySessions.length > 0 ? (
                <div className="space-y-3">
                  {studySessions.slice(0, 10).map(session => (
                    <div key={session.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <h4 className="font-medium text-gray-900">{session.title}</h4>
                          {session.completed && (
                            <CheckCircle className="h-4 w-4 text-green-600 ml-2" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {session.subject} • {formatDate(session.date)} • {session.duration} min
                        </p>
                        {session.notes && (
                          <p className="text-xs text-gray-500 mt-1">{session.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateSession(session, { completed: !session.completed })}
                        >
                          {session.completed ? 'Segna come non completato' : 'Segna come completato'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteSession(session.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Nessuna sessione di studio</h3>
                  <p className="text-gray-500">
                    Inizia a pianificare le tue sessioni di studio per organizzare meglio il tuo tempo.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  );
};