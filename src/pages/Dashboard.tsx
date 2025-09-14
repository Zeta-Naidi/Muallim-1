import React from 'react';
import { useAuth } from '../context/AuthContext';
import { PageContainer } from '../components/layout/PageContainer';
import ParentDashboard from '../components/parent/ParentDashboard';
import { Dashboard as AdminDashboard } from './admin/AdminDashboard';
import { TeacherDashboard } from './teacher/TeacherDashboard';

export const Dashboard: React.FC = () => {
  const { userProfile } = useAuth();
  
  if (!userProfile) {
    return null;
  }

  // Handle parent dashboard
  if (userProfile.role === 'parent') {
    return <ParentDashboard />;
  }

  // Handle admin dashboard
  if (userProfile.role === 'admin' || userProfile.role === 'operatore') {
    return <AdminDashboard />;
  }

  // Handle teacher dashboard
  if (userProfile.role === 'teacher') {
    return <TeacherDashboard />;
  }

  // For student role, show a simple message for now
  return (
    <PageContainer
      title={`Benvenuto, ${userProfile.displayName || 'Studente'}`}
      description="Studente"
    >
      <div className="py-8 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Benvenuto nel tuo pannello di controllo
        </h2>
        <p className="text-gray-600">
          Sei loggato come studente. Usa il menu per navigare tra le tue attività.
        </p>
      </div>
    </PageContainer>
  );
};