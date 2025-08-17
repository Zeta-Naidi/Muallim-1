import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Users, BookOpen, ClipboardList, FileText, Calendar, TrendingUp, UserCheck, Clock, Plus, School, GraduationCap, Eye, Mail, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StudentDetailsDialog } from '../../components/dialogs/StudentDetailsDialog';
import { Class, User, Homework, Lesson, LessonMaterial, Attendance } from '../../types';

export const ClassManagement: React.FC = () => {
  const { userProfile } = useAuth();
  const [myClasses, setMyClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [classData, setClassData] = useState<{
    students: User[];
    homework: Homework[];
    lessons: Lesson[];
    materials: LessonMaterial[];
    attendance: Attendance[];
  }>({
    students: [],
    homework: [],
    lessons: [],
    materials: [],
    attendance: []
  });
  const [classStats, setClassStats] = useState({
    totalStudents: 0,
    attendanceRate: 0,
    activeHomework: 0,
    totalLessons: 0,
    materialsCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [isStudentDetailsOpen, setIsStudentDetailsOpen] = useState(false);

  useEffect(() => {
    const fetchTeacherClasses = async () => {
      if (!userProfile || userProfile.role !== 'teacher') return;
      
      try {
        // Fetch classes where teacher is the main teacher
        const classesQuery = query(
          collection(db, 'classes'),
          where('teacherId', '==', userProfile.id)
        );
        const classesDocs = await getDocs(classesQuery);
        let teacherClasses = classesDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));

        // Determine today's date window
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

        let combinedClasses = teacherClasses;
        if (subClassIds.length > 0) {
          const uniqueIds = Array.from(new Set(subClassIds));
          const temporaryClasses: Class[] = [];
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
          const merged: Record<string, Class> = {};
          for (const c of [...teacherClasses, ...temporaryClasses]) merged[c.id] = c;
          combinedClasses = Object.values(merged);
        }

        setMyClasses(combinedClasses);
        if (!selectedClass) {
          const regular = combinedClasses.find(c => !c.isTemporary);
          const first = regular ?? combinedClasses[0];
          if (first) setSelectedClass(first.id);
        }
      } catch (error) {
        console.error('Error fetching teacher classes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeacherClasses();
  }, [userProfile]);

  useEffect(() => {
    const fetchClassData = async () => {
      if (!selectedClass) return;
      
      setIsLoading(true);
      try {
        // Fetch students
        const studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('classId', '==', selectedClass)
        );
        const studentsDocs = await getDocs(studentsQuery);
        const students = studentsDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));

        // Fetch homework
        const homeworkQuery = query(
          collection(db, 'homework'),
          where('classId', '==', selectedClass),
          orderBy('dueDate', 'desc')
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

        // Fetch lessons
        const lessonsQuery = query(
          collection(db, 'lessons'),
          where('classId', '==', selectedClass),
          orderBy('date', 'desc')
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

        // Fetch materials
        const materialsQuery = query(
          collection(db, 'materials'),
          where('classId', '==', selectedClass),
          orderBy('createdAt', 'desc')
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

        // Fetch attendance
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('classId', '==', selectedClass),
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

        setClassData({ students, homework, lessons, materials, attendance });

        // Calculate stats
        const totalStudents = students.length;
        const presentCount = attendance.filter(record => record.status === 'present').length;
        const totalRecords = attendance.length;
        const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;
        const activeHomework = homework.filter(hw => hw.dueDate && hw.dueDate >= new Date()).length;

        setClassStats({
          totalStudents,
          attendanceRate,
          activeHomework,
          totalLessons: lessons.length,
          materialsCount: materials.length
        });

      } catch (error) {
        console.error('Error fetching class data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClassData();
  }, [selectedClass]);

  const handleViewStudentDetails = (student: User) => {
    setSelectedStudent(student);
    setIsStudentDetailsOpen(true);
  };

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

  const selectedClassData = myClasses.find(c => c.id === selectedClass);

  return (
    <PageContainer
      title="Gestione Classi"
      description="Gestisci le tue classi, studenti e attività didattiche"
    >
      <div className="mb-8">
        <Card variant="elevated" className="bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md rounded-xl overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleziona Classe
                </label>
                <select
                  className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white border p-3 transition-colors"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <option value="">Seleziona una classe</option>
                  {myClasses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.isTemporary ? '(Supplenza)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedClassData && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 min-w-[250px]">
                  <div className="flex items-center mb-2">
                    <School className="h-5 w-5 text-blue-600 mr-2" />
                    <h3 className="font-medium text-gray-900">{selectedClassData.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{selectedClassData.description}</p>
                  <div className="flex items-center text-sm text-blue-700">
                    <Clock className="h-4 w-4 mr-2" />
                    <span className="font-medium">{selectedClassData.turno || 'Turno non specificato'}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedClass && !isLoading && (
        <>
          {/* Class Overview Card */}
          <Card variant="elevated" className="mb-8 bg-white shadow-lg rounded-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
              <CardTitle className="flex items-center text-gray-900">
                <GraduationCap className="h-6 w-6 mr-2 text-blue-600" />
                Panoramica Classe
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-gray-100">
                <div className="p-6">
                  <div className="flex items-center mb-2">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mr-3">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-500">Studenti</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="text-3xl font-light text-gray-900">{classStats.totalStudents}</span>
                    <span className="ml-2 text-sm text-success-600">Iscritti</span>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="flex items-center mb-2">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mr-3">
                      <UserCheck className="h-5 w-5 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-500">Presenze</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="text-3xl font-light text-gray-900">{classStats.attendanceRate}%</span>
                    <span className="ml-2 text-sm text-gray-500">Tasso</span>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="flex items-center mb-2">
                    <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mr-3">
                      <ClipboardList className="h-5 w-5 text-amber-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-500">Compiti</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="text-3xl font-light text-gray-900">{classStats.activeHomework}</span>
                    <span className="ml-2 text-sm text-gray-500">Attivi</span>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="flex items-center mb-2">
                    <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center mr-3">
                      <BookOpen className="h-5 w-5 text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-500">Lezioni</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="text-3xl font-light text-gray-900">{classStats.totalLessons}</span>
                    <span className="ml-2 text-sm text-gray-500">Totali</span>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="flex items-center mb-2">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mr-3">
                      <FileText className="h-5 w-5 text-indigo-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-500">Materiali</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="text-3xl font-light text-gray-900">{classStats.materialsCount}</span>
                    <span className="ml-2 text-sm text-gray-500">Caricati</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="mb-8">
            <Card variant="elevated" className="bg-white shadow-md rounded-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                <CardTitle className="flex items-center text-gray-900">
                  <Plus className="h-5 w-5 mr-2 text-blue-600" />
                  Azioni Rapide
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Link to="/attendance">
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm hover:shadow transition-all flex flex-col items-center text-center h-full">
                      <Calendar className="h-8 w-8 text-blue-600 mb-3" />
                      <h3 className="font-medium text-gray-900 mb-1">Registra Presenze</h3>
                      <p className="text-xs text-gray-600">Segna presenze/assenze</p>
                    </div>
                  </Link>
                  
                  <Link to="/homework/new">
                    <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl shadow-sm hover:shadow transition-all flex flex-col items-center text-center h-full">
                      <Plus className="h-8 w-8 text-amber-600 mb-3" />
                      <h3 className="font-medium text-gray-900 mb-1">Nuovo Compito</h3>
                      <p className="text-xs text-gray-600">Assegna compiti</p>
                    </div>
                  </Link>
                  
                  <Link to="/lessons">
                    <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-sm hover:shadow transition-all flex flex-col items-center text-center h-full">
                      <BookOpen className="h-8 w-8 text-purple-600 mb-3" />
                      <h3 className="font-medium text-gray-900 mb-1">Gestisci Lezioni</h3>
                      <p className="text-xs text-gray-600">Crea e modifica lezioni</p>
                    </div>
                  </Link>
                  
                  <Link to="/materials/new">
                    <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm hover:shadow transition-all flex flex-col items-center text-center h-full">
                      <FileText className="h-8 w-8 text-green-600 mb-3" />
                      <h3 className="font-medium text-gray-900 mb-1">Carica Materiali</h3>
                      <p className="text-xs text-gray-600">Aggiungi risorse</p>
                    </div>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Students List */}
            <Card variant="elevated" className="bg-white shadow-md rounded-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                <CardTitle className="flex items-center text-gray-900">
                  <Users className="h-5 w-5 mr-2 text-blue-600" />
                  Studenti ({classStats.totalStudents})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {classData.students.length > 0 ? (
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2">
                    {classData.students.map((student) => (
                      <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl border border-gray-100 cursor-pointer" onClick={() => handleViewStudentDetails(student)}>
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mr-3">
                            <span className="text-blue-700 font-medium text-sm">
                              {student.displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{student.displayName}</p>
                            <div className="flex items-center text-xs text-gray-500">
                              <Mail className="h-3 w-3 mr-1" />
                              {student.email}
                            </div>
                            {student.phoneNumber && (
                              <div className="flex items-center text-xs text-gray-500 mt-1">
                                <Phone className="h-3 w-3 mr-1" />
                                {student.phoneNumber}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    Nessuno studente presente in questa classe.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card variant="elevated" className="bg-white shadow-md rounded-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                <CardTitle className="flex items-center text-gray-900">
                  <Clock className="h-5 w-5 mr-2 text-blue-600" />
                  Attività Recenti
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2">
                  {/* Recent Lessons */}
                  {classData.lessons.slice(0, 2).map((lesson) => (
                    <div key={lesson.id} className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm">
                      <div className="flex items-start">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                          <BookOpen className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{lesson.title}</p>
                          <p className="text-xs text-gray-600">{formatDate(lesson.date)}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Recent Homework */}
                  {classData.homework.slice(0, 2).map((homework) => (
                    <div key={homework.id} className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-100 shadow-sm">
                      <div className="flex items-start">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mr-3">
                          <ClipboardList className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{homework.title}</p>
                          <p className="text-xs text-gray-600">Scadenza: {formatDate(homework.dueDate)}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Recent Materials */}
                  {classData.materials.slice(0, 1).map((material) => (
                    <div key={material.id} className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-100 shadow-sm">
                      <div className="flex items-start">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                          <FileText className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{material.title}</p>
                          <p className="text-xs text-gray-600">{formatDate(material.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {classData.lessons.length === 0 && classData.homework.length === 0 && classData.materials.length === 0 && (
                    <p className="text-gray-500 text-center py-8">
                      Nessuna attività recente.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
      
      {/* Student Details Dialog */}
      <StudentDetailsDialog
        student={selectedStudent}
        isOpen={isStudentDetailsOpen}
        onClose={() => {
          setIsStudentDetailsOpen(false);
          setSelectedStudent(null);
        }}
      />

      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-light">Caricamento dei dati della classe...</p>
        </div>
      )}

      {!selectedClass && !isLoading && myClasses.length === 0 && (
        <Card variant="elevated" className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20">
          <CardContent className="p-8 text-center">
            <School className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <h3 className="text-2xl font-light text-gray-900 mb-3">Nessuna classe assegnata</h3>
            <p className="text-gray-500">
              Non hai ancora classi assegnate. Contatta l'amministratore per essere assegnato a una classe.
            </p>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
};