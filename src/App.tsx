import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { EnhancedTeacherChat } from './components/chat/EnhancedTeacherChat';
import { Login } from './pages/auth/Login';
import { RegisterStudent } from './pages/auth/RegisterStudent';
import { RegisterTeacher } from './pages/auth/RegisterTeacher';
import { Dashboard } from './pages/Dashboard';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { GradeTracker } from './pages/student/GradeTracker';
import { TeacherDashboard } from './pages/teacher/TeacherDashboard';
import { ClassManagement } from './pages/teacher/ClassManagement';
import { GradeManagement } from './pages/teacher/GradeManagement';
import { AttendanceTracking } from './pages/attendance/AttendanceTracking';
import { StudentAttendanceView } from './pages/attendance/StudentAttendanceView';
import { HomeworkList } from './pages/homework/HomeworkList';
import { HomeworkDetails } from './pages/homework/HomeworkDetails';
import { HomeworkAssignment } from './pages/homework/HomeworkAssignment';
import { LessonTracking } from './pages/lessons/LessonTracking';
import { StudentLessonView } from './pages/lessons/StudentLessonView';
import { LessonDetails } from './pages/lessons/LessonDetails';
import { MaterialsList } from './pages/materials/MaterialsList';
import { UploadMaterial } from './pages/materials/UploadMaterial';
import { AdminMaterialsView } from './pages/materials/AdminMaterialsView';
import { ManageClasses } from './pages/admin/ManageClasses';
import { ManageUsers } from './pages/admin/ManageUsers';
import { ManageStudents } from './pages/admin/ManageStudents';
import { ManageTeachers } from './pages/admin/ManageTeachers';
import { Payments } from './pages/admin/Payments';
import { PaymentSuccess } from './pages/payments/PaymentSuccess';
import { PaymentCancel } from './pages/payments/PaymentCancel';
import { SubstitutionRequests } from './pages/teacher/SubstitutionRequests';
import { UserProfile } from './pages/profile/UserProfile';
import { NotFound } from './pages/NotFound';
import { ErrorFallback } from './components/error/ErrorFallback';
import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from './components/ui/Button';
import { ToastProvider } from './components/ui/Toast';

// Route Guard Component
const PrivateRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
  const { userProfile, loading, logout } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  if (!userProfile) {
    return <Navigate to="/login" />;
  }
  
  // Check if teacher account is pending approval
  if (userProfile.role === 'teacher' && userProfile.accountStatus === 'pending_approval') {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        {/* Soft background accents (match Login) */}
        <motion.div 
          className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full blur-3xl opacity-40 bg-gradient-to-br from-blue-400/20 to-purple-600/20"
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div 
          className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-40 bg-gradient-to-tr from-pink-400/20 to-orange-600/20"
          animate={{ scale: [1.2, 1, 1.2], rotate: [360, 180, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        />

        <motion.div 
          className="relative max-w-lg w-full"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl ring-1 ring-blue-100 border border-white/20">
            {/* Top accent bar */}
            <div className="h-1 w-full rounded-t-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" />

            <div className="p-10 text-center">
              <motion.div 
                className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Clock className="h-8 w-8 text-blue-600 animate-pulse" />
              </motion.div>

              <h2 className="text-3xl font-semibold tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                Ci Sei Quasi!
              </h2>
              <p className="text-sm text-gray-600 mb-1">È in corso la verifica del tuo account...</p>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-blue-200 to-transparent my-6" />

              <p className="text-sm text-gray-500 mb-8">
                Riceverai una notifica via email quando il tuo account sarà approvato.
              </p>

              <Button
                onClick={async () => {
                  try {
                    await logout();
                  } catch (error) {
                    console.error('Logout error:', error);
                  }
                }}
                variant="outline"
                
              >
                Logout
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }
  
  if (roles && !roles.includes(userProfile.role)) {
    return <Navigate to="/dashboard" />;
  }
  
  return <>{children}</>;
};

// Public Route Component (redirects authenticated users)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { userProfile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  if (userProfile) {
    return <Navigate to="/dashboard" />;
  }
  
  return <>{children}</>;
};

function AppRoutes() {
  const { userProfile } = useAuth();

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-indigo-50 flex flex-col">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Routes>
            {/* Landing Page */}
            <Route path="/" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />
            
            {/* Public Routes */}
            <Route path="/login" element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } />
            <Route path="/register/student" element={
              <PublicRoute>
                <RegisterStudent />
              </PublicRoute>
            } />
            <Route path="/register/teacher" element={
              <PublicRoute>
                <RegisterTeacher />
              </PublicRoute>
            } />
            
            {/* Private Routes */}
            <Route path="/dashboard" element={
              <PrivateRoute>
                <div className="flex flex-col min-h-screen">
                  <Header />
                  <div className="flex-grow">
                    <ErrorBoundary FallbackComponent={ErrorFallback}>
                      {userProfile?.role === 'student' ? <StudentDashboard /> : 
                       userProfile?.role === 'teacher' ? <TeacherDashboard /> : <Dashboard />}
                    </ErrorBoundary>
                  </div>
                  <Footer />
                </div>
              </PrivateRoute>
            } />

          <Route path="/student/grades" element={
            <PrivateRoute roles={['student']}>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <GradeTracker />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />

          {/* Profile Route */}
          <Route path="/profile" element={
            <PrivateRoute>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <UserProfile />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />

          {/* Teacher Routes */}
          <Route path="/teacher/classes" element={
            <PrivateRoute roles={['teacher']}>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <ClassManagement />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />

          <Route path="/teacher/grades" element={
            <PrivateRoute roles={['teacher']}>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <GradeManagement />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />

          <Route path="/teacher/substitutions" element={
            <PrivateRoute roles={['teacher']}>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <SubstitutionRequests />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />

          {/* Payment Routes */}
          <Route path="/payment/success" element={
            <PrivateRoute>
              <PaymentSuccess />
            </PrivateRoute>
          } />
          <Route path="/payment/cancel" element={
            <PrivateRoute>
              <PaymentCancel />
            </PrivateRoute>
          } />
          
          {/* Attendance Routes */}
          <Route path="/attendance" element={
            <PrivateRoute roles={['teacher', 'admin']}>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <AttendanceTracking />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />

          <Route path="/my-attendance" element={
            <PrivateRoute roles={['student']}>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <StudentAttendanceView />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />
          
          {/* Homework Routes */}
          <Route path="/homework" element={
            <PrivateRoute>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <HomeworkList />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />

          <Route path="/homework/:id" element={
            <PrivateRoute>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <HomeworkDetails />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />
          
          <Route path="/homework/new" element={
            <PrivateRoute roles={['teacher', 'admin']}>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <HomeworkAssignment />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />
          
          {/* Lesson Routes */}
          <Route path="/lessons" element={
            <PrivateRoute>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    {userProfile?.role === 'student' ? <StudentLessonView /> : <LessonTracking />}
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />

          <Route path="/lessons/:id" element={
            <PrivateRoute>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <LessonDetails />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />
          
          {/* Materials Routes */}
          <Route path="/materials" element={
            <PrivateRoute>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    {userProfile?.role === 'admin' ? <AdminMaterialsView /> : <MaterialsList />}
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />
          
          <Route path="/materials/new" element={
            <PrivateRoute roles={['teacher', 'admin']}>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <UploadMaterial />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />
          
          {/* Admin Routes */}
          <Route path="/admin/classes" element={
            <PrivateRoute roles={['admin']}>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <ManageClasses />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />
          
          <Route path="/admin/users" element={
            <PrivateRoute roles={['admin']}>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <ManageUsers />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />
          
          <Route path="/admin/teachers" element={
            <PrivateRoute roles={['admin']}>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <ManageTeachers />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />
          
          <Route path="/admin/students" element={
            <PrivateRoute roles={['admin']}>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <ManageStudents />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />

          <Route path="/admin/payments" element={
            <PrivateRoute roles={['admin']}>
              <div className="flex flex-col min-h-screen">
                <Header />
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <div className="flex-grow">
                    <Payments />
                  </div>
                </ErrorBoundary>
                <Footer />
              </div>
            </PrivateRoute>
          } />

          
          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>

        {/* TeacherChat */}
        {userProfile &&
          (userProfile.role === 'teacher' || userProfile.role === 'admin') &&
          userProfile.accountStatus !== 'pending_approval' && (
            <EnhancedTeacherChat />
          )}
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider />
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;