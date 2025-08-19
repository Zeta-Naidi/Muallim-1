import React, { useState } from 'react';
import { School, Shield, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { CreateClassDialog } from '../../components/dialogs/CreateClassDialog';

export const ManageClasses: React.FC = () => {
  const { userProfile } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-8 text-center max-w-md mx-auto">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Accesso Negato</h2>
          <p className="text-slate-600">Non hai i permessi per accedere a questa sezione.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-white/5" />
        
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
                <School className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold">Gestione Classi</h1>
                <p className="text-blue-100 mt-1">Crea, modifica e gestisci le classi della scuola</p>
              </div>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                <Plus className="h-5 w-5 mr-2" />
                Crea Classe
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <p className="text-slate-600">Contenuto della gestione classi in arrivo...</p>
        </div>
      </div>

      {/* Create Class Dialog */}
      <CreateClassDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreated={() => {
          setRefreshKey(prev => prev + 1);
          setIsCreateDialogOpen(false);
        }}
      />
    </div>
  );
};

export default ManageClasses;