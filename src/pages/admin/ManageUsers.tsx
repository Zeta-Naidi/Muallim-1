import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Trash2, AlertCircle, CheckCircle, UserCog, Search, Users, Shield, Filter, X, Mail, MoreVertical } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { User, Class, UserRole } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

export const ManageUsers: React.FC = () => {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState<Record<string, boolean>>({});
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleDialogUser, setRoleDialogUser] = useState<User | null>(null);
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
        
        const classesQuery = collection(db, 'classes');
        const classesDocs = await getDocs(classesQuery);
        setClasses(classesDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class)));
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
    setMenuOpenFor(null);
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
      <PageContainer title="Accesso non autorizzato">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-8 text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-2xl font-light text-gray-900 mb-2">Accesso non autorizzato</h3>
          <p className="text-gray-600">Non hai i permessi per accedere a questa pagina.</p>
        </div>
      </PageContainer>
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
    <PageContainer
      title="Gestione Utenti"
      description="Visualizza, modifica ed elimina utenti"
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
        <Card variant="elevated" className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
            <CardTitle className="flex items-center text-gray-900">
              <Users className="h-5 w-5 mr-2 text-blue-600" />
              Utenti ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ruolo
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Classe
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map(user => (
                    <motion.tr 
                      key={user.id} 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className={`hover:bg-gray-50 transition-colors ${user.id === userProfile.id ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                            <span className="text-blue-700 font-medium text-sm">
                              {user.displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.displayName}
                              {user.id === userProfile.id && (
                                <span className="ml-2 text-xs text-blue-600">(Tu)</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="h-4 w-4 mr-2 text-gray-400" />
                          {user.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-medium rounded-full ${getRoleBadgeColor(user.role)}`}>
                          {getRoleName(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.role === 'student' && user.classId ? (
                          <div className="text-sm text-gray-900 flex items-center">
                            <Users className="h-4 w-4 mr-2 text-gray-400" />
                            {classes.find(c => c.id === user.classId)?.name || 'Classe non trovata'}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">-</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2 relative">
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setMenuOpenFor(prev => (prev === user.id ? null : user.id))}
                              className="text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                              disabled={!!roleUpdating[user.id]}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                            {menuOpenFor === user.id && (
                              <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                                <button
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${user.id === userProfile.id ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700'}`}
                                  onClick={() => (user.id === userProfile.id ? null : openRoleDialog(user))}
                                  disabled={user.id === userProfile.id}
                                >
                                  Cambia ruolo…
                                </button>
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(user)}
                            disabled={user.id === userProfile.id || !!roleUpdating[user.id]}
                            className={`${user.id === userProfile.id ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:text-red-700 hover:bg-red-50'}`}
                          >
                            <Trash2 className="h-4 w-4" />
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
    </PageContainer>
  );
};