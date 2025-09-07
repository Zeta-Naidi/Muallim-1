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
import { ApprovalPending } from './pages/auth/ApprovalPending';
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
import { ToastProvider } from './components/ui/Toast';

// Route Guard Component
const PrivateRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
  const { userProfile, loading } = useAuth();
  
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
  
  // Check if account is pending approval - redirect to approval page
  if ((userProfile.role === 'teacher' && userProfile.accountStatus === 'pending_approval') ||
      (userProfile.role === 'parent' && userProfile.accountStatus === 'pending_approval')) {
    return <Navigate to="/approval-pending" />;
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
            <Route path="/approval-pending" element={<ApprovalPending />} />
            
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