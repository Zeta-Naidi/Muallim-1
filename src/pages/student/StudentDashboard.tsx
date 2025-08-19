import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { 
  BookOpen, 
  ClipboardList, 
  FileText, 
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Star,
  Target,
  Award,
  BarChart3
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, isWithinInterval, isBefore } from 'date-fns';
import { it } from 'date-fns/locale';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Homework, Lesson, LessonMaterial, Attendance, HomeworkSubmission, Class, User } from '../../types';

export const StudentDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [myClass, setMyClass] = useState<Class | null>(null);
  const [recentHomework, setRecentHomework] = useState<Homework[]>([]);
  const [recentLessons, setRecentLessons] = useState<Lesson[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Record<string, HomeworkSubmission>>({});
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<Homework[]>([]);
  const [myAttendance, setMyAttendance] = useState<Attendance[]>([]);
  const [recentMaterials, setRecentMaterials] = useState<LessonMaterial[]>([]);
  const [studentStats, setStudentStats] = useState({
    attendanceRate: 0,
    completedHomework: 0,
    pendingHomework: 0,
    averageGrade: 0,
    totalLessons: 0,
    materialsAccessed: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (!userProfile || userProfile.role !== 'student' || !userProfile.classId) return;
      
      setIsLoading(true);
      try {
        // Fetch student's class
        const classQuery = query(
          collection(db, 'classes'),
          where('__name__', '==', userProfile.classId)
        );
        const classDocs = await getDocs(classQuery);
        if (!classDocs.empty) {
          setMyClass({ ...classDocs.docs[0].data(), id: classDocs.docs[0].id } as Class);
        }

        // Fetch homework for student's class
        const homeworkQuery = query(
          collection(db, 'homework'),
          where('classId', '==', userProfile.classId),
          orderBy('dueDate', 'desc'),
          limit(10)
        );
        const homeworkDocs = await getDocs(homeworkQuery);
        const homework = homeworkDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            dueDate: data.dueDate?.toDate() || null,
            createdAt: data.createdAt?.toDate() || new Date()
          } as Homework;
        });
        setRecentHomework(homework);

        // Fetch student's submissions
        const submissionsQuery = query(
          collection(db, 'homeworkSubmissions'),
          where('studentId', '==', userProfile.id)
        );
        const submissionsDocs = await getDocs(submissionsQuery);
        const submissionsMap: Record<string, HomeworkSubmission> = {};
        let totalGrades = 0;
        let gradeCount = 0;

        submissionsDocs.docs.forEach(doc => {
          const data = doc.data();
          const submission = {
            ...data,
            id: doc.id,
            submittedAt: data.submittedAt?.toDate() || new Date(),
            gradedAt: data.gradedAt?.toDate() || null
          } as HomeworkSubmission;
          submissionsMap[submission.homeworkId] = submission;
          
          if (submission.grade && submission.status === 'graded') {
            totalGrades += submission.grade;
            gradeCount++;
          }
        });
        setMySubmissions(submissionsMap);

        // Fetch recent lessons
        const lessonsQuery = query(
          collection(db, 'lessons'),
          where('classId', '==', userProfile.classId),
          orderBy('date', 'desc'),
          limit(5)
        );
        const lessonsDocs = await getDocs(lessonsQuery);
        const lessons = lessonsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date?.toDate() || new Date()
          } as Lesson;
        });
        setRecentLessons(lessons);

        // Fetch recent materials
        const materialsQuery = query(
          collection(db, 'materials'),
          where('classId', '==', userProfile.classId),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const materialsDocs = await getDocs(materialsQuery);
        const materials = materialsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate() || new Date()
          } as LessonMaterial;
        });
        setRecentMaterials(materials);

        // Fetch student's attendance
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('studentId', '==', userProfile.id),
          orderBy('date', 'desc')
        );
        const attendanceDocs = await getDocs(attendanceQuery);
        const attendance = attendanceDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date?.toDate() || new Date()
          } as Attendance;
        });
        setMyAttendance(attendance);

        // Calculate upcoming deadlines (next 7 days)
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const upcoming = homework.filter(hw => 
          hw.dueDate && 
          hw.dueDate >= now && 
          hw.dueDate <= nextWeek &&
          !submissionsMap[hw.id]
        ).sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
        setUpcomingDeadlines(upcoming);

        // Calculate statistics
        const presentCount = attendance.filter(record => record.status === 'present').length;
        const totalAttendance = attendance.length;
        const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

        const completedHomework = Object.keys(submissionsMap).length;
        const pendingHomework = homework.filter(hw => 
          hw.dueDate && hw.dueDate >= now && !submissionsMap[hw.id]
        ).length;

        const averageGrade = gradeCount > 0 ? Math.round((totalGrades / gradeCount) * 10) / 10 : 0;

        setStudentStats({
          attendanceRate,
          completedHomework,
          pendingHomework,
          averageGrade,
          totalLessons: lessons.length,
          materialsAccessed: materials.length
        });

      } catch (error) {
        console.error('Error fetching student data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudentData();
  }, [userProfile]);

  const formatDate = (date: Date | null): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return 'Data non valida';
    }
    return format(date, 'd MMMM yyyy', { locale: it });
  };

  const getHomeworkStatus = (homework: Homework) => {
    const submission = mySubmissions[homework.id];
    if (submission) {
      if (submission.status === 'graded') {
        return { status: 'graded', color: 'bg-success-100 text-success-800', text: `Valutato (${submission.grade}/10)` };
      }
      return { status: 'submitted', color: 'bg-blue-100 text-blue-800', text: 'Consegnato' };
    }
    
    if (homework.dueDate && isBefore(homework.dueDate, new Date())) {
      return { status: 'overdue', color: 'bg-error-100 text-error-800', text: 'Scaduto' };
    }
    
    return { status: 'pending', color: 'bg-amber-100 text-amber-800', text: 'Da consegnare' };
  };

  if (!userProfile || userProfile.role !== 'student') {
    return (
      <PageContainer title="Accesso non autorizzato">
        <p>Non hai i permessi per accedere a questa pagina.</p>
      </PageContainer>
    );
  }

  // Gender-based welcome message
  const getWelcomeMessage = (user: User): string => {
    const greeting = user.gender === 'female' ? 'Benvenuta' : 'Benvenuto';
    return `${greeting}, ${user.displayName}`;
  };

  if (!userProfile.classId) {
    return (
      <PageContainer
        title={getWelcomeMessage(userProfile)}
        description="Dashboard Studente"
      >
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Classe non assegnata</h3>
            <p className="text-gray-500">
              Non sei ancora stato assegnato a una classe. Contatta l'amministratore per essere assegnato.
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={getWelcomeMessage(userProfile)}
      description={`Dashboard Studente${myClass ? ` - ${myClass.name}` : ''}`}
    >
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Caricamento dei dati...</p>
        </div>
      ) : (
        <>
          {/* Student Performance Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card variant="elevated" className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-success-100 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-success-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{studentStats.attendanceRate}%</div>
                <div className="text-sm text-gray-600">Tasso Presenze</div>
              </CardContent>
            </Card>

            <Card variant="elevated" className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center">
                  <Star className="h-6 w-6 text-primary-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {studentStats.averageGrade > 0 ? studentStats.averageGrade : '--'}
                </div>
                <div className="text-sm text-gray-600">Media Voti</div>
              </CardContent>
            </Card>

            <Card variant="elevated" className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-secondary-100 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-secondary-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{studentStats.completedHomework}</div>
                <div className="text-sm text-gray-600">Compiti Completati</div>
              </CardContent>
            </Card>

            <Card variant="elevated" className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{studentStats.pendingHomework}</div>
                <div className="text-sm text-gray-600">Compiti in Sospeso</div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Link to="/lessons">
              <Card variant="bordered" className="hover:shadow-md transition-shadow h-full cursor-pointer">
                <CardContent className="flex items-center p-6">
                  <div className="p-3 rounded-full bg-primary-100 text-primary-800 mr-4">
                    <BookOpen className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Le Mie Lezioni</h3>
                    <p className="text-sm text-gray-500">Visualizza lezioni</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            
            <Link to="/homework">
              <Card variant="bordered" className="hover:shadow-md transition-shadow h-full cursor-pointer">
                <CardContent className="flex items-center p-6">
                  <div className="p-3 rounded-full bg-secondary-100 text-secondary-800 mr-4">
                    <ClipboardList className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Compiti</h3>
                    <p className="text-sm text-gray-500">Gestisci compiti</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            
            <Link to="/materials">
              <Card variant="bordered" className="hover:shadow-md transition-shadow h-full cursor-pointer">
                <CardContent className="flex items-center p-6">
                  <div className="p-3 rounded-full bg-accent-100 text-accent-800 mr-4">
                    <FileText className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Materiali</h3>
                    <p className="text-sm text-gray-500">Risorse didattiche</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            
            <Link to="/my-attendance">
              <Card variant="bordered" className="hover:shadow-md transition-shadow h-full cursor-pointer">
                <CardContent className="flex items-center p-6">
                  <div className="p-3 rounded-full bg-indigo-100 text-indigo-800 mr-4">
                    <Calendar className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Presenze</h3>
                    <p className="text-sm text-gray-500">Le mie presenze</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Academic Progress */}
            <Card variant="elevated">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Award className="h-5 w-5 mr-2 text-emerald-600" />
                  I Miei Progressi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Compiti completati:</span>
                    <span className="font-semibold">{studentStats.completedHomework}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Media voti:</span>
                    <span className="font-semibold">
                      {studentStats.averageGrade > 0 ? `${studentStats.averageGrade}/10` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Tasso presenze:</span>
                    <span className="font-semibold">{studentStats.attendanceRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-emerald-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${studentStats.attendanceRate}%` }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Deadlines */}
            <Card variant="elevated">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-amber-600" />
                  Scadenze Prossime
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingDeadlines.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingDeadlines.slice(0, 3).map((homework) => (
                      <div key={homework.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{homework.title}</p>
                          <p className="text-sm text-gray-600">{homework.className}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-amber-700">
                            {formatDate(homework.dueDate)}
                          </p>
                          <div className="flex items-center text-xs text-amber-600">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Scadenza
                          </div>
                        </div>
                      </div>
                    ))}
                    {upcomingDeadlines.length > 3 && (
                      <Link to="/homework">
                        <Button variant="outline" size="sm" fullWidth>
                          Vedi Tutti ({upcomingDeadlines.length})
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 italic text-center py-4">
                    Nessuna scadenza imminente. Ottimo lavoro! 🎉
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Recent Homework */}
            <Card variant="elevated">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ClipboardList className="h-5 w-5 mr-2 text-secondary-600" />
                  Compiti Recenti
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentHomework.length > 0 ? (
                  <div className="space-y-4">
                    {recentHomework.slice(0, 4).map((homework) => {
                      const status = getHomeworkStatus(homework);
                      return (
                        <div key={homework.id} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{homework.title}</p>
                              <p className="text-sm text-gray-500 mt-1">
                                Scadenza: {formatDate(homework.dueDate)}
                              </p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                              {status.text}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <Link to="/homework">
                      <Button variant="outline" size="sm" fullWidth>
                        Vedi Tutti i Compiti
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <p className="text-gray-500 italic text-center py-4">
                    Nessun compito assegnato al momento.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Recent Lessons */}
            <Card variant="elevated">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BookOpen className="h-5 w-5 mr-2 text-accent-600" />
                  Lezioni Recenti
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentLessons.length > 0 ? (
                  <div className="space-y-4">
                    {recentLessons.slice(0, 4).map((lesson) => (
                      <div key={lesson.id} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0">
                        <p className="font-medium text-gray-900">{lesson.title}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {formatDate(lesson.date)} - {lesson.teacherName}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {lesson.topics.slice(0, 2).map((topic, index) => (
                            <span key={index} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                              {topic}
                            </span>
                          ))}
                          {lesson.topics.length > 2 && (
                            <span className="text-xs text-gray-500">
                              +{lesson.topics.length - 2} altri
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    <Link to="/lessons">
                      <Button variant="outline" size="sm" fullWidth>
                        Vedi Tutte le Lezioni
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <p className="text-gray-500 italic text-center py-4">
                    Nessuna lezione registrata di recente.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  );
};