import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  Users, 
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
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Class, Homework, Lesson, LessonMaterial, Attendance, HomeworkSubmission } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

export const TeacherDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [myClasses, setMyClasses] = useState<Class[]>([]);
  const [recentHomework, setRecentHomework] = useState<Homework[]>([]);
  const [recentLessons, setRecentLessons] = useState<Lesson[]>([]);
  const [recentMaterials, setRecentMaterials] = useState<LessonMaterial[]>([]);
  const [teacherStats, setTeacherStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    activeHomework: 0,
    completedLessons: 0,
    materialsUploaded: 0,
    averageAttendance: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchTeacherData = async () => {
      if (!userProfile || userProfile.role !== 'teacher') return;
      
      setIsLoading(true);
      try {
        // Fetch teacher's classes (regular)
        const classesQuery = query(
          collection(db, 'classes'),
          where('teacherId', '==', userProfile.id)
        );
        const classesDocs = await getDocs(classesQuery);
        let teacherClasses = classesDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));

        // Today window
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Fetch today's approved substitutions for this teacher
        const subsQuery = query(
          collection(db, 'substitutions'),
          where('teacherId', '==', userProfile.id),
          where('status', 'in', ['approved', 'assigned']),
          where('date', '>=', todayStart),
          where('date', '<=', todayEnd)
        );
        const subsDocs = await getDocs(subsQuery);
        const subClassIds = subsDocs.docs.map(d => (d.data() as any).classId).filter(Boolean);
        if (subClassIds.length > 0) {
          const uniqueIds = Array.from(new Set(subClassIds));
          const temporaryClasses: Class[] = [];
          // Firestore 'in' supports up to 10 values; batch if needed
          for (let i = 0; i < uniqueIds.length; i += 10) {
            const batchIds = uniqueIds.slice(i, i + 10);
            const tempClassesQuery = query(
              collection(db, 'classes'),
              where('__name__', 'in', batchIds)
            );
            const tempClassesDocs = await getDocs(tempClassesQuery);
            temporaryClasses.push(
              ...tempClassesDocs.docs.map(doc => ({
                ...doc.data(),
                id: doc.id,
                isTemporary: true
              } as Class))
            );
          }
          // Merge and de-duplicate by id
          const merged: Record<string, Class> = {};
          for (const c of [...teacherClasses, ...temporaryClasses]) merged[c.id] = c;
          teacherClasses = Object.values(merged);
        }
        
        setMyClasses(teacherClasses);

        // Get all class IDs for queries
        const allClassIds = teacherClasses.map(c => c.id);

        if (allClassIds.length > 0) {
          // Fetch recent homework
          const homeworkQuery = query(
            collection(db, 'homework'),
            where('createdBy', '==', userProfile.id),
            orderBy('dueDate', 'desc'),
            limit(5)
          );
          const homeworkDocs = await getDocs(homeworkQuery);
          const homework = homeworkDocs.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              dueDate: data.dueDate?.toDate() || null
            } as Homework;
          });
          setRecentHomework(homework);

          // Fetch recent lessons
          const lessonsQuery = query(
            collection(db, 'lessons'),
            where('createdBy', '==', userProfile.id),
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
            where('createdBy', '==', userProfile.id),
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

          // Calculate total students
          const studentsQuery = allClassIds.length > 0 ? query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            where('classId', 'in', allClassIds)
          ) : query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            where('classId', '==', 'nonExistentClassId')
          );
          const studentsDocs = await getDocs(studentsQuery);
          const totalStudents = studentsDocs.docs.length;

          // Calculate attendance rate
          const attendanceQuery = allClassIds.length > 0 ? query(
            collection(db, 'attendance'),
            where('classId', 'in', allClassIds)
          ) : query(
            collection(db, 'attendance'),
            where('classId', '==', 'nonExistentClassId')
          );
          const attendanceDocs = await getDocs(attendanceQuery);
          const attendanceRecords = attendanceDocs.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              date: data.date?.toDate() || new Date()
            } as Attendance;
          });

          const presentCount = attendanceRecords.filter(record => record.status === 'present').length;
          const totalRecords = attendanceRecords.length;
          const averageAttendance = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

          setTeacherStats({
            totalClasses: teacherClasses.length,
            totalStudents,
            activeHomework: homework.filter(hw => hw.dueDate && hw.dueDate >= new Date()).length,
            completedLessons: lessons.length,
            materialsUploaded: materials.length,
            averageAttendance
          });
        }

      } catch (error) {
        console.error('Error fetching teacher data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeacherData();
  }, [userProfile]);

  const formatDate = (date: Date | null): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return 'Data non valida';
    }
    return format(date, 'd MMMM yyyy', { locale: it });
  };

  if (!userProfile || userProfile.role !== 'teacher') {
    return (
      <PageContainer title="Accesso non autorizzato">
        <p>Non hai i permessi per accedere a questa pagina.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={`Benvenuto, ${userProfile.displayName}`}
      description="Dashboard Insegnante"
    >
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-6 p-4 rounded-xl flex items-center ${
              message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-3 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Caricamento dei dati...</p>
        </div>
      ) : (
        <>
          {/* Teacher Performance Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card variant="elevated" className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{teacherStats.totalStudents}</div>
                <div className="text-sm text-gray-600">Studenti Totali</div>
              </CardContent>
            </Card>

            <Card variant="elevated" className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-success-100 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-success-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{teacherStats.averageAttendance}%</div>
                <div className="text-sm text-gray-600">Tasso Presenze</div>
              </CardContent>
            </Card>

            <Card variant="elevated" className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-secondary-100 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-secondary-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{teacherStats.totalClasses}</div>
                <div className="text-sm text-gray-600">Classi Gestite</div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Link to="/teacher/classes">
              <Card variant="bordered" className="hover:shadow-md transition-shadow h-full cursor-pointer">
                <CardContent className="flex items-center p-6">
                  <div className="p-3 rounded-full bg-primary-100 text-primary-800 mr-4">
                    <Users className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Le Mie Classi</h3>
                    <p className="text-sm text-gray-500">Gestisci classi e studenti</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            
            <Link to="/attendance">
              <Card variant="bordered" className="hover:shadow-md transition-shadow h-full cursor-pointer">
                <CardContent className="flex items-center p-6">
                  <div className="p-3 rounded-full bg-secondary-100 text-secondary-800 mr-4">
                    <Calendar className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Presenze</h3>
                    <p className="text-sm text-gray-500">Registra presenze</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            
            <Link to="/homework">
              <Card variant="bordered" className="hover:shadow-md transition-shadow h-full cursor-pointer">
                <CardContent className="flex items-center p-6">
                  <div className="p-3 rounded-full bg-accent-100 text-accent-800 mr-4">
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
                  <div className="p-3 rounded-full bg-indigo-100 text-indigo-800 mr-4">
                    <FileText className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Materiali</h3>
                    <p className="text-sm text-gray-500">Carica materiali</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                    {recentHomework.map((homework) => (
                      <div key={homework.id} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0">
                        <p className="font-medium text-gray-900">{homework.title}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Scadenza: {formatDate(homework.dueDate)} - {homework.className}
                        </p>
                      </div>
                    ))}
                    <Link to="/homework">
                      <Button variant="outline" size="sm" fullWidth>
                        Vedi Tutti i Compiti
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <p className="text-gray-500 italic text-center py-4">
                    Nessun compito assegnato di recente.
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
                    {recentLessons.map((lesson) => (
                      <div key={lesson.id} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0">
                        <p className="font-medium text-gray-900">{lesson.title}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {formatDate(lesson.date)}
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