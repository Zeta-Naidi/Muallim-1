import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Users, BookOpen, ClipboardList, FileText, Calendar, UserCheck, Clock, Plus, School, GraduationCap, Eye, Mail, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer } from '../../components/layout/PageContainer';
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
        // Fetch students using the class document's students array
        let students: User[] = [];
        try {
          console.log('Fetching students for class:', selectedClass);
          
          // Get the class document to access the students array
          const classDoc = await getDoc(doc(db, 'classes', selectedClass));
          if (classDoc.exists()) {
            const classData = classDoc.data();
            const studentIds = classData.students || [];
            console.log('Student IDs from class document:', studentIds);
            
            if (studentIds.length > 0) {
              // Fetch student documents in batches (Firestore 'in' query limit is 10)
              const studentBatches = [];
              for (let i = 0; i < studentIds.length; i += 10) {
                const batch = studentIds.slice(i, i + 10);
                const studentsQuery = query(
                  collection(db, 'students'),
                  where('__name__', 'in', batch)
                );
                const studentsDocs = await getDocs(studentsQuery);
                const batchStudents = studentsDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
                studentBatches.push(...batchStudents);
              }
              
              // Fetch parent data for each student
              const parentIds = [...new Set(studentBatches.map(s => s.parentId).filter(Boolean))];
              const parentsMap = new Map();
              
              if (parentIds.length > 0) {
                // Fetch parents in batches
                for (let i = 0; i < parentIds.length; i += 10) {
                  const batch = parentIds.slice(i, i + 10);
                  const parentsQuery = query(
                    collection(db, 'users'),
                    where('__name__', 'in', batch)
                  );
                  const parentsDocs = await getDocs(parentsQuery);
                  parentsDocs.docs.forEach(doc => {
                    parentsMap.set(doc.id, doc.data());
                  });
                }
              }
              
              // Map students with parent data
              students = studentBatches.map(student => {
                const parentData = parentsMap.get(student.parentId);
                return {
                  ...student,
                  role: 'student',
                  gender: student.gender === 'M' ? 'male' : student.gender === 'F' ? 'female' : undefined,
                  parentName: parentData ? `${parentData.firstName || ''} ${parentData.lastName || ''}`.trim() || parentData.displayName : 'N/A',
                  parentContact: parentData?.phoneNumber || parentData?.contact,
                  parentEmail: parentData?.email,
                  parentAddress: parentData?.address,
                  parentCity: parentData?.city,
                  parentPostalCode: parentData?.postalCode,
                } as any;
              });
              
              console.log('Fetched students with parent data:', students.map(s => ({ id: s.id, displayName: s.displayName, parentName: (s as any).parentName })));
            } else {
              console.log('No students found in class document');
            }
          } else {
            console.log('Class document not found:', selectedClass);
          }
          
        } catch (studentsError) {
          console.error('Error fetching students:', studentsError);
        }

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-white/5" />
        
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
                  <School className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Le Mie Classi</h1>
                  <p className="text-blue-100 mt-1">Gestisci le tue classi, studenti e attività didattiche</p>
                </div>
              </div>
              
              {/* Class Selection in Header */}
              <div className="min-w-[280px]">
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Seleziona Classe
                </label>
                <select
                  className="block w-full rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm text-white shadow-sm focus:border-white/40 focus:ring-white/20 sm:text-sm py-3 px-4 transition-colors"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <option value="" className="text-gray-900">Seleziona una classe</option>
                  {myClasses.map(c => (
                    <option key={c.id} value={c.id} className="text-gray-900">
                      {c.name} {(c as any).isTemporary ? '(Supplenza)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">

        {selectedClass && !isLoading && (
        <>
          {/* Class Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-50" />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-emerald-700">Studenti</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{classStats.totalStudents}</div>
                <div className="mt-1 text-sm text-slate-500">Iscritti</div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-green-200 bg-white shadow-sm">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-green-50" />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-green-700">Presenze</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{classStats.attendanceRate}%</div>
                <div className="mt-1 text-sm text-slate-500">Tasso medio</div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-50" />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-amber-700">Compiti</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{classStats.activeHomework}</div>
                <div className="mt-1 text-sm text-slate-500">Attivi</div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-purple-200 bg-white shadow-sm">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-purple-50" />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-purple-700">Lezioni</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{classStats.totalLessons}</div>
                <div className="mt-1 text-sm text-slate-500">Totali</div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-indigo-50" />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-indigo-700">Materiali</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{classStats.materialsCount}</div>
                <div className="mt-1 text-sm text-slate-500">Caricati</div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Link to="/attendance">
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
                <div className="relative">
                  <div className="mb-4">
                    <Calendar className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Registra Presenze</h3>
                  <p className="text-blue-100 text-sm">Segna presenze/assenze</p>
                </div>
              </div>
            </Link>
            
            <Link to="/homework/new">
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
                <div className="relative">
                  <div className="mb-4">
                    <Plus className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Nuovo Compito</h3>
                  <p className="text-rose-100 text-sm">Assegna compiti</p>
                </div>
              </div>
            </Link>
            
            <Link to="/lessons">
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
                <div className="relative">
                  <div className="mb-4">
                    <BookOpen className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Gestisci Lezioni</h3>
                  <p className="text-purple-100 text-sm">Crea e modifica lezioni</p>
                </div>
              </div>
            </Link>
            
            <Link to="/materials/new">
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
                <div className="relative">
                  <div className="mb-4">
                    <FileText className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Carica Materiali</h3>
                  <p className="text-emerald-100 text-sm">Aggiungi risorse</p>
                </div>
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Students List */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Studenti ({classStats.totalStudents})</h3>
                </div>
              </div>
              <div className="p-6">
                {classData.students.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {classData.students.map((student) => (
                      <div 
                        key={student.id} 
                        className="group rounded-xl border border-slate-100 p-4 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all cursor-pointer"
                        onClick={() => handleViewStudentDetails(student)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                              <span className="text-emerald-700 font-semibold text-sm">
                                {student.displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-medium text-slate-900 group-hover:text-emerald-900">{student.displayName}</h4>
                              <div className="flex items-center text-xs text-slate-500 mt-1">
                                <Mail className="h-3 w-3 mr-1" />
                                {student.email}
                              </div>
                              {student.phoneNumber && (
                                <div className="flex items-center text-xs text-slate-500 mt-1">
                                  <Phone className="h-3 w-3 mr-1" />
                                  {student.phoneNumber}
                                </div>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 text-sm">Nessuno studente presente in questa classe.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Attività Recenti</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {/* Recent Lessons */}
                  {classData.lessons.slice(0, 2).map((lesson) => (
                    <div key={lesson.id} className="group rounded-xl border border-slate-100 p-4 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900 group-hover:text-indigo-900">{lesson.title}</h4>
                          <p className="text-sm text-slate-500 mt-1">{formatDate(lesson.date)}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Recent Homework */}
                  {classData.homework.slice(0, 2).map((homework) => (
                    <div key={homework.id} className="group rounded-xl border border-slate-100 p-4 hover:border-amber-200 hover:bg-amber-50/50 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                          <ClipboardList className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900 group-hover:text-amber-900">{homework.title}</h4>
                          <p className="text-sm text-slate-500 mt-1">Scadenza: {formatDate(homework.dueDate)}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Recent Materials */}
                  {classData.materials.slice(0, 1).map((material) => (
                    <div key={material.id} className="group rounded-xl border border-slate-100 p-4 hover:border-purple-200 hover:bg-purple-50/50 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900 group-hover:text-purple-900">{material.title}</h4>
                          <p className="text-sm text-slate-500 mt-1">{formatDate(material.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {classData.lessons.length === 0 && classData.homework.length === 0 && classData.materials.length === 0 && (
                    <div className="text-center py-8">
                      <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                        <Clock className="w-6 h-6" />
                      </div>
                      <p className="text-slate-500 text-sm">Nessuna attività recente.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Caricamento dei dati della classe...</p>
          </div>
        )}

        {!selectedClass && !isLoading && myClasses.length === 0 && (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-lg overflow-hidden">
            <div className="p-12 text-center">
              <School className="h-20 w-20 text-gray-300 mx-auto mb-6" />
              <h3 className="text-2xl font-medium text-gray-900 mb-3">Nessuna classe assegnata</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Non hai ancora classi assegnate. Contatta l'amministratore per essere assegnato a una classe.
              </p>
            </div>
          </div>
        )}

        {!selectedClass && !isLoading && myClasses.length > 0 && (
          <div className="rounded-2xl bg-white/80 backdrop-blur-md border border-white/20 shadow-xl overflow-hidden">
            <div className="p-12 text-center">
              <GraduationCap className="h-20 w-20 text-gray-300 mx-auto mb-6" />
              <h3 className="text-2xl font-medium text-gray-900 mb-3">Seleziona una classe</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Scegli una classe dal menu a tendina sopra per visualizzare studenti e attività.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Student Details Dialog */}
      <StudentDetailsDialog
        student={selectedStudent}
        isOpen={isStudentDetailsOpen}
        onClose={() => {
          setIsStudentDetailsOpen(false);
          setSelectedStudent(null);
        }}
      />
    </div>
  );
};