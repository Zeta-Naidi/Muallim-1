import React from 'react';
import { useAuth } from '../context/AuthContext';
import { PageContainer } from '../components/layout/PageContainer';
import ParentDashboard from '../components/parent/ParentDashboard';

export const Dashboard: React.FC = () => {
  const { userProfile } = useAuth();
  
  if (!userProfile) {
    return null;
  }

  // Handle parent dashboard
  if (userProfile.role === 'parent') {
    return (
      <PageContainer
        title={`Benvenuto, ${userProfile.displayName || 'Genitore'}`}
        description="Genitore"
      >
        <ParentDashboard />
      </PageContainer>
    );
  }

  // For other roles (admin, teacher, student), show a simple message
  return (
    <PageContainer
      title={`Benvenuto, ${userProfile.displayName || 'Utente'}`}
      description={`${
        userProfile.role === 'admin' ? 'Amministratore' : 
        userProfile.role === 'teacher' ? 'Insegnante' : 'Studente'
      }`}
    >
      <div className="py-8 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Benvenuto nel tuo pannello di controllo
        </h2>
        <p className="text-gray-600">
          {userProfile.role === 'admin' ? (
            'Sei loggato come amministratore. Usa il menu per navigare tra le funzionalità.'
          ) : userProfile.role === 'teacher' ? (
            'Sei loggato come insegnante. Usa il menu per navigare tra le funzionalità.'
          ) : (
            'Sei loggato come studente. Usa il menu per navigare tra le tue attività.'
          )}
        </p>
      </div>
    </PageContainer>
  );
};