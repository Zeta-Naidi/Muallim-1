import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Trash2, AlertCircle, CheckCircle, UserCog, Search, Users, Shield, Filter, X, Mail, Eye, Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { User, UserRole } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

export const ManageUsers: React.FC = () => {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState<Record<string, boolean>>({});
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleDialogUser, setRoleDialogUser] = useState<User | null>(null);
  const [userInfoModalOpen, setUserInfoModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [savingRole, setSavingRole] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        const usersQuery = collection(db, 'users');
        const usersDocs = await getDocs(usersQuery);
        const usersList = usersDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setUsers(usersList);
        setFilteredUsers(usersList);
        
      } catch (error) {
        console.error('Errore nel recupero dei dati:', error);
        setMessage({ type: 'error', text: 'Errore nel recupero dei dati' });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  useEffect(() => {
    let filtered = [...users];
    
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }
    
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.displayName.toLowerCase().includes(query) || 
        user.email.toLowerCase().includes(query)
      );
    }
    
    setFilteredUsers(filtered);
  }, [users, searchQuery, roleFilter]);

  const openDeleteDialog = (user: User) => {
    if (user.id === userProfile?.id) {
      setMessage({ type: 'error', text: 'Non puoi eliminare il tuo account' });
      return;
    }
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      setUsers(prev => prev.filter(user => user.id !== userToDelete.id));
      setFilteredUsers(prev => prev.filter(user => user.id !== userToDelete.id));
      setMessage({ type: 'success', text: 'Utente eliminato con successo' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Errore nell\'eliminazione dell\'utente:', error);
      setMessage({ type: 'error', text: 'Errore nell\'eliminazione dell\'utente' });
    } finally {
      setShowDeleteDialog(false);
      setUserToDelete(null);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleRoleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRoleFilter(e.target.value as UserRole | 'all');
  };

  const handleChangeUserRole = async (user: User, newRole: UserRole) => {
    if (user.id === userProfile?.id) {
      setMessage({ type: 'error', text: 'Non puoi modificare il tuo ruolo.' });
      return;
    }
    if (user.role === newRole) return;

    try {
      setRoleUpdating(prev => ({ ...prev, [user.id]: true }));
      await updateDoc(doc(db, 'users', user.id), { role: newRole });
      // Optimistic local update
      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, role: newRole } : u)));
      setFilteredUsers(prev => prev.map(u => (u.id === user.id ? { ...u, role: newRole } : u)));
      setMessage({ type: 'success', text: `Ruolo aggiornato a ${getRoleName(newRole)} per ${user.displayName}` });
      setTimeout(() => setMessage(null), 2500);
    } catch (err) {
      console.error('Errore aggiornamento ruolo:', err);
      setMessage({ type: 'error', text: 'Impossibile aggiornare il ruolo. Riprova.' });
    } finally {
      setRoleUpdating(prev => ({ ...prev, [user.id]: false }));
    }
  };

  const openRoleDialog = (user: User) => {
    setRoleDialogUser(user);
    setSelectedRole(user.role);
    setRoleDialogOpen(true);
  };

  const openUserInfoModal = (user: User) => {
    setSelectedUser(user);
    setUserInfoModalOpen(true);
  };

  const confirmRoleChange = async () => {
    if (!roleDialogUser) return;
    if (roleDialogUser.id === userProfile?.id) {
      setMessage({ type: 'error', text: 'Non puoi modificare il tuo ruolo.' });
      return;
    }
    if (roleDialogUser.role === selectedRole) {
      setRoleDialogOpen(false);
      return;
    }
    try {
      setSavingRole(true);
      await handleChangeUserRole(roleDialogUser, selectedRole);
      setRoleDialogOpen(false);
    } finally {
      setSavingRole(false);
    }
  };

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-8 text-center max-w-md mx-auto">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-2xl font-light text-gray-900 mb-2">Accesso non autorizzato</h3>
          <p className="text-gray-600">Non hai i permessi per accedere a questa pagina.</p>
        </div>
      </div>
    );
  }

  const getRoleName = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Amministratore';
      case 'teacher': return 'Insegnante';
      case 'student': return 'Studente';
      default: return role;
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'teacher': return 'bg-blue-100 text-blue-800';
      case 'student': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
                <UserCog className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Gestione Utenti</h1>
                <p className="text-blue-100 mt-1">Visualizza, modifica ed elimina utenti del sistema</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
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
                <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
              )}
              <span>{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

      <Card variant="elevated" className="mb-6 bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
          <CardTitle className="flex items-center text-gray-900">
            <Filter className="h-5 w-5 mr-2 text-blue-600" />
            Filtri
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Input
                label="Cerca utenti"
                placeholder="Nome o email..."
                value={searchQuery}
                onChange={handleSearchChange}
                leftIcon={<Search className="h-5 w-5" />}
                className="anime-input"
                fullWidth
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtra per ruolo
              </label>
              <select
                className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-3 px-4 transition-colors"
                onChange={handleRoleFilterChange}
                value={roleFilter}
              >
                <option value="all">Tutti i ruoli</option>
                <option value="admin">Amministratori</option>
                <option value="teacher">Insegnanti</option>
                <option value="student">Studenti</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-light">Caricamento degli utenti...</p>
        </div>
      ) : filteredUsers.length > 0 ? (
        <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-purple-50/50 border-b border-gray-100">
            <CardTitle className="flex items-center text-gray-900">
              <Users className="h-6 w-6 mr-3 text-blue-600" />
              Utenti ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Utente
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                      Ruolo
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map(user => (
                    <motion.tr 
                      key={user.id} 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className={`hover:bg-blue-50/30 transition-all duration-200 ${
                        user.id === userProfile.id ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center shadow-sm">
                            <span className="text-blue-700 font-semibold text-sm">
                              {user.displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-gray-900">
                                {user.displayName}
                              </div>
                              {user.id === userProfile.id && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                  Tu
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-gray-600">
                          <Mail className="h-4 w-4 mr-2 text-gray-400" />
                          <span className="text-sm">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1.5 inline-flex text-sm font-medium rounded-xl ${getRoleBadgeColor(user.role)}`}>
                          {getRoleName(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openUserInfoModal(user)}
                            className="rounded-xl transition-all duration-200 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            leftIcon={<Eye className="h-4 w-4" />}
                          >
                            Info
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(user)}
                            disabled={user.id === userProfile.id || !!roleUpdating[user.id]}
                            className={`rounded-xl transition-all duration-200 ${
                              user.id === userProfile.id ? 
                              'opacity-50 cursor-not-allowed' : 
                              'text-red-600 hover:text-red-700 hover:bg-red-50'
                            }`}
                            leftIcon={<Trash2 className="h-4 w-4" />}
                          >
                            Elimina
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
          <CardContent className="p-12 text-center">
            <UserCog className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Nessun utente trovato</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-8">
              {searchQuery 
                ? 'Nessun utente trovato con questi criteri di ricerca.' 
                : 'Nessun utente trovato.'}
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Custom Delete Confirmation Dialog */}
      {showDeleteDialog && userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl"
          >
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Conferma eliminazione</h3>
              <p className="text-sm text-gray-500 mb-6">
                Sei sicuro di voler eliminare l'utente <span className="font-medium text-gray-900">{userToDelete.displayName}</span>?
                <br />
                Questa azione non può essere annullata.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setUserToDelete(null);
                }}
                leftIcon={<X className="h-4 w-4" />}
              >
                Annulla
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteUser}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                Elimina
              </Button>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Change Role Dialog */}
      {roleDialogOpen && roleDialogUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl"
          >
            <div className="flex items-center mb-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                <UserCog className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Cambia ruolo</h3>
                <p className="text-sm text-gray-500">{roleDialogUser.displayName}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setSelectedRole('admin')}
              >
                <input type="radio" name="role" className="h-4 w-4" checked={selectedRole === 'admin'} onChange={() => setSelectedRole('admin')} />
                <div>
                  <div className="text-sm font-medium text-gray-900">Amministratore</div>
                  <div className="text-xs text-gray-500">Accesso completo all'applicazione</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setSelectedRole('teacher')}
              >
                <input type="radio" name="role" className="h-4 w-4" checked={selectedRole === 'teacher'} onChange={() => setSelectedRole('teacher')} />
                <div>
                  <div className="text-sm font-medium text-gray-900">Insegnante</div>
                  <div className="text-xs text-gray-500">Gestione classi, presenze e materiali</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setSelectedRole('student')}
              >
                <input type="radio" name="role" className="h-4 w-4" checked={selectedRole === 'student'} onChange={() => setSelectedRole('student')} />
                <div>
                  <div className="text-sm font-medium text-gray-900">Studente</div>
                  <div className="text-xs text-gray-500">Accesso alle lezioni e ai materiali</div>
                </div>
              </label>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setRoleDialogOpen(false)}
                leftIcon={<X className="h-4 w-4" />}
                disabled={savingRole}
              >
                Annulla
              </Button>
              <Button
                onClick={confirmRoleChange}
                leftIcon={<CheckCircle className="h-4 w-4" />}
                disabled={savingRole || selectedRole === roleDialogUser.role}
              >
                {savingRole ? 'Salvataggio…' : 'Salva'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* User Info Modal */}
      {userInfoModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200 flex items-center justify-center shadow-sm">
                    <span className="text-blue-700 font-bold text-xl">
                      {selectedUser.displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedUser.displayName}
                      {selectedUser.id === userProfile?.id && (
                        <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">Tu</span>
                      )}
                    </h2>
                    <p className="text-gray-600 flex items-center mt-1">
                      <Mail className="h-4 w-4 mr-2" />
                      {selectedUser.email}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUserInfoModalOpen(false)}
                  className="rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Basic Info Section */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <UserCog className="h-5 w-5 mr-2 text-blue-600" />
                  Informazioni Base
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Nome Completo</label>
                    <p className="text-gray-900 font-medium">{selectedUser.displayName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-gray-900">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Ruolo</label>
                    <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-xl ${getRoleBadgeColor(selectedUser.role)}`}>
                      {getRoleName(selectedUser.role)}
                    </span>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">ID Utente</label>
                    <p className="text-gray-900 font-mono text-sm">{selectedUser.id}</p>
                  </div>
                </div>
              </div>

              {/* Account Details Section */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-green-600" />
                  Dettagli Account
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedUser.createdAt && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        Data Registrazione
                      </label>
                      <p className="text-gray-900">
                        {typeof selectedUser.createdAt === 'object' && 'seconds' in selectedUser.createdAt 
                          ? new Date((selectedUser.createdAt as any).seconds * 1000).toLocaleDateString('it-IT', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })
                          : new Date(selectedUser.createdAt).toLocaleDateString('it-IT', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })
                        }
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      Ultimo Accesso
                    </label>
                    <p className="text-gray-900 text-sm text-gray-500">
                      Non disponibile
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Stato Account</label>
                    <span className="inline-flex items-center px-2 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                      Attivo
                    </span>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Permessi</label>
                    <p className="text-gray-900">
                      {selectedUser.role === 'admin' ? 'Amministratore completo' :
                       selectedUser.role === 'teacher' ? 'Gestione classi e studenti' :
                       'Accesso studente'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions Section */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button
                  variant="outline"
                  onClick={() => setUserInfoModalOpen(false)}
                  className="rounded-xl"
                >
                  Chiudi
                </Button>
                {selectedUser.id !== userProfile?.id && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setUserInfoModalOpen(false);
                        openRoleDialog(selectedUser);
                      }}
                      className="rounded-xl"
                      leftIcon={<UserCog className="h-4 w-4" />}
                    >
                      Modifica Ruolo
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setUserInfoModalOpen(false);
                        openDeleteDialog(selectedUser);
                      }}
                      className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50"
                      leftIcon={<Trash2 className="h-4 w-4" />}
                    >
                      Elimina Utente
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </div>
    </div>
  );
};