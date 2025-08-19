import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { Euro, TrendingUp, UserCheck, Users, School, CreditCard, User as UserIcon, CalendarDays, ClipboardList, BookOpenText } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { PageContainer } from '../components/layout/PageContainer';
import { ProfessionalDataTable } from '../components/ui/ProfessionalDataTable';
import { Homework, Lesson, Class, User, Attendance } from '../types';

interface PaymentRecord {
  id: string;
  parentContact: string;
  parentName: string;
  amount: number;
  date: Date;
  notes: string;
  createdBy: string;
  createdAt: Date;
}

interface ParentGroup {
  parentContact: string;
  parentName: string;
  children: User[];
  totalAmount: number;
  paidAmount: number;
  isExempted: boolean;
}

export const Dashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [recentHomework, setRecentHomework] = useState<Homework[]>([]);
  const [recentLessons, setRecentLessons] = useState<Lesson[]>([]);
  const [userClass, setUserClass] = useState<Class | null>(null);
  
  // Admin statistics
  const [enrolledStudents, setEnrolledStudents] = useState<User[]>([]);
  const [paymentStats, setPaymentStats] = useState({
    totalFamilies: 0,
    paidFamilies: 0,
    totalRevenue: 0,
    pendingAmount: 0,
    exemptedFamilies: 0
  });
  const [attendanceStats, setAttendanceStats] = useState({
    totalClasses: 0,
    recentAttendanceRate: 0,
    totalStudents: 0,
    presentRecords: 0
  });
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!userProfile) return;
      
      try {
        if (userProfile.role === 'admin') {
          await fetchAdminStats();
        } else {
          await fetchUserData();
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };
    
    fetchDashboardData();
  }, [userProfile]);

  const fetchAdminStats = async () => {
    try {
      // Fetch enrolled students
      const studentsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('isEnrolled', '==', true)
      );
      const studentsDocs = await getDocs(studentsQuery);
      const students = studentsDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
      setEnrolledStudents(students);

      // Calculate payment statistics
      const paymentRecordsQuery = query(collection(db, 'paymentRecords'), orderBy('date', 'desc'));
      const paymentsDocs = await getDocs(paymentRecordsQuery);
      const paymentRecords = paymentsDocs.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          date: data.date?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
        } as PaymentRecord;
      });

      // Group students by parent contact
      const parentGroupsMap = new Map<string, ParentGroup>();
      students.forEach(student => {
        const parentContact = student.parentContact?.trim();
        const parentName = student.parentName?.trim() || 'Nome non specificato';
        
        if (!parentContact) return;
        
        if (!parentGroupsMap.has(parentContact)) {
          parentGroupsMap.set(parentContact, {
            parentContact,
            parentName,
            children: [],
            totalAmount: 0,
            paidAmount: 0,
            isExempted: false,
          });
        }
        
        const group = parentGroupsMap.get(parentContact)!;
        group.children.push(student);
        
        if (student.paymentExempted) {
          group.isExempted = true;
        }
      });

      // Calculate payment stats
      const parentGroups = Array.from(parentGroupsMap.values());
      let totalRevenue = 0;
      let pendingAmount = 0;
      let paidFamilies = 0;
      let exemptedFamilies = 0;

      parentGroups.forEach(group => {
        const childrenCount = group.children.length;
        const totalAmount = group.isExempted ? 0 : getPricing(childrenCount);
        const paidAmount = paymentRecords
          .filter(payment => payment.parentContact === group.parentContact)
          .reduce((sum, payment) => sum + payment.amount, 0);

        group.totalAmount = totalAmount;
        group.paidAmount = paidAmount;

        if (group.isExempted) {
          exemptedFamilies++;
        } else {
          totalRevenue += paidAmount;
          pendingAmount += Math.max(0, totalAmount - paidAmount);
          if (paidAmount >= totalAmount) {
            paidFamilies++;
          }
        }
      });

      setPaymentStats({
        totalFamilies: parentGroups.length,
        paidFamilies,
        totalRevenue,
        pendingAmount,
        exemptedFamilies
      });

      // Calculate attendance statistics
      const classesQuery = query(collection(db, 'classes'));
      const classesDocs = await getDocs(classesQuery);
      const totalClasses = classesDocs.docs.length;

      // Get attendance data from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('date', '>=', thirtyDaysAgo),
        orderBy('date', 'desc')
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

      // Calculate attendance rate from real data
      const presentCount = attendanceRecords.filter(record => record.status === 'present').length;
      const totalRecords = attendanceRecords.length;
      const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

      setAttendanceStats({
        totalClasses,
        recentAttendanceRate: attendanceRate,
        totalStudents: students.length,
        presentRecords: presentCount
      });

    } catch (error) {
      console.error('Error fetching admin stats:', error);
    }
  };

  const fetchUserData = async () => {
    // Ensure userProfile is defined for TS safety
    if (!userProfile) return;

    if (userProfile.classId) {
      const classDoc = await getDocs(query(
        collection(db, 'classes'),
        where('id', '==', userProfile.classId),
        limit(1)
      ));
      
      if (!classDoc.empty) {
        setUserClass(classDoc.docs[0].data() as Class);
      }
    }
    
    let homeworkQuery;
    if (userProfile.role === 'student' && userProfile.classId) {
      homeworkQuery = query(
        collection(db, 'homework'),
        where('classId', '==', userProfile.classId),
        orderBy('dueDate', 'desc'),
        limit(3)
      );
    } else if (userProfile.role === 'teacher') {
      homeworkQuery = query(
        collection(db, 'homework'),
        where('createdBy', '==', userProfile.id),
        orderBy('dueDate', 'desc'),
        limit(3)
      );
    }
    
    if (homeworkQuery) {
      const homeworkDocs = await getDocs(homeworkQuery);
      const fetchedHomework = homeworkDocs.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          dueDate: data.dueDate?.toDate() || null
        } as Homework;
      });
      setRecentHomework(fetchedHomework);
    }
    
    let lessonQuery;
    if (userProfile.role === 'student' && userProfile.classId) {
      lessonQuery = query(
        collection(db, 'lessons'),
        where('classId', '==', userProfile.classId),
        orderBy('date', 'desc'),
        limit(3)
      );
    } else if (userProfile.role === 'teacher') {
      lessonQuery = query(
        collection(db, 'lessons'),
        where('createdBy', '==', userProfile.id),
        orderBy('date', 'desc'),
        limit(3)
      );
    }
    
    if (lessonQuery) {
      const lessonDocs = await getDocs(lessonQuery);
      const fetchedLessons = lessonDocs.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          date: data.date?.toDate() || null
        } as Lesson;
      });
      setRecentLessons(fetchedLessons);
    }
  };

  const getPricing = (childrenCount: number): number => {
    switch (childrenCount) {
      case 1: return 120;
      case 2: return 220;
      case 3: return 300;
      case 4: return 360;
      default: return 360;
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date || isNaN(date.getTime())) {
      return 'Data non valida';
    }
    return format(date, 'd MMMM yyyy', { locale: it });
  };

  if (!userProfile) return null;

  // Gender-based welcome message
  const getWelcomeMessage = (user: User): string => {
    const greeting = user.gender === 'female' ? 'Benvenuta' : 'Benvenuto';
    return `${greeting}, ${user.displayName}`;
  };

  return (
    <PageContainer
      title={getWelcomeMessage(userProfile)}
      description={`${
        userProfile.role === 'admin' ? 'Amministratore' : 
        userProfile.role === 'teacher' ? 'Insegnante' : 'Studente'
      }${userClass ? ` - ${userClass.name}` : ''}`}
    >
      {userProfile.role === 'admin' ? (
        // Redesigned Admin Dashboard (vibrant theme)
        <>
          {/* Key Metrics Overview (custom cards) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-indigo-50" />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <School className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-indigo-700">Classi Attive</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{attendanceStats.totalClasses}</div>
                <div className="mt-1 text-sm text-slate-500">In corso</div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-50" />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-emerald-700">Studenti Iscritti</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{attendanceStats.totalStudents}</div>
                <div className="mt-1 text-sm text-slate-500">Totale</div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-50" />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-amber-700">Tasso Presenze</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{`${attendanceStats.recentAttendanceRate}%`}</div>
                <div className="mt-1 text-sm text-slate-500">Media mensile</div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-fuchsia-200 bg-white shadow-sm">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-fuchsia-50" />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center">
                    <Euro className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-fuchsia-700">Ricavi Totali</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{`€${paymentStats.totalRevenue.toFixed(0)}`}</div>
                <div className="mt-1 text-sm text-slate-500">Incassati</div>
              </div>
            </div>
          </div>

          {/* Management Sections (colorful cards) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="rounded-2xl border border-sky-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-sky-50 to-indigo-50 border-b border-sky-100">
                <h3 className="text-slate-900 font-semibold">Gestione Didattica</h3>
                <p className="text-slate-500 text-sm">Strumenti per classi e studenti</p>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link to="/admin/classes" className="group">
                  <div className="rounded-xl border border-sky-100 p-4 hover:bg-sky-50 transition-all">
                    <div className="h-10 w-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center mb-3">
                      <School className="w-5 h-5" />
                    </div>
                    <div className="font-medium text-slate-900">Gestione Classi</div>
                    <div className="text-sm text-slate-600">Visualizza e modifica classi attive</div>
                  </div>
                </Link>
                <Link to="/admin/students" className="group">
                  <div className="rounded-xl border border-emerald-100 p-4 hover:bg-emerald-50 transition-all">
                    <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="font-medium text-slate-900">Gestione Studenti</div>
                    <div className="text-sm text-slate-600">Amministra studenti iscritti</div>
                  </div>
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-violet-50 to-fuchsia-50 border-b border-violet-100">
                <h3 className="text-slate-900 font-semibold">Amministrazione Sistema</h3>
                <p className="text-slate-500 text-sm">Utenti, docenti e pagamenti</p>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link to="/admin/users" className="group">
                  <div className="rounded-xl border border-violet-100 p-4 hover:bg-violet-50 transition-all">
                    <div className="h-10 w-10 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center mb-3">
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <div className="font-medium text-slate-900">Gestione Utenti</div>
                    <div className="text-sm text-slate-600">Permessi e accessi</div>
                  </div>
                </Link>
                <Link to="/admin/teachers" className="group">
                  <div className="rounded-xl border border-indigo-100 p-4 hover:bg-indigo-50 transition-all">
                    <div className="h-10 w-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3">
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <div className="font-medium text-slate-900">Gestione Insegnanti</div>
                    <div className="text-sm text-slate-600">Corpo docente</div>
                  </div>
                </Link>
                <Link to="/admin/payments" className="group">
                  <div className="rounded-xl border border-fuchsia-100 p-4 hover:bg-fuchsia-50 transition-all">
                    <div className="h-10 w-10 rounded-lg bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center mb-3">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="font-medium text-slate-900">Sistema Pagamenti</div>
                    <div className="text-sm text-slate-600">Monitoraggio e incassi</div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        // Student/Teacher Dashboard (original)
        <>
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {userProfile.role === 'teacher' && (
              <Link to="/attendance" className="block">
                <div className="bg-white border border-slate-200 rounded-lg p-6 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mr-4">
                      <CalendarDays className="w-6 h-6 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Presenze</h3>
                      <p className="text-sm text-slate-600">Gestisci presenze giornaliere</p>
                    </div>
                  </div>
                </div>
              </Link>
            )}
            
            <Link to="/homework" className="block">
              <div className="bg-white border border-slate-200 rounded-lg p-6 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mr-4">
                    <ClipboardList className="w-6 h-6 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">Compiti</h3>
                      {recentHomework.length > 0 && (
                        <span className="bg-slate-100 text-slate-700 text-xs font-medium px-2 py-1 rounded-full">
                          {recentHomework.length}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      {userProfile.role === 'student' ? 'Visualizza compiti assegnati' : 'Gestisci compiti studenti'}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
            
            <Link to="/lessons" className="block">
              <div className="bg-white border border-slate-200 rounded-lg p-6 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mr-4">
                    <BookOpenText className="w-6 h-6 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">Lezioni</h3>
                      {recentLessons.length > 0 && (
                        <span className="bg-slate-100 text-slate-700 text-xs font-medium px-2 py-1 rounded-full">
                          {recentLessons.length}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      {userProfile.role === 'student' ? 'Consulta registro lezioni' : 'Gestisci registro lezioni'}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
            
            <Link to="/materials" className="block">
              <div className="bg-white border border-slate-200 rounded-lg p-6 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mr-4">
                    <BookOpenText className="w-6 h-6 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Materiali</h3>
                    <p className="text-sm text-slate-600">
                      {userProfile.role === 'student' ? 'Accedi ai materiali' : 'Gestisci materiali didattici'}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Recent Activity Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ProfessionalDataTable
              title="Compiti Recenti"
              columns={[
                { key: 'title', label: 'Titolo' },
                { key: 'dueDate', label: 'Scadenza', align: 'right' },
                { key: 'status', label: 'Stato', align: 'center' }
              ]}
              data={recentHomework.map(homework => ({
                title: homework.title,
                dueDate: formatDate(homework.dueDate),
                status: <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">In corso</span>
              }))}
              emptyMessage={userProfile.role === 'student' && !userProfile.classId 
                ? 'Non sei assegnato a nessuna classe.'
                : 'Nessun compito recente trovato.'}
            />
            
            <ProfessionalDataTable
              title="Lezioni Recenti"
              columns={[
                { key: 'title', label: 'Titolo' },
                { key: 'date', label: 'Data', align: 'right' },
                { key: 'status', label: 'Stato', align: 'center' }
              ]}
              data={recentLessons.map(lesson => ({
                title: lesson.title,
                date: formatDate(lesson.date),
                status: <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full">Completata</span>
              }))}
              emptyMessage={userProfile.role === 'student' && !userProfile.classId 
                ? 'Non sei assegnato a nessuna classe.'
                : 'Nessuna lezione recente trovata.'}
            />
          </div>
        </>
      )}
    </PageContainer>
  );
};