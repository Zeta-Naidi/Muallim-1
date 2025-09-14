import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Users, UserCog, Trash2, Eye, Mail, Shield, Calendar, Clock, CheckCircle, AlertCircle, X, Filter, Search, GraduationCap, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Edit, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { User, UserRole, Student } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { EditUserModal } from '../../components/dialogs/EditUserModal';
import { canDeleteResource } from '../../utils/permissions';
import { actionLogger } from '../../services/actionLogger';

export const ManageUsers: React.FC = () => {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [showStudents, setShowStudents] = useState(false);
  const [sortDirection] = useState<'asc' | 'desc'>('desc');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState<Record<string, boolean>>({});
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleDialogUser, setRoleDialogUser] = useState<User | null>(null);
  const [userInfoModalOpen, setUserInfoModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [savingRole, setSavingRole] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [processingApproval, setProcessingApproval] = useState<string | null>(null);
  const [approvalConfirmOpen, setApprovalConfirmOpen] = useState(false);
  const [rejectionConfirmOpen, setRejectionConfirmOpen] = useState(false);
  const [userToApprove, setUserToApprove] = useState<User | null>(null);
  const [userToReject, setUserToReject] = useState<User | null>(null);

  // Advanced Filters
  const [filters, setFilters] = useState({
    name: '',
    email: '',
    role: '',
    accountStatus: ''
  });

  // Advanced Sorting - each field has its own sort state
  const [sortStates, setSortStates] = useState<{
    createdAt: 'desc' | 'asc' | null;
    name: 'desc' | 'asc' | null;
    email: 'desc' | 'asc' | null;
    role: 'desc' | 'asc' | null;
    accountStatus: 'desc' | 'asc' | null;
  }>({
    createdAt: 'desc',
    name: null,
    email: null,
    role: null,
    accountStatus: null
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        // Fetch users
        const usersQuery = collection(db, 'users');
        const usersDocs = await getDocs(usersQuery);
        const usersList = usersDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        
        // Fetch students
        const studentsQuery = collection(db, 'students');
        const studentsDocs = await getDocs(studentsQuery);
        const studentsList = studentsDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Student));
        
        setUsers(usersList);
        setStudents(studentsList);
        setFilteredUsers(usersList);
        setFilteredStudents(studentsList);
        
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
    if (showStudents) {
      // Filter students
      let filteredStudentsList = [...students];
      
      // Basic search
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        filteredStudentsList = filteredStudentsList.filter(student => 
          student.displayName.toLowerCase().includes(query) || 
          student.firstName.toLowerCase().includes(query) ||
          student.lastName.toLowerCase().includes(query) ||
          student.codiceFiscale.toLowerCase().includes(query) ||
          student.email.toLowerCase().includes(query)
        );
      }
      
      // Advanced filters
      if (filters.name) {
        filteredStudentsList = filteredStudentsList.filter(student => 
          student.displayName.toLowerCase().includes(filters.name.toLowerCase()) ||
          student.firstName.toLowerCase().includes(filters.name.toLowerCase()) ||
          student.lastName.toLowerCase().includes(filters.name.toLowerCase())
        );
      }
      
      if (filters.email) {
        filteredStudentsList = filteredStudentsList.filter(student => 
          student.email.toLowerCase().includes(filters.email.toLowerCase())
        );
      }
      
      // Apply advanced sorting - find the active sort field
      const activeSortField = Object.entries(sortStates).find(([_, order]) => order !== null)?.[0] as keyof typeof sortStates;
      const activeSortOrder = activeSortField ? sortStates[activeSortField] : 'desc';
      
      if (activeSortField && activeSortOrder) {
        filteredStudentsList.sort((a, b) => {
          let comparison = 0;
          
          switch (activeSortField) {
            case 'createdAt':
              const aDate = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt : new Date((a.createdAt as any).seconds * 1000)) : new Date(0);
              const bDate = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt : new Date((b.createdAt as any).seconds * 1000)) : new Date(0);
              comparison = aDate.getTime() - bDate.getTime();
              break;
            case 'name':
              comparison = a.displayName.localeCompare(b.displayName);
              break;
            case 'email':
              comparison = a.email.localeCompare(b.email);
              break;
            default:
              comparison = 0;
          }
          
          return activeSortOrder === 'desc' ? -comparison : comparison;
        });
      }
      
      setFilteredStudents(filteredStudentsList);
      setFilteredUsers([]);
    } else {
      // Filter users
      let filteredUsersList = [...users];
      
      // Basic filters
      if (roleFilter !== 'all') {
        filteredUsersList = filteredUsersList.filter(user => user.role === roleFilter);
      }
      
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        filteredUsersList = filteredUsersList.filter(user => 
          user.displayName.toLowerCase().includes(query) || 
          user.email.toLowerCase().includes(query)
        );
      }
      
      // Advanced filters
      if (filters.name) {
        filteredUsersList = filteredUsersList.filter(user => 
          user.displayName.toLowerCase().includes(filters.name.toLowerCase())
        );
      }
      
      if (filters.email) {
        filteredUsersList = filteredUsersList.filter(user => 
          user.email.toLowerCase().includes(filters.email.toLowerCase())
        );
      }
      
      if (filters.role) {
        filteredUsersList = filteredUsersList.filter(user => 
          user.role === filters.role
        );
      }
      
      if (filters.accountStatus) {
        filteredUsersList = filteredUsersList.filter(user => 
          user.accountStatus === filters.accountStatus
        );
      }
      
      // Apply advanced sorting - find the active sort field
      const activeSortField = Object.entries(sortStates).find(([_, order]) => order !== null)?.[0] as keyof typeof sortStates;
      const activeSortOrder = activeSortField ? sortStates[activeSortField] : 'desc';
      
      if (activeSortField && activeSortOrder) {
        filteredUsersList.sort((a, b) => {
          let comparison = 0;
          
          switch (activeSortField) {
            case 'createdAt':
              const aDate = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt : new Date((a.createdAt as any).seconds * 1000)) : new Date(0);
              const bDate = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt : new Date((b.createdAt as any).seconds * 1000)) : new Date(0);
              comparison = aDate.getTime() - bDate.getTime();
              break;
            case 'name':
              comparison = a.displayName.localeCompare(b.displayName);
              break;
            case 'email':
              comparison = a.email.localeCompare(b.email);
              break;
            case 'role':
              comparison = a.role.localeCompare(b.role);
              break;
            case 'accountStatus':
              const aStatus = a.accountStatus || 'active';
              const bStatus = b.accountStatus || 'active';
              comparison = aStatus.localeCompare(bStatus);
              break;
            default:
              comparison = 0;
          }
          
          return activeSortOrder === 'desc' ? -comparison : comparison;
        });
      }
      
      setFilteredUsers(filteredUsersList);
      setFilteredStudents([]);
    }
  }, [users, students, searchQuery, roleFilter, showStudents, sortDirection, filters, sortStates]);

  // Pagination logic
  const currentItems = showStudents ? filteredStudents : filteredUsers;
  const totalPages = Math.ceil(currentItems.length / ITEMS_PER_PAGE);
  const paginatedItems = currentItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to first page when switching between users/students or when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [showStudents, searchQuery, roleFilter]);

  const openDeleteDialog = (user: User) => {
    if (user.id === userProfile?.id) {
      setMessage({ type: 'error', text: 'Non puoi eliminare il tuo account' });
      return;
    }
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const openStudentDeleteDialog = (student: Student) => {
    setStudentToDelete(student);
    setShowDeleteDialog(true);
  };

  const openStudentInfoModal = (student: Student) => {
    setSelectedStudent(student);
    setUserInfoModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setUserToEdit(user);
    setEditModalOpen(true);
  };

  const handleUserUpdated = async (updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    setFilteredUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    setMessage({ type: 'success', text: 'Utente aggiornato con successo' });
    setTimeout(() => setMessage(null), 3000);
    
    // Log user update action
    if (userProfile) {
      await actionLogger.logAction(
        userProfile.id,
        userProfile.email,
        userProfile.role,
        'user_updated',
        {
          targetType: 'user',
          targetId: updatedUser.id,
          targetName: updatedUser.displayName,
          details: { updatedFields: ['profile'] }
        }
      );
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete && !studentToDelete) return;

    try {
      if (userToDelete) {
        await deleteDoc(doc(db, 'users', userToDelete.id));
        setUsers(prev => prev.filter(user => user.id !== userToDelete.id));
        setFilteredUsers(prev => prev.filter(user => user.id !== userToDelete.id));
        setMessage({ type: 'success', text: 'Utente eliminato con successo' });
        
        // Log user deletion
        if (userProfile) {
          await actionLogger.logAction(
            userProfile.id,
            userProfile.email,
            userProfile.role,
            'user_deleted',
            {
              targetType: 'user',
              targetId: userToDelete.id,
              targetName: userToDelete.displayName,
              details: { reason: 'admin_deletion' }
            }
          );
        }
      } else if (studentToDelete) {
        await deleteDoc(doc(db, 'students', studentToDelete.id));
        setStudents(prev => prev.filter(student => student.id !== studentToDelete.id));
        setFilteredStudents(prev => prev.filter(student => student.id !== studentToDelete.id));
        setMessage({ type: 'success', text: 'Studente eliminato con successo' });
        
        // Log student deletion
        if (userProfile) {
          await actionLogger.logAction(
            userProfile.id,
            userProfile.email,
            userProfile.role,
            'user_deleted',
            {
              targetType: 'student',
              targetId: studentToDelete.id,
              targetName: `${studentToDelete.firstName} ${studentToDelete.lastName}`,
              details: { reason: 'admin_deletion' }
            }
          );
        }
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Errore nell\'eliminazione:', error);
      setMessage({ type: 'error', text: 'Errore nell\'eliminazione' });
    } finally {
      setShowDeleteDialog(false);
      setUserToDelete(null);
      setStudentToDelete(null);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleRoleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRoleFilter(e.target.value as UserRole | 'all');
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSortToggle = (field: keyof typeof sortStates) => {
    setSortStates(prev => {
      const currentState = prev[field];
      const newStates = {
        createdAt: null as 'desc' | 'asc' | null,
        name: null as 'desc' | 'asc' | null,
        email: null as 'desc' | 'asc' | null,
        role: null as 'desc' | 'asc' | null,
        accountStatus: null as 'desc' | 'asc' | null
      };
      
      if (currentState === null) {
        newStates[field] = 'desc';
      } else if (currentState === 'desc') {
        newStates[field] = 'asc';
      } else {
        newStates[field] = null;
        newStates.createdAt = 'desc'; // Default back to createdAt desc
      }
      
      return newStates;
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setFilters({
      name: '',
      email: '',
      role: '',
      accountStatus: ''
    });
    setSortStates({
      createdAt: 'desc',
      name: null,
      email: null,
      role: null,
      accountStatus: null
    });
  };

  const handleChangeUserRole = async (user: User, newRole: UserRole) => {
    if (user.id === userProfile?.id) {
      setMessage({ type: 'error', text: 'Non puoi modificare il tuo ruolo.' });
      return;
    }
    if (user.role === newRole) return;

    const oldRole = user.role;
    try {
      setRoleUpdating(prev => ({ ...prev, [user.id]: true }));
      await updateDoc(doc(db, 'users', user.id), { role: newRole });
      // Optimistic local update
      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, role: newRole } : u)));
      setFilteredUsers(prev => prev.map(u => (u.id === user.id ? { ...u, role: newRole } : u)));
      setMessage({ type: 'success', text: `Ruolo aggiornato a ${getRoleName(newRole)} per ${user.displayName}` });
      setTimeout(() => setMessage(null), 2500);
      
      // Log role change
      if (userProfile) {
        await actionLogger.logAction(
          userProfile.id,
          userProfile.email,
          userProfile.role,
          'user_role_changed',
          {
            targetType: 'user',
            targetId: user.id,
            targetName: user.displayName,
            details: { oldRole, newRole }
          }
        );
      }
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

  const openApprovalConfirm = (user: User) => {
    setUserToApprove(user);
    setApprovalConfirmOpen(true);
  };

  const openRejectionConfirm = (user: User) => {
    setUserToReject(user);
    setRejectionConfirmOpen(true);
  };

  const handleApproveUser = async () => {
    if (!userProfile || !userToApprove) return;
    
    setProcessingApproval(userToApprove.id);
    
    try {
      await updateDoc(doc(db, 'users', userToApprove.id), {
        accountStatus: 'active',
        approvedBy: userProfile.id,
        approvedAt: new Date(),
        updatedAt: new Date()
      });

      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === userToApprove.id 
          ? { ...user, accountStatus: 'active', approvedBy: userProfile.id, approvedAt: new Date() }
          : user
      ));
      
      setFilteredUsers(prev => prev.map(user => 
        user.id === userToApprove.id 
          ? { ...user, accountStatus: 'active', approvedBy: userProfile.id, approvedAt: new Date() }
          : user
      ));

      setMessage({ type: 'success', text: 'Utente approvato con successo' });
      setTimeout(() => setMessage(null), 3000);
      
      // Log user approval
      await actionLogger.logAction(
        userProfile.id,
        userProfile.email,
        userProfile.role,
        'user_approved',
        {
          targetType: 'user',
          targetId: userToApprove.id,
          targetName: userToApprove.displayName,
          details: { previousStatus: 'pending_approval' }
        }
      );
      
      setApprovalConfirmOpen(false);
      setUserToApprove(null);
    } catch (error) {
      console.error('Error approving user:', error);
      setMessage({ type: 'error', text: 'Errore nell\'approvazione dell\'utente' });
    } finally {
      setProcessingApproval(null);
    }
  };

  const handleRejectUser = async () => {
    if (!userToReject || !userProfile) return;
    
    setProcessingApproval(userToReject.id);
    
    try {
      // Log user rejection before deletion
      await actionLogger.logAction(
        userProfile.id,
        userProfile.email,
        userProfile.role,
        'user_rejected',
        {
          targetType: 'user',
          targetId: userToReject.id,
          targetName: userToReject.displayName,
          details: { reason: 'admin_rejection', email: userToReject.email }
        }
      );
      
      await deleteDoc(doc(db, 'users', userToReject.id));
      
      // Update local state
      setUsers(prev => prev.filter(user => user.id !== userToReject.id));
      setFilteredUsers(prev => prev.filter(user => user.id !== userToReject.id));

      setMessage({ type: 'success', text: 'Richiesta rifiutata e profilo rimosso' });
      setTimeout(() => setMessage(null), 3000);
      setRejectionConfirmOpen(false);
      setUserToReject(null);
    } catch (error) {
      console.error('Error rejecting user:', error);
      setMessage({ type: 'error', text: 'Errore nel rifiuto della richiesta' });
    } finally {
      setProcessingApproval(null);
    }
  };

  if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'operatore')) {
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
      case 'operatore': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadge = (user: User) => {
    if (user.accountStatus === 'pending_approval') {
      return (
        <div className="w-3 h-3 bg-amber-500 rounded-full" title="In attesa di approvazione"></div>
      );
    }
    return (
      <div className="w-3 h-3 bg-green-500 rounded-full" title="Attivo"></div>
    );
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

      {/* Filters and Sorting */}
      <Card variant="elevated" className="mb-6 bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
          <CardTitle className="flex items-center text-gray-900">
            <Filter className="h-5 w-5 mr-2 text-blue-600" />
            Filtri e Ordinamento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {/* Basic Search and Role Filter */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
            <div>
              <Input
                label={showStudents ? "Cerca studenti" : "Cerca utenti"}
                placeholder={showStudents ? "Nome, cognome, codice fiscale..." : "Nome o email..."}
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
                disabled={showStudents}
              >
                <option value="all">Tutti</option>
                <option value="admin">Amministratori</option>
                <option value="teacher">Insegnanti</option>
                <option value="parent">Genitori</option>
                <option value="operatore">Operatori</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtra per stato
              </label>
              <select
                className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-3 px-4 transition-colors"
                onChange={(e) => setFilters(prev => ({ ...prev, accountStatus: e.target.value }))}
                value={filters.accountStatus}
                disabled={showStudents}
              >
                <option value="">Tutti</option>
                <option value="active">Attivi</option>
                <option value="pending_approval">In attesa di approvazione</option>
              </select>
            </div>

            <div className="flex items-end gap-3">
              <Button
                variant="outline"
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="px-3"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtri Avanzati
              </Button>
              
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showStudents}
                  onChange={(e) => setShowStudents(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Mostra solo studenti
                </span>
              </label>
              
              {(searchQuery || roleFilter !== 'all' || Object.values(filters).some(v => v)) && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="px-3"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Advanced Filters */}
          {filtersOpen && (
            <div className="border-t border-slate-200 pt-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                  <input
                    type="text"
                    placeholder="Filtra per nome..."
                    value={filters.name}
                    onChange={(e) => handleFilterChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="text"
                    placeholder="Filtra per email..."
                    value={filters.email}
                    onChange={(e) => handleFilterChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                
                {!showStudents && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ruolo Specifico</label>
                    <select
                      value={filters.role}
                      onChange={(e) => handleFilterChange('role', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">Tutti i ruoli</option>
                      <option value="admin">Amministratore</option>
                      <option value="teacher">Insegnante</option>
                      <option value="parent">Genitore</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sorting Row */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-slate-700 py-2">Ordina per:</span>
              
              <Button
                onClick={() => handleSortToggle('createdAt')}
                variant={sortStates.createdAt ? 'primary' : 'outline'}
                size="sm"
                className="text-xs"
              >
                {sortStates.createdAt === 'desc' ? <ArrowDown className="h-3 w-3 mr-1" /> : <ArrowUp className="h-3 w-3 mr-1" />}
                Data Registrazione
              </Button>
              
              <Button
                onClick={() => handleSortToggle('name')}
                variant={sortStates.name ? 'primary' : 'outline'}
                size="sm"
                className="text-xs"
              >
                {sortStates.name === 'desc' ? <ArrowDown className="h-3 w-3 mr-1" /> : <ArrowUp className="h-3 w-3 mr-1" />}
                Nome
              </Button>
              
              <Button
                onClick={() => handleSortToggle('email')}
                variant={sortStates.email ? 'primary' : 'outline'}
                size="sm"
                className="text-xs"
              >
                {sortStates.email === 'desc' ? <ArrowDown className="h-3 w-3 mr-1" /> : <ArrowUp className="h-3 w-3 mr-1" />}
                Email
              </Button>
              
              {!showStudents && (
                <Button
                  onClick={() => handleSortToggle('role')}
                  variant={sortStates.role ? 'primary' : 'outline'}
                  size="sm"
                  className="text-xs"
                >
                  {sortStates.role === 'desc' ? <ArrowDown className="h-3 w-3 mr-1" /> : <ArrowUp className="h-3 w-3 mr-1" />}
                  Ruolo
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-light">Caricamento degli utenti...</p>
        </div>
      ) : (showStudents ? filteredStudents.length > 0 : filteredUsers.length > 0) ? (
        <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50/50 to-purple-50/50 border-b border-gray-100">
            <CardTitle className="flex items-center text-gray-900">
              {showStudents ? (
                <>
                  <GraduationCap className="h-6 w-6 mr-3 text-green-600" />
                  Studenti ({filteredStudents.length})
                </>
              ) : (
                <>
                  <Users className="h-6 w-6 mr-3 text-blue-600" />
                  Utenti ({filteredUsers.length})
                </>
              )}
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
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleSortToggle('accountStatus')}>
                      <div className="flex items-center gap-1">
                        Stato
                        {sortStates.accountStatus === 'desc' && <ArrowDown className="h-3 w-3" />}
                        {sortStates.accountStatus === 'asc' && <ArrowUp className="h-3 w-3" />}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {showStudents ? (
                    (paginatedItems as Student[]).map(student => (
                      <motion.tr 
                        key={student.id} 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="hover:bg-blue-50/30 transition-all duration-200"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 flex items-center justify-center shadow-sm">
                              <span className="text-green-700 font-semibold text-sm">
                                {student.firstName.charAt(0).toUpperCase()}{student.lastName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-gray-900">
                                  {student.firstName} {student.lastName}
                                </div>
                              </div>
                              <div className="text-sm text-gray-500">
                                CF: {student.codiceFiscale}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-gray-600">
                            <Mail className="h-4 w-4 mr-2 text-gray-400" />
                            <span className="text-sm">{student.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1.5 inline-flex text-sm font-medium rounded-xl bg-green-100 text-green-800">
                            Studente
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            Attivo
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openStudentInfoModal(student)}
                              className="rounded-xl transition-all duration-200 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              leftIcon={<Eye className="h-4 w-4" />}
                            >
                              Info
                            </Button>
                            {canDeleteResource(userProfile?.role || 'student', 'students') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openStudentDeleteDialog(student)}
                                className="rounded-xl transition-all duration-200 text-red-600 hover:text-red-700 hover:bg-red-50"
                                leftIcon={<Trash2 className="h-4 w-4" />}
                              >
                                Elimina
                              </Button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    (paginatedItems as User[]).map(user => (
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
                          {getStatusBadge(user)}
                        </td>
                        <td className="px-6 py-4">
                        <div className="flex justify-end items-center gap-2">
                          <Button variant="ghost" onClick={() => openUserInfoModal(user)} title="Visualizza">
                            <Eye className="h-4 w-4 text-blue-600" />
                          </Button>

                          {user.accountStatus === 'pending_approval' && userProfile?.role === 'admin' ? (
                            <>
                              <Button variant="ghost" onClick={() => openRejectionConfirm(user)} title="Rifiuta">
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                              <Button variant="ghost" onClick={() => openApprovalConfirm(user)} title="Approva">
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                            </>
                          ) : (
                            <>
                              {/* Operators cannot edit their own account or admin accounts */}
                              {!(userProfile?.role === 'operatore' && (user.id === userProfile.id || user.role === 'admin')) && (
                                <Button variant="ghost" onClick={() => handleEditUser(user)} title="Modifica">
                                  <Edit className="h-4 w-4 text-blue-600" />
                                </Button>
                              )}
                            </>
                          )}

                          {canDeleteResource(userProfile?.role || 'student', 'users') && user.accountStatus !== 'pending_approval' && (
                            <Button variant="ghost" onClick={() => openDeleteDialog(user)} title="Elimina" disabled={user.id === userProfile.id}>
                              <Trash2 className={`h-4 w-4 ${user.id === userProfile.id ? 'opacity-50 cursor-not-allowed' : 'text-red-600'}`} />
                            </Button>
                          )}
                        </div>

                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
          <CardContent className="p-12 text-center">
            <UserCog className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              {showStudents ? 'Nessuno studente trovato' : 'Nessun utente trovato'}
            </h3>
            <p className="text-gray-600 max-w-md mx-auto mb-8">
              {searchQuery 
                ? `Nessun ${showStudents ? 'studente' : 'utente'} trovato con questi criteri di ricerca.` 
                : `Nessun ${showStudents ? 'studente' : 'utente'} trovato.`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="text-sm text-gray-600">Pagina {currentPage} di {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
      
      {/* Edit User Modal */}
      {editModalOpen && userToEdit && (
        <EditUserModal
          user={userToEdit}
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setUserToEdit(null);
          }}
          onUserUpdated={handleUserUpdated}
        />
      )}

      {/* Custom Delete Confirmation Dialog */}
      {showDeleteDialog && (userToDelete || studentToDelete) ? (
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
                Sei sicuro di voler eliminare {userToDelete ? 'l\'utente' : 'lo studente'}{' '}
                <span className="font-medium text-gray-900">
                  {userToDelete ? userToDelete.displayName : `${studentToDelete?.firstName} ${studentToDelete?.lastName}`}
                </span>?
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
                  setStudentToDelete(null);
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
      ) : null}
      
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
      {userInfoModalOpen && (selectedUser || selectedStudent) && (
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
                  <div className={`h-16 w-16 rounded-2xl border flex items-center justify-center shadow-sm ${
                    selectedStudent 
                      ? 'bg-gradient-to-br from-green-100 to-emerald-100 border-green-200' 
                      : 'bg-gradient-to-br from-blue-100 to-indigo-100 border-blue-200'
                  }`}>
                    <span className={`font-bold text-xl ${
                      selectedStudent ? 'text-green-700' : 'text-blue-700'
                    }`}>
                      {selectedStudent 
                        ? `${selectedStudent.firstName.charAt(0).toUpperCase()}${selectedStudent.lastName.charAt(0).toUpperCase()}`
                        : selectedUser?.displayName.charAt(0).toUpperCase()
                      }
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedStudent 
                        ? `${selectedStudent.firstName} ${selectedStudent.lastName}`
                        : selectedUser?.displayName
                      }
                      {selectedUser?.id === userProfile?.id && (
                        <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">Tu</span>
                      )}
                    </h2>
                    <p className="text-gray-600 flex items-center mt-1">
                      <Mail className="h-4 w-4 mr-2" />
                      {selectedStudent ? selectedStudent.email : selectedUser?.email}
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
                  {selectedStudent ? (
                    <GraduationCap className="h-5 w-5 mr-2 text-green-600" />
                  ) : (
                    <UserCog className="h-5 w-5 mr-2 text-blue-600" />
                  )} 
                  Informazioni Base
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Nome Completo</label>
                    <p className="text-gray-900 font-medium">
                      {selectedStudent 
                        ? `${selectedStudent.firstName} ${selectedStudent.lastName}`
                        : selectedUser?.displayName
                      }
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-gray-900">
                      {selectedStudent ? selectedStudent.email : selectedUser?.email}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Ruolo</label>
                    {selectedStudent ? (
                      <span className="inline-flex px-3 py-1 text-sm font-medium rounded-xl bg-green-100 text-green-800">
                        Studente
                      </span>
                    ) : (
                      <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-xl ${getRoleBadgeColor(selectedUser?.role || 'student')}`}>
                        {getRoleName(selectedUser?.role || 'student')}
                      </span>
                    )}
                  </div>
                  {selectedStudent && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Codice Fiscale</label>
                      <p className="text-gray-900 font-mono text-sm">{selectedStudent.codiceFiscale}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Account Details Section */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-green-600" />
                  Dettagli Account
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(selectedUser?.createdAt || selectedStudent?.createdAt) && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        Data Registrazione
                      </label>
                      <p className="text-gray-900">
                        {(() => {
                          const createdAt = selectedStudent?.createdAt || selectedUser?.createdAt;
                          if (!createdAt) return 'Non disponibile';
                          
                          return typeof createdAt === 'object' && 'seconds' in createdAt 
                            ? new Date((createdAt as any).seconds * 1000).toLocaleDateString('it-IT', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                            : new Date(createdAt).toLocaleDateString('it-IT', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              });
                        })()}
                      </p>
                    </div>
                  )}
                  {selectedStudent && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">ID Genitore</label>
                      <p className="text-gray-900 font-mono text-sm">{selectedStudent.parentId}</p>
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
                    {selectedUser ? (
                      <span className={`inline-flex items-center px-2 py-1 text-sm font-medium rounded-full ${
                        selectedUser.accountStatus === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          selectedUser.accountStatus === 'active' 
                            ? 'bg-green-400'
                            : 'bg-yellow-400'
                        }`}></div>
                        {selectedUser.accountStatus === 'active' ? 'Attivo' : 'In Attesa di Approvazione'}
                      </span>
                    ) : selectedStudent ? (
                      <span className={`inline-flex items-center px-2 py-1 text-sm font-medium rounded-full ${
                        selectedStudent.accountStatus === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          selectedStudent.accountStatus === 'active' 
                            ? 'bg-green-400'
                            : 'bg-yellow-400'
                        }`}></div>
                        {selectedStudent.accountStatus === 'active' ? 'Attivo' : 'In Attesa di Approvazione'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-800">
                        <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                        Non disponibile
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Permessi</label>
                    <p className="text-gray-900">
                      {selectedStudent ? 'Accesso studente' :
                       selectedUser?.role === 'admin' ? 'Amministratore completo' :
                       selectedUser?.role === 'teacher' ? 'Gestione classi e studenti' :
                       'Accesso studente'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions Section */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button
                  variant="outline"
                  onClick={() => {
                    setUserInfoModalOpen(false);
                    setSelectedUser(null);
                    setSelectedStudent(null);
                  }}
                  className="rounded-xl"
                >
                  Chiudi
                </Button>
                {selectedUser && selectedUser.id !== userProfile?.id && (
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
                    {canDeleteResource(userProfile?.role || 'student', 'users') && (
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
                    )}
                  </>
                )}
                {selectedStudent && (
                  <>
                    {canDeleteResource(userProfile?.role || 'student', 'students') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUserInfoModalOpen(false);
                          openStudentDeleteDialog(selectedStudent);
                        }}
                        className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50"
                        leftIcon={<Trash2 className="h-4 w-4" />}
                      >
                        Elimina Studente
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Approval Confirmation Dialog */}
      <AnimatePresence>
        {approvalConfirmOpen && userToApprove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4"
            >
              <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-6 rounded-t-2xl text-white">
                <h3 className="text-lg font-semibold flex items-center">
                  <Check className="h-5 w-5 mr-2" />
                  Conferma Approvazione
                </h3>
                <p className="text-green-100 mt-1">
                  Sei sicuro di voler approvare l'utente <span className="font-medium">{userToApprove.displayName}</span>?
                </p>
              </div>
              <div className="p-6">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <div className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800 mb-1">Cosa succederà:</p>
                      <ul className="text-xs text-green-700 space-y-1">
                        <li>• L'utente potrà accedere alla piattaforma</li>
                        <li>• Riceverà i permessi del ruolo: {getRoleName(userToApprove.role)}</li>
                        <li>• L'azione non può essere annullata</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setApprovalConfirmOpen(false);
                      setUserToApprove(null);
                    }}
                    disabled={processingApproval === userToApprove.id}
                  >
                    Annulla
                  </Button>
                  <Button
                    onClick={handleApproveUser}
                    isLoading={processingApproval === userToApprove.id}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    leftIcon={<Check className="h-4 w-4" />}
                  >
                    Sì, Approva
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rejection Confirmation Dialog */}
      <AnimatePresence>
        {rejectionConfirmOpen && userToReject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4"
            >
              <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 rounded-t-2xl text-white">
                <h3 className="text-lg font-semibold flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Conferma Rifiuto
                </h3>
                <p className="text-red-100 mt-1">
                  Sei sicuro di voler rifiutare la richiesta di <span className="font-medium">{userToReject.displayName}</span>?
                </p>
              </div>
              <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800 mb-1">Attenzione:</p>
                      <ul className="text-xs text-red-700 space-y-1">
                        <li>• Il profilo utente verrà eliminato definitivamente</li>
                        <li>• L'utente dovrà registrarsi nuovamente</li>
                        <li>• Questa azione non può essere annullata</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setRejectionConfirmOpen(false);
                      setUserToReject(null);
                    }}
                    disabled={processingApproval === userToReject.id}
                  >
                    Annulla
                  </Button>
                  <Button
                    onClick={handleRejectUser}
                    isLoading={processingApproval === userToReject.id}
                    className="bg-red-600 hover:bg-red-700 text-white"
                    leftIcon={<X className="h-4 w-4" />}
                  >
                    Sì, Rifiuta
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};