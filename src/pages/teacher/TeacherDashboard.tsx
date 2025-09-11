import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Users,
  BookOpen,
  ClipboardList,
  Calendar,
  FileText,
  TrendingUp,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer } from '../../components/layout/PageContainer';
import { Class, Homework, Lesson, LessonMaterial, Attendance } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

export const TeacherDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [, setMyClasses] = useState<Class[]>([]);
  const [recentHomework, setRecentHomework] = useState<Homework[]>([]);
  const [recentLessons, setRecentLessons] = useState<Lesson[]>([]);
  const [, setRecentMaterials] = useState<LessonMaterial[]>([]);
  const [teacherStats, setTeacherStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    activeHomework: 0,
    completedLessons: 0,
    materialsUploaded: 0,
    averageAttendance: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [message] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
          let totalStudents = 0;
          for (const teacherClass of teacherClasses) {
            const students = teacherClass.students || [];
            totalStudents += students.length;
          }

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-emerald-700">Studenti Totali</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{teacherStats.totalStudents}</div>
                <div className="mt-1 text-sm text-slate-500">Nelle tue classi</div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-amber-700">Tasso Presenze</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{teacherStats.averageAttendance}%</div>
                <div className="mt-1 text-sm text-slate-500">Media generale</div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-indigo-700">Classi Gestite</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{teacherStats.totalClasses}</div>
                <div className="mt-1 text-sm text-slate-500">Attive</div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-violet-700">Compiti Attivi</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{teacherStats.activeHomework}</div>
                <div className="mt-1 text-sm text-slate-500">In scadenza</div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
            <Link to="/teacher/classes">
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="relative">
                  <div className="mb-4">
                    <Users className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Le Mie Classi</h3>
                  <p className="text-emerald-100 text-sm">Gestisci classi e studenti</p>
                </div>
              </div>
            </Link>
            
            <Link to="/attendance">
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="relative">
                  <div className="mb-4">
                    <Calendar className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Presenze</h3>
                  <p className="text-blue-100 text-sm">Registra presenze</p>
                </div>
              </div>
            </Link>
            
            <Link to="/homework">
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="relative">
                  <div className="mb-4">
                    <ClipboardList className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Compiti</h3>
                  <p className="text-rose-100 text-sm">Gestisci compiti</p>
                </div>
              </div>
            </Link>
            
            <Link to="/materials">
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="relative">
                  <div className="mb-4">
                    <FileText className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Materiali</h3>
                  <p className="text-orange-100 text-sm">Carica materiali</p>
                </div>
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Homework */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Compiti Recenti</h3>
                </div>
              </div>
              <div className="p-6">
                {recentHomework.length > 0 ? (
                  <div className="space-y-4">
                    {recentHomework.map((homework) => (
                      <div key={homework.id} className="group rounded-xl border border-slate-100 p-4 hover:border-purple-200 hover:bg-purple-50/50 transition-all">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-slate-900 group-hover:text-purple-900">{homework.title}</h4>
                            <p className="text-sm text-slate-500 mt-1">
                              Scadenza: {formatDate(homework.dueDate)}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">{homework.className}</p>
                          </div>
                          <div className="h-2 w-2 rounded-full bg-purple-400"></div>
                        </div>
                      </div>
                    ))}
                    <Link to="/homework" className="block mt-4">
                      <div className="rounded-xl border-2 border-dashed border-purple-200 p-4 text-center hover:border-purple-300 hover:bg-purple-50/50 transition-all">
                        <span className="text-sm font-medium text-purple-600">Vedi Tutti i Compiti</span>
                      </div>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="h-12 w-12 rounded-xl bg-purple-100 text-purple-400 flex items-center justify-center mx-auto mb-3">
                      <ClipboardList className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 text-sm">Nessun compito assegnato di recente.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Lessons */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Lezioni Recenti</h3>
                </div>
              </div>
              <div className="p-6">
                {recentLessons.length > 0 ? (
                  <div className="space-y-4">
                    {recentLessons.map((lesson) => (
                      <div key={lesson.id} className="group rounded-xl border border-slate-100 p-4 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-slate-900 group-hover:text-indigo-900">{lesson.title}</h4>
                            <p className="text-sm text-slate-500 mt-1">
                              {formatDate(lesson.date)}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {lesson.topics.slice(0, 2).map((topic, index) => (
                                <span key={index} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md">
                                  {topic}
                                </span>
                              ))}
                              {lesson.topics.length > 2 && (
                                <span className="text-xs text-slate-400 px-2 py-1">
                                  +{lesson.topics.length - 2} altri
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-2 w-2 rounded-full bg-indigo-400"></div>
                        </div>
                      </div>
                    ))}
                    <Link to="/lessons" className="block mt-4">
                      <div className="rounded-xl border-2 border-dashed border-indigo-200 p-4 text-center hover:border-indigo-300 hover:bg-indigo-50/50 transition-all">
                        <span className="text-sm font-medium text-indigo-600">Vedi Tutte le Lezioni</span>
                      </div>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 text-sm">Nessuna lezione registrata di recente.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

    </PageContainer>
  );
};