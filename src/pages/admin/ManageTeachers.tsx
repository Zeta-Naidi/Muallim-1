import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, Eye, Edit, Trash2, Check, X, Clock, ChevronDown, ChevronUp, Mail, Phone, MapPin, Calendar, Euro, History, Settings, CheckCircle, AlertCircle, Shield, Save, Filter, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { collection, query, where, orderBy, getDocs, addDoc, deleteDoc, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StudentDetailsDialog } from '../../components/dialogs/StudentDetailsDialog';
import { Class, TeacherPayment, TeacherType, Substitution } from '../../types';
import type { User } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

interface TeacherEditForm {
  teacherType: TeacherType;
  assignedClassId: string;
  assistantId: string;
  availableForSubstitution?: boolean;
}

interface PaymentForm {
  amount: string;
  paymentType: 'salary' | 'bonus' | 'reimbursement' | 'other';
  description: string;
  notes: string;
  month: string;
}

export const ManageTeachers: React.FC = () => {
  const { userProfile } = useAuth();
  const [teachers, setTeachers] = useState<User[]>([]);
  const [pendingTeachers, setPendingTeachers] = useState<User[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<User[]>([]);
  const [filteredPending, setFilteredPending] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [allTeachers, setAllTeachers] = useState<User[]>([]); // For assistant selection
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Filters (essential only)
  const [filterTeacherType, setFilterTeacherType] = useState<'' | TeacherType>('');
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);
  const [processingTeacher, setProcessingTeacher] = useState<string | null>(null);
  
  // Edit teacher state
  const [editingTeacher, setEditingTeacher] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TeacherEditForm>({
    teacherType: 'insegnante_regolare',
    assignedClassId: '',
    assistantId: ''
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const TEACHERS_PER_PAGE = 10;
  
  // Payment state
  const [paymentTeacher, setPaymentTeacher] = useState<User | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    amount: '',
    paymentType: 'salary',
    description: '',
    notes: '',
    month: format(new Date(), 'yyyy-MM')
  });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  
  // Payment history state
  const [paymentHistoryTeacher, setPaymentHistoryTeacher] = useState<User | null>(null);
  const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);
  const [teacherPayments, setTeacherPayments] = useState<TeacherPayment[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  // Reject confirmation state
  const [rejectTarget, setRejectTarget] = useState<User | null>(null);
  
  // View teacher details state
  const [viewingTeacher, setViewingTeacher] = useState<User | null>(null);
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);

  // Substitution dialog state
  const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
  const [subTeacher, setSubTeacher] = useState<User | null>(null);
  const [subForm, setSubForm] = useState({
    classId: '',
    date: '',
    startTime: '17:00',
    endTime: '19:00',
    reason: '',
    substituteTeacherId: ''
  });
  const [isCreatingSub, setIsCreatingSub] = useState(false);

  // Edit teacher dialog state (popup)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Substitutions history state (admin-only view)
  const [isLoadingSubs, setIsLoadingSubs] = useState(false);
  const [historySubs, setHistorySubs] = useState<Substitution[]>([]);
  const [currentSubPage, setCurrentSubPage] = useState(1);
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const handleToggleSubExpansion = (id: string) => setExpandedSubId(prev => (prev === id ? null : id));
  // Pending approvals mobile expansion
  const [expandedPendingId, setExpandedPendingId] = useState<string | null>(null);
  const handleTogglePendingExpansion = (id: string) => setExpandedPendingId(prev => (prev === id ? null : id));
  const [editingSubstitution, setEditingSubstitution] = useState<Substitution | null>(null);
  const [isEditSubDialogOpen, setIsEditSubDialogOpen] = useState(false);
  const [editSubForm, setEditSubForm] = useState({
    date: '',
    startTime: '',
    endTime: '',
    reason: '',
    substituteTeacherId: ''
  });
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const [selectedSubStatus, setSelectedSubStatus] = useState<'' | Substitution['status']>('');
  const [isUpdatingSubstitution, setIsUpdatingSubstitution] = useState(false);
  // Substitution destructive actions state
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Substitution | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Substitution | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPendingOpen, setIsPendingOpen] = useState(false);
  // History filters
  const [historyStatus, setHistoryStatus] = useState<'' | Substitution['status']>('');
  const [historyDate, setHistoryDate] = useState<string>(''); // YYYY-MM-DD (specific day)

  const visibleHistory = useMemo(() => {
    let list = [...historySubs];
    
    // Apply search filter
    if (subSearchQuery) {
      const query = subSearchQuery.toLowerCase();
      list = list.filter(s => 
        s.className?.toLowerCase().includes(query) ||
        s.teacherName?.toLowerCase().includes(query) ||
        s.reason?.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (selectedSubStatus) {
      list = list.filter(s => s.status === selectedSubStatus);
    }
    
    // Apply date filter
    if (historyDate) {
      if (historyStatus === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        list = list.filter(s => new Date(s.date) >= weekAgo);
      } else if (historyStatus === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        list = list.filter(s => new Date(s.date) >= monthAgo);
      } else {
        list = list.filter(s => s.date === historyDate);
      }
    }
    
    // Sort by date (most recent first by default)
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return list;
  }, [historySubs, subSearchQuery, selectedSubStatus, historyStatus, historyDate]);

  // Handle opening the substitution dialog
  const handleOpenSubDialog = (teacher: User) => {
    // Determine the teacher's assigned class (by explicit assignedClassId or by classes mapping)
    const assigned = classes.find(c => c.teacherId === teacher.id || c.id === (teacher as any).assignedClassId);
    setSubTeacher(teacher);
    // Prefill form with detected class and sensible defaults
    setSubForm({
      classId: assigned?.id || '',
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: '17:00',
      endTime: '19:00',
      reason: '',
      substituteTeacherId: ''
    });
    setIsSubDialogOpen(true);
  };

  // Open payment dialog for selected teacher
  const handleOpenPaymentDialog = (teacher: User) => {
    setPaymentTeacher(teacher);
    setIsPaymentDialogOpen(true);
  };

  // Notifications moved to global Header

  // Ensure "Pending Approvals" starts collapsed even after HMR
  useEffect(() => {
    setIsPendingOpen(false);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile || userProfile.role !== 'admin') return;
      
      setIsLoading(true);
      setIsLoadingSubs(true);
      
      try {
        // Fetch all teacher accounts
        const teachersQuery = query(
          collection(db, 'users'),
          where('role', '==', 'teacher'),
          orderBy('createdAt', 'desc')
        );
        const teachersDocs = await getDocs(teachersQuery);
        const allTeachers = teachersDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate() || new Date(),
            birthDate: data.birthDate?.toDate() || null,
          } as User;
        });

        // Separate approved and pending teachers
        const approved = allTeachers.filter(teacher => teacher.accountStatus === 'active');
        const pending = allTeachers.filter(teacher => teacher.accountStatus === 'pending_approval');

        setTeachers(approved);
        setPendingTeachers(pending);
        setFilteredTeachers(approved);
        setFilteredPending(pending);
        setAllTeachers(approved); // For assistant selection

        // Notification creation is handled by Header.tsx real-time listener
        // No need to create notifications here to avoid duplicates

        // Fetch classes
        const classesQuery = query(collection(db, 'classes'));
        const classesDocs = await getDocs(classesQuery);
        const fetchedClasses = classesDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));
        setClasses(fetchedClasses);

        // Substitutions stream (all, latest date first) — realtime updates
        const historyQueryRef = query(
          collection(db, 'substitutions'),
          orderBy('date', 'desc')
        );
        const unsub = onSnapshot(historyQueryRef, (snapshot) => {
          const history = snapshot.docs.map(docSnap => {
            const data: any = docSnap.data();
            return {
              ...data,
              id: docSnap.id,
              date: data?.date?.toDate ? data.date.toDate() : (data?.date ? new Date(data.date) : new Date()),
            } as Substitution;
          });
          setHistorySubs(history);
          setIsLoadingSubs(false);
        }, (err) => {
          console.error('History snapshot error:', err);
          setIsLoadingSubs(false);
        });

        // Return unsubscribe to stop listener when component unmounts or deps change
        return unsub;
      } catch (error) {
        console.error('Error fetching teachers:', error);
        setMessage({ type: 'error', text: 'Errore nel caricamento dei dati' });
        setIsLoadingSubs(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    // If fetchData returns an unsubscribe function, store it for cleanup
    let cleanup: (() => void) | undefined;
    fetchData().then((maybeUnsub) => {
      if (typeof maybeUnsub === 'function') cleanup = maybeUnsub;
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, [userProfile]);

  // Notifications UI is handled by Header

  useEffect(() => {
    // Apply filters to both approved and pending teachers
    let filteredApproved = [...teachers];
    let filteredPendingList = [...pendingTeachers];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredApproved = filteredApproved.filter(teacher => 
        teacher.displayName.toLowerCase().includes(query) || 
        teacher.email.toLowerCase().includes(query)
      );
      filteredPendingList = filteredPendingList.filter(teacher => 
        teacher.displayName.toLowerCase().includes(query) || 
        teacher.email.toLowerCase().includes(query)
      );
    }

    // Advanced filters (applied to approved teachers only)
    if (filterTeacherType) {
      filteredApproved = filteredApproved.filter(t => t.teacherType === filterTeacherType);
    }
    if (filterClassId) {
      filteredApproved = filteredApproved.filter(t =>
        t.assignedClassId === filterClassId ||
        classes.some(c => c.id === filterClassId && c.teacherId === t.id)
      );
    }
    // Assistant and availability filters removed
    setFilteredTeachers(filteredApproved);
    setFilteredPending(filteredPendingList);
  }, [teachers, pendingTeachers, classes, searchQuery, filterTeacherType, filterClassId]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterTeacherType, filterClassId]);

  const handleApproveTeacher = async (teacherId: string) => {
    if (!userProfile) return;
    
    setProcessingTeacher(teacherId);
    
    try {
      await updateDoc(doc(db, 'users', teacherId), {
        accountStatus: 'active',
        approvedBy: userProfile.id,
        approvedAt: new Date(),
        updatedAt: new Date()
      });

      // Move teacher from pending to approved
      const teacher = pendingTeachers.find(t => t.id === teacherId);
      if (teacher) {
        const updatedTeacher = {
          ...teacher,
          accountStatus: 'active' as const,
          approvedBy: userProfile.id,
          approvedAt: new Date()
        };
        
        setTeachers(prev => [...prev, updatedTeacher]);
        setPendingTeachers(prev => prev.filter(t => t.id !== teacherId));
        setAllTeachers(prev => [...prev, updatedTeacher]);
      }

      setMessage({ type: 'success', text: 'Insegnante approvato con successo' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error approving teacher:', error);
      setMessage({ type: 'error', text: 'Errore nell\'approvazione dell\'insegnante' });
    } finally {
      setProcessingTeacher(null);
    }
  };

  const openRejectDialog = (teacher: User) => {
    setRejectTarget(teacher);
  };

  const handleRejectTeacher = async (teacherId: string) => {
    setProcessingTeacher(teacherId);
    try {
      // Remove Firestore profile document only (do not delete from Firebase Auth)
      await deleteDoc(doc(db, 'users', teacherId));
      setPendingTeachers(prev => prev.filter(t => t.id !== teacherId));
      setMessage({ type: 'success', text: 'Richiesta rifiutata e profilo rimosso' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error rejecting teacher:', error);
      // Try to extract more details from Firebase Functions errors
      const err = error as any;
      const code = err?.code || err?.name;
      const details = err?.details || err?.message || 'N/A';
      setMessage({
        type: 'error',
        text: `Errore nel rifiuto della richiesta. Codice: ${code || 'sconosciuto'} • Dettagli: ${details}`
      });
    } finally {
      setProcessingTeacher(null);
      setRejectTarget(null);
    }
  };

  const handleEditTeacher = (teacher: User) => {
    setEditingTeacher(teacher.id);
    const assignedFromClasses = (teacher.assignedClassId) || classes.find(c => c.teacherId === teacher.id)?.id || '';
    setEditForm({
      teacherType: teacher.teacherType || 'insegnante_regolare',
      assignedClassId: assignedFromClasses,
      assistantId: teacher.assistantId || '',
      availableForSubstitution: !!teacher.availableForSubstitution,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveTeacherEdit = async (teacherId: string) => {
    try {
      const firestoreUpdates: Record<string, any> = {
        teacherType: editForm.teacherType,
        assignedClassId: editForm.teacherType === 'assistente' ? null : (editForm.assignedClassId || null),
        assistantId: editForm.assistantId || null,
        availableForSubstitution: !!editForm.availableForSubstitution,
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'users', teacherId), firestoreUpdates);

      // Sync classes: clear any class currently pointing to this teacher, then set the selected one
      try {
        // Clear previous assignment(s)
        const currentClass = classes.find(c => c.teacherId === teacherId);
        if (currentClass && currentClass.id !== editForm.assignedClassId && editForm.teacherType !== 'assistente') {
          await updateDoc(doc(db, 'classes', currentClass.id), { teacherId: null, teacherName: null, updatedAt: new Date() } as any);
        }
        // Set new assignment
        if (editForm.teacherType !== 'assistente' && editForm.assignedClassId) {
          const t = teachers.find(t => t.id === teacherId);
          await updateDoc(doc(db, 'classes', editForm.assignedClassId), { teacherId, teacherName: t?.displayName || '', updatedAt: new Date() } as any);
        }
      } catch (e) {
        console.warn('Class sync failed:', e);
      }

      // Local state should not contain nulls for optional strings
      const localUpdates: Partial<User> = {
        teacherType: firestoreUpdates.teacherType,
        assignedClassId: firestoreUpdates.assignedClassId ?? undefined,
        assistantId: firestoreUpdates.assistantId ?? undefined,
        availableForSubstitution: firestoreUpdates.availableForSubstitution,
      };

      setTeachers(prev => prev.map(teacher => 
        teacher.id === teacherId 
          ? { ...teacher, ...localUpdates }
          : teacher
      ));

      setEditingTeacher(null);
      setIsEditDialogOpen(false);
      setMessage({ type: 'success', text: 'Insegnante aggiornato con successo' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error updating teacher:', error);
      setMessage({ type: 'error', text: 'Errore nell\'aggiornamento dell\'insegnante' });
    }
  };

  const handleAddPayment = async () => {
    if (!paymentTeacher || !paymentForm.amount || !userProfile) return;

    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) {
      setMessage({ type: 'error', text: 'Inserire un importo valido' });
      return;
    }

    setIsSubmittingPayment(true);

    try {
      const paymentData = {
        teacherId: paymentTeacher.id,
        teacherName: paymentTeacher.displayName,
        amount,
        date: new Date(),
        month: paymentForm.month,
        paymentType: paymentForm.paymentType,
        description: paymentForm.description.trim(),
        notes: paymentForm.notes.trim(),
        createdBy: userProfile.id,
        createdAt: new Date(),
      };

      await addDoc(collection(db, 'teacherPayments'), paymentData);

      setMessage({ type: 'success', text: 'Pagamento registrato con successo' });
      
      // Reset form and close dialog
      setPaymentForm({
        amount: '',
        paymentType: 'salary',
        description: '',
        notes: '',
        month: format(new Date(), 'yyyy-MM')
      });
      setIsPaymentDialogOpen(false);
      setPaymentTeacher(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error recording payment:', error);
      setMessage({ type: 'error', text: 'Errore nella registrazione del pagamento' });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleViewPaymentHistory = async (teacher: User) => {
    setPaymentHistoryTeacher(teacher);
    setIsLoadingPayments(true);
    setIsPaymentHistoryOpen(true);

    try {
      const paymentsQuery = query(
        collection(db, 'teacherPayments'),
        where('teacherId', '==', teacher.id),
        orderBy('date', 'desc')
      );
      const paymentsDocs = await getDocs(paymentsQuery);
      const payments = paymentsDocs.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          date: data.date?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
        } as TeacherPayment;
      });
      setTeacherPayments(payments);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      setMessage({ type: 'error', text: 'Errore nel caricamento dello storico pagamenti' });
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const handleToggleTeacherExpansion = (teacherId: string) => {
    setExpandedTeacherId(expandedTeacherId === teacherId ? null : teacherId);
  };

  const formatDate = (date: Date | null): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return 'Data non valida';
    }
    return format(date, 'd MMMM yyyy', { locale: it });
  };

  const getTeacherTypeLabel = (type?: TeacherType) => {
    switch (type) {
      case 'insegnante_regolare': return 'Regolare';
      case 'insegnante_volontario': return 'Volontario';
      case 'assistente': return 'Assistente';
      default: return 'N/A';
    }
  };

  const getTeacherTypeColor = (type?: TeacherType) => {
    switch (type) {
      case 'insegnante_regolare': return 'bg-blue-100 text-blue-800';
      case 'insegnante_volontario': return 'bg-green-100 text-green-800';
      case 'assistente': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'salary': return 'Stipendio';
      case 'reimbursement': return 'Rimborso';
      default: return type;
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
                <Users className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Gestione Insegnanti</h1>
                <p className="text-blue-100 mt-1">Approva le richieste di registrazione degli insegnanti e gestisci gli account</p>
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

      {/* Revoke Substitution Dialog */}
      <AnimatePresence>
        {isRevokeDialogOpen && revokeTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              if (!isRevoking) {
                setIsRevokeDialogOpen(false);
                setRevokeTarget(null);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-5 border-b border-slate-200">
                <h3 className="text-lg font-medium text-slate-900">Conferma revoca</h3>
                <p className="text-sm text-slate-600 mt-1">
                  {revokeTarget.className} • {format(new Date(revokeTarget.date), 'dd MMM yyyy', { locale: it })}
                </p>
              </div>
              <div className="px-6 py-4 text-sm text-slate-700">
                La supplenza verrà revocata e il sostituto non vedrà più la classe.
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!isRevoking) {
                      setIsRevokeDialogOpen(false);
                      setRevokeTarget(null);
                    }
                  }}
                  disabled={isRevoking}
                >
                  Annulla
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={isRevoking}
                  onClick={async () => {
                    if (!revokeTarget) return;
                    setIsRevoking(true);
                    try {
                      await updateDoc(doc(db, 'substitutions', revokeTarget.id), {
                        status: 'rejected',
                        rejectedAt: new Date().toISOString(),
                        rejectedBy: userProfile?.id,
                      });
                      setHistorySubs(prev => prev.map(sub =>
                        sub.id === revokeTarget.id ? { ...sub, status: 'rejected' } : sub
                      ));
                      setIsRevokeDialogOpen(false);
                      setRevokeTarget(null);
                    } catch (e) {
                      console.error('Error revoking substitution:', e);
                      alert('Errore durante la revoca della supplenza');
                    } finally {
                      setIsRevoking(false);
                    }
                  }}
                >
                  {isRevoking ? 'Revocando...' : 'Conferma revoca'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Substitution Dialog */}
      <AnimatePresence>
        {isDeleteDialogOpen && deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              if (!isDeleting) {
                setIsDeleteDialogOpen(false);
                setDeleteTarget(null);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-5 border-b border-slate-200">
                <h3 className="text-lg font-medium text-slate-900">Elimina supplenza</h3>
                <p className="text-sm text-slate-600 mt-1">
                  {deleteTarget.className} • {format(new Date(deleteTarget.date), 'dd MMM yyyy', { locale: it })}
                </p>
              </div>
              <div className="px-6 py-4 text-sm text-slate-700">
                Questa azione è definitiva e non può essere annullata.
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!isDeleting) {
                      setIsDeleteDialogOpen(false);
                      setDeleteTarget(null);
                    }
                  }}
                  disabled={isDeleting}
                >
                  Annulla
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={isDeleting}
                  onClick={async () => {
                    if (!deleteTarget) return;
                    setIsDeleting(true);
                    try {
                      await deleteDoc(doc(db, 'substitutions', deleteTarget.id));
                      setHistorySubs(prev => prev.filter(sub => sub.id !== deleteTarget.id));
                      setIsDeleteDialogOpen(false);
                      setDeleteTarget(null);
                    } catch (e) {
                      console.error('Error deleting substitution:', e);
                      alert('Errore durante l\'eliminazione della supplenza');
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                >
                  {isDeleting ? 'Eliminando...' : 'Elimina'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Teacher Dialog */}
      <AnimatePresence>
        {isEditDialogOpen && editingTeacher && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white/95 backdrop-blur-md rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl border border-white/20"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-light text-gray-900 flex items-center">
                  <Edit className="h-5 w-5 mr-2 text-blue-600" />
                  Modifica Insegnante
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    value={editForm.teacherType}
                    onChange={(e) => setEditForm(prev => ({
                      ...prev,
                      teacherType: e.target.value as TeacherType,
                      assignedClassId: e.target.value === 'assistente' ? '' : prev.assignedClassId
                    }))}
                  >
                    <option value="insegnante_regolare">Insegnante Regolare</option>
                    <option value="insegnante_volontario">Insegnante Volontario</option>
                    <option value="assistente">Assistente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Classe Assegnata</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-50"
                    value={editForm.assignedClassId}
                    onChange={(e) => setEditForm(prev => ({ ...prev, assignedClassId: e.target.value }))}
                    disabled={editForm.teacherType === 'assistente'}
                  >
                    <option value="">Nessuna classe</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.turno ? ` – ${c.turno}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assistente</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    value={editForm.assistantId}
                    onChange={(e) => setEditForm(prev => ({ ...prev, assistantId: e.target.value }))}
                  >
                    <option value="">Nessun assistente</option>
                    {allTeachers.filter(t => t.teacherType === 'assistente' && t.id !== editingTeacher).map(t => (
                      <option key={t.id} value={t.id}>{t.displayName}</option>
                    ))}
                  </select>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <input
                      id="availableSub"
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={!!editForm.availableForSubstitution}
                      onChange={(e) => setEditForm(prev => ({ ...prev, availableForSubstitution: e.target.checked }))}
                    />
                    <label htmlFor="availableSub" className="text-sm font-medium text-gray-700">Disponibile per supplenze</label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-7">L'insegnante potrà ricevere richieste di supplenza</p>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                <Button 
                  variant="ghost" 
                  onClick={() => setIsEditDialogOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                >
                  Annulla
                </Button>
                <Button 
                  onClick={() => editingTeacher && handleSaveTeacherEdit(editingTeacher)} 
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Salva Modifiche
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teacher Details Dialog */}
      <AnimatePresence>
        {isViewDetailsOpen && viewingTeacher && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setIsViewDetailsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white/95 backdrop-blur-md rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-xl border border-white/20 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-light text-gray-900 flex items-center">
                  <Eye className="h-5 w-5 mr-2 text-blue-600" />
                  Dettagli Insegnante
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsViewDetailsOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo</label>
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900">
                    {viewingTeacher.displayName}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900">
                    {viewingTeacher.email}
                  </div>
                </div>

                {viewingTeacher.phoneNumber && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Telefono</label>
                    <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900">
                      {viewingTeacher.phoneNumber}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Indirizzo</label>
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900">
                    {viewingTeacher.address || 'Non specificato'}
                  </div>
                </div>

                {viewingTeacher.birthDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data di Nascita</label>
                    <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900">
                      {formatDate(viewingTeacher.birthDate)}
                    </div>
                  </div>
                )}

                {viewingTeacher.gender && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Genere</label>
                    <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900">
                      {viewingTeacher.gender === 'male' ? 'Maschio' : 'Femmina'}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Registrazione</label>
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-900">
                    {formatDate(viewingTeacher.createdAt)}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      In attesa di approvazione
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">L'insegnante è in attesa della tua approvazione</p>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setIsViewDetailsOpen(false);
                    openRejectDialog(viewingTeacher);
                  }}
                  className="px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-2" />
                  Rifiuta
                </Button>
                <Button 
                  onClick={() => {
                    setIsViewDetailsOpen(false);
                    handleApproveTeacher(viewingTeacher.id);
                  }} 
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Approva Insegnante
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Confirmation Dialog */}
      <AnimatePresence>
        {rejectTarget && (
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
              className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-md border border-white/20"
            >
              <div className="bg-gradient-to-r from-red-600 via-red-600 to-red-700 p-6 rounded-t-2xl text-white">
                <h3 className="text-lg font-semibold">Conferma rifiuto</h3>
                <p className="text-red-100 mt-1">
                  Rifiutare la richiesta di <span className="font-medium">{rejectTarget.displayName}</span>?<br />
                  L'operazione eliminerà l'account e i dati profilo.
                </p>
              </div>
              <div className="px-6 py-4 bg-slate-50/50 rounded-b-2xl flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setRejectTarget(null)}
                  className="text-slate-600 hover:text-slate-800 hover:bg-white"
                  disabled={processingTeacher === rejectTarget.id}
                >
                  Annulla
                </Button>
                <Button
                  onClick={() => handleRejectTeacher(rejectTarget.id)}
                  isLoading={processingTeacher === rejectTarget.id}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
                >
                  Rifiuta definitivamente
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notifications bell is now global in Header */}


      
      {/* Approved Teachers */}
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-0">
          {/* Enhanced Filters Section */}
          <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 border-b border-white/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-xl mr-3">
                  <Search className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Filtri Avanzati</h3>
                  <p className="text-sm text-gray-600 font-normal">Cerca e filtra gli insegnanti</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFiltersOpen(o => !o)}
                  className="sm:hidden text-gray-600 hover:text-gray-800 rounded-xl"
                  aria-expanded={filtersOpen}
                  aria-controls="teachers-filters"
                >
                  <svg className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/></svg>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterTeacherType('');
                    setFilterClassId('');
                  }}
                  className="hidden sm:inline-flex text-gray-600 hover:text-gray-800 rounded-xl"
                >
                  <X className="h-4 w-4 mr-1" />
                  Reset Filtri
                </Button>
              </div>
            </div>
            
            <div className="p-6" id="teachers-filters">
              <div className={`${filtersOpen ? 'grid' : 'hidden'} sm:grid grid-cols-1 md:grid-cols-3 gap-4`}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center">
                    <Search className="h-4 w-4 mr-1 text-gray-500" />
                    Nome Insegnante
                  </label>
                  <Input
                    type="text"
                    placeholder="Cerca per nome o email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border-gray-200 focus:border-blue-400 focus:ring-blue-400/20"
                  />
                </div>

                <div className="space-y-2 hidden md:block">
                  <label className="text-sm font-medium text-gray-700 flex items-center">
                    <Filter className="h-4 w-4 mr-1 text-gray-500" />
                    Tipo Insegnante
                  </label>
                  <select
                    value={filterTeacherType}
                    onChange={(e) => setFilterTeacherType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 bg-white"
                  >
                    <option value="">Tutti</option>
                    <option value="insegnante_regolare">Regolare</option>
                    <option value="insegnante_volontario">Volontario</option>
                    <option value="assistente">Assistente</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center">
                    <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                    Classe Assegnata
                  </label>
                  <select
                    value={filterClassId}
                    onChange={(e) => setFilterClassId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 bg-white"
                  >
                    <option value="">Tutte le classi</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.turno ? ` – ${c.turno}` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Summary removed on teachers page as requested */}
            </div>
          </div>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mx-auto"></div>
              <p className="mt-2 text-slate-600">Caricamento insegnanti...</p>
            </div>
          ) : filteredTeachers.length > 0 ? (
            <>
              {/* Mobile: compact cards with expand-on-tap */}
              <div className="sm:hidden mt-6 space-y-3">
                {filteredTeachers.map((teacher) => {
                  const assignedClass = classes.find(c => c.teacherId === teacher.id || c.id === teacher.assignedClassId);
                  const isOpen = expandedTeacherId === teacher.id;
                  return (
                    <motion.div
                      key={teacher.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border border-slate-200 rounded-2xl bg-white/90 backdrop-blur p-3 shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleTeacherExpansion(teacher.id)}
                        className="w-full flex items-center justify-between"
                        aria-expanded={isOpen}
                        aria-controls={`teacher-${teacher.id}-details`}
                      >
                        <div className="flex items-center gap-3 text-left">
                          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center shadow-sm">
                            <span className="text-blue-700 font-semibold text-sm">
                              {teacher.displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{teacher.displayName}</div>
                            <span className={`mt-0.5 inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${getTeacherTypeColor(teacher.teacherType)}`}>
                              {getTeacherTypeLabel(teacher.teacherType)}
                            </span>
                          </div>
                        </div>
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        )}
                      </button>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            id={`teacher-${teacher.id}-details`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-3 space-y-2 border-t border-slate-100 pt-3"
                          >
                            <div className="flex items-center text-slate-600 text-sm">
                              <Mail className="h-4 w-4 mr-2 text-slate-400" />
                              {teacher.email}
                            </div>
                            <div className="text-sm text-slate-600">
                              <span className="font-medium text-slate-700">Classe: </span>
                              {assignedClass ? (
                                <span className="text-slate-800">{assignedClass.name}</span>
                              ) : (
                                <span className="text-slate-400">Non assegnata</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditTeacher(teacher)}
                                className="rounded-xl text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                leftIcon={<Edit className="h-4 w-4" />}
                                aria-label="Modifica docente"
                              >
                                Modifica
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenSubDialog(teacher)}
                                className="rounded-xl text-green-600 hover:text-green-700 hover:bg-green-50"
                                leftIcon={<Calendar className="h-4 w-4" />}
                                aria-label="Assegna supplenza"
                              >
                                Supplenza
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenPaymentDialog(teacher)}
                                className="rounded-xl text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                leftIcon={<Euro className="h-4 w-4" />}
                                aria-label="Gestisci pagamenti"
                              >
                                Pagamento
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>

              {/* Desktop: original table view */}
              <div className="hidden sm:block mt-6 bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gradient-to-r from-gray-50/80 to-gray-100/80 backdrop-blur-sm">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Docente</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Email</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Tipo</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Classe</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredTeachers.map(teacher => {
                      const assignedClass = classes.find(c => c.teacherId === teacher.id || c.id === teacher.assignedClassId);
                      
                      return (
                        <motion.tr 
                          key={teacher.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          className="hover:bg-blue-50/30 transition-all duration-200"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center shadow-sm">
                                <span className="text-blue-700 font-semibold text-sm">
                                  {teacher.displayName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">
                                  {teacher.displayName}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center text-gray-600">
                              <Mail className="h-4 w-4 mr-2 text-gray-400" />
                              <span className="text-sm">{teacher.email}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1.5 inline-flex text-sm font-medium rounded-xl ${getTeacherTypeColor(teacher.teacherType)}`}>
                              {getTeacherTypeLabel(teacher.teacherType)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              {assignedClass ? (
                                <span className="font-medium text-gray-900">{assignedClass.name}</span>
                              ) : (
                                <span className="text-gray-400">Non assegnata</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditTeacher(teacher)}
                                className="rounded-xl transition-all duration-200 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                leftIcon={<Edit className="h-4 w-4" />}
                              >
                                Modifica
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenSubDialog(teacher)}
                                className="rounded-xl transition-all duration-200 text-green-600 hover:text-green-700 hover:bg-green-50"
                                leftIcon={<Calendar className="h-4 w-4" />}
                              >
                                Supplenza
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenPaymentDialog(teacher)}
                                className="rounded-xl transition-all duration-200 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                leftIcon={<Euro className="h-4 w-4" />}
                              >
                                Pagamento
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                {searchQuery ? 'Nessun insegnante trovato' : 'Nessun insegnante approvato'}
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {searchQuery 
                  ? 'Nessun risultato per la ricerca corrente.'
                  : 'Non ci sono ancora insegnanti approvati nel sistema.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Substitutions Management */}
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Supplenze</h3>
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
              {visibleHistory.length}
            </span>
          </div>
        </div>
        <div className="p-6">
          {/* Enhanced Filters and Search */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Cerca per classe, insegnante o motivo..."
                  value={subSearchQuery}
                  onChange={(e) => setSubSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setSubSearchQuery('');
                  setSelectedSubStatus('');
                  setHistoryDate('');
                  setHistoryStatus('');
                }}
                className="text-slate-600 hover:text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                <X className="h-4 w-4 mr-2" />
                Pulisci tutto
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data</label>
                <input
                  type="date"
                  className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2"
                  value={historyDate}
                  onChange={(e) => setHistoryDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Stato</label>
                <select
                  className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2"
                  value={selectedSubStatus}
                  onChange={(e) => setSelectedSubStatus(e.target.value as any)}
                >
                  <option value="">Tutti gli stati</option>
                  <option value="pending">In attesa</option>
                  <option value="assigned">Assegnata</option>
                  <option value="approved">Approvata</option>
                  <option value="rejected">Rifiutata</option>
                  <option value="completed">Completata</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Periodo</label>
                <select
                  className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2"
                  value={historyStatus}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'today') {
                      setHistoryDate(new Date().toISOString().split('T')[0]);
                    } else if (value === 'week') {
                      const weekAgo = new Date();
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      setHistoryDate(weekAgo.toISOString().split('T')[0]);
                    } else if (value === 'month') {
                      const monthAgo = new Date();
                      monthAgo.setMonth(monthAgo.getMonth() - 1);
                      setHistoryDate(monthAgo.toISOString().split('T')[0]);
                    } else {
                      setHistoryDate('');
                    }
                    setHistoryStatus(value as any);
                  }}
                >
                  <option value="">Tutti i periodi</option>
                  <option value="today">Oggi</option>
                  <option value="week">Ultima settimana</option>
                  <option value="month">Ultimo mese</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ordina per</label>
                <select className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2">
                  <option value="date-desc">Data (più recente)</option>
                  <option value="date-asc">Data (più vecchia)</option>
                  <option value="status">Stato</option>
                  <option value="class">Classe</option>
                </select>
              </div>
            </div>
          </div>

          {isLoadingSubs ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mx-auto"></div>
              <p className="text-slate-600 mt-2">Caricamento supplenze...</p>
            </div>
          ) : visibleHistory.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">Nessuna supplenza</h3>
              <p className="text-gray-500">Non ci sono ancora supplenze nel sistema.</p>
            </div>
          ) : (
            (() => {
              const itemsPerPage = 3;
              const startIndex = (currentSubPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const paginatedSubs = visibleHistory.slice(startIndex, endIndex);
              const totalPages = Math.ceil(visibleHistory.length / itemsPerPage);

              return (
                <>
                  <div className="space-y-4">
                    {paginatedSubs.map((s) => {
                      // Compute if the substitution is completed based on end time vs now
                      const endMatch = (s.endTime || '').match(/^(\d{1,2}):(\d{2})$/);
                      const endDate = new Date(s.date);
                      if (endMatch) {
                        endDate.setHours(parseInt(endMatch[1], 10), parseInt(endMatch[2], 10), 0, 0);
                      } else {
                        endDate.setHours(23, 59, 59, 999);
                      }
                      const done = endDate.getTime() < new Date().getTime();
                      const canEdit = s.status === 'pending' || s.status === 'assigned';
                      
                      return (
                        <motion.div 
                          key={s.id} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-all duration-200 hover:shadow-sm"
                        >
                          {/* Mobile header (compact) */}
                          <button
                            type="button"
                            className="sm:hidden w-full flex items-center justify-between"
                            onClick={() => handleToggleSubExpansion(s.id)}
                            aria-expanded={expandedSubId === s.id}
                            aria-controls={`sub-${s.id}-details`}
                          >
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-slate-900">{s.className}</h4>
                            </div>
                            {expandedSubId === s.id ? (
                              <ChevronUp className="h-4 w-4 text-slate-500" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-500" />
                            )}
                          </button>

                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              {/* Desktop always visible; Mobile only when expanded */}
                              <div className={`mt-1 ${expandedSubId === s.id ? 'block' : 'hidden'} sm:block`} id={`sub-${s.id}-details`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-slate-900 hidden sm:block">{s.className}</h4>
                                </div>
                                {s.originalTeacherName && (
                                  <div className="text-sm text-slate-600 mb-1">
                                    <strong>Insegnante:</strong> {s.originalTeacherName}
                                  </div>
                                )}
                                <div className="text-sm text-slate-600 mb-2">
                                  <strong>Supplente:</strong> {s.teacherName}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {done ? 'Completata' : 'Prevista'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className={`flex items-center gap-2 ml-4 ${expandedSubId === s.id ? 'flex' : 'hidden'} sm:flex`}>
                              {(s.status === 'pending' || s.status === 'assigned') && (
                                <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title="Modifica supplenza"
                                  onClick={() => {
                                    setEditingSubstitution(s);
                                    // Prefill form with current substitution data
                                    const dateObj = new Date(s.date);
                                    const formattedDate = dateObj.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format

                                    // Determine currently assigned substitute teacher id (supports id or uid)
                                    const matchedByName = teachers.find(t =>
                                      ((t as any).displayName || (t as any).name) === (s as any).teacherName
                                    );
                                    const rawId =
                                      (s as any).substituteTeacherId ||
                                      (s as any).teacherId ||
                                      (matchedByName ? ((matchedByName as any).id || (matchedByName as any).uid) : '');
                                    const currentTeacherId = rawId ? String(rawId) : '';

                                    setEditSubForm({
                                      date: formattedDate,
                                      startTime: s.startTime || '',
                                      endTime: s.endTime || '',
                                      reason: s.reason || '',
                                      substituteTeacherId: currentTeacherId
                                    });
                                    setIsEditSubDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setRevokeTarget(s);
                                    setIsRevokeDialogOpen(true);
                                  }}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Revoca supplenza"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                                </>
                              )}
                              {/* Hard delete record */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDeleteTarget(s);
                                  setIsDeleteDialogOpen(true);
                                }}
                                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                title="Elimina definitivamente"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              {s.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await updateDoc(doc(db, 'substitutions', s.id), { 
                                        status: 'approved',
                                        approvedAt: new Date().toISOString(),
                                        approvedBy: userProfile?.id
                                      });
                                      setHistorySubs(prev => prev.map(sub => 
                                        sub.id === s.id ? { ...sub, status: 'approved' } : sub
                                      ));
                                    } catch (e) {
                                      console.error('Error approving substitution:', e);
                                      alert('Errore durante l\'approvazione della supplenza');
                                    }
                                  }}
                                  className="text-green-600 hover:text-green-800 hover:bg-green-50"
                                  title="Approva supplenza"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
                      <div className="text-sm text-slate-600">
                        Mostrando {startIndex + 1}-{Math.min(endIndex, visibleHistory.length)} di {visibleHistory.length} supplenze
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentSubPage(prev => Math.max(1, prev - 1))}
                          disabled={currentSubPage === 1}
                          className="text-slate-600 hover:text-slate-800"
                        >
                          <ChevronDown className="h-4 w-4 rotate-90" />
                        </Button>
                        <span className="text-sm text-slate-600">
                          Pagina {currentSubPage} di {totalPages}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentSubPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentSubPage === totalPages}
                          className="text-slate-600 hover:text-slate-800"
                        >
                          <ChevronDown className="h-4 w-4 -rotate-90" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()
          )}
        </div>
      </div>

      {/* Edit Substitution Dialog */}
      <AnimatePresence>
        {isEditSubDialogOpen && editingSubstitution && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setIsEditSubDialogOpen(false);
              setEditingSubstitution(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Modifica Supplenza</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {editingSubstitution.className} • {format(new Date(editingSubstitution.date), 'dd MMM yyyy', { locale: it })}
                </p>
              </div>
              
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input
                    type="date"
                    value={editSubForm.date}
                    onChange={(e) => setEditSubForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ora inizio</label>
                    <input
                      type="time"
                      value={editSubForm.startTime}
                      onChange={(e) => setEditSubForm(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ora fine</label>
                    <input
                      type="time"
                      value={editSubForm.endTime}
                      onChange={(e) => setEditSubForm(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sostituto</label>
                  <select
                    value={editSubForm.substituteTeacherId}
                    onChange={(e) => setEditSubForm(prev => ({ ...prev, substituteTeacherId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seleziona sostituto...</option>
                    {teachers.map((teacher) => (
                      <option key={(teacher as any).id || (teacher as any).uid} value={(teacher as any).id || (teacher as any).uid}>
                        {(teacher as any).displayName || (teacher as any).name || (teacher as any).email || (teacher as any).id || (teacher as any).uid}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                  <textarea
                    value={editSubForm.reason}
                    onChange={(e) => setEditSubForm(prev => ({ ...prev, reason: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Motivo della supplenza..."
                  />
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsEditSubDialogOpen(false);
                    setEditingSubstitution(null);
                  }}
                  disabled={isUpdatingSubstitution}
                >
                  Annulla
                </Button>
                <Button
                  onClick={async () => {
                    if (!editSubForm.date || !editSubForm.startTime || !editSubForm.endTime) {
                      alert('Compila tutti i campi obbligatori');
                      return;
                    }
                    
                    setIsUpdatingSubstitution(true);
                    try {
                      const updateData: any = {
                        date: editSubForm.date,
                        startTime: editSubForm.startTime,
                        endTime: editSubForm.endTime,
                        reason: editSubForm.reason,
                        updatedAt: new Date().toISOString(),
                        updatedBy: userProfile?.id
                      };

                      if (editSubForm.substituteTeacherId) {
                        const selectedTeacher = teachers.find(t =>
                          (t as any).id === editSubForm.substituteTeacherId ||
                          (t as any).uid === editSubForm.substituteTeacherId
                        );
                        updateData.substituteTeacherId = editSubForm.substituteTeacherId;
                        // Also persist alternative keys for compatibility with existing data
                        if ((selectedTeacher as any)?.id) updateData.teacherId = (selectedTeacher as any).id;
                        if ((selectedTeacher as any)?.uid) updateData.teacherUid = (selectedTeacher as any).uid;
                        updateData.teacherName = (selectedTeacher as any)?.displayName || (selectedTeacher as any)?.name || '';
                      }

                      await updateDoc(doc(db, 'substitutions', editingSubstitution.id), updateData);
                      
                      // Update local state
                      setHistorySubs(prev => prev.map(sub =>
                        sub.id === editingSubstitution.id
                          ? { ...sub, ...updateData }
                          : sub
                      ));
                      
                      setIsEditSubDialogOpen(false);
                      setEditingSubstitution(null);
                    } catch (error) {
                      console.error('Error updating substitution:', error);
                      alert('Errore durante l\'aggiornamento della supplenza');
                    } finally {
                      setIsUpdatingSubstitution(false);
                    }
                  }}
                  disabled={isUpdatingSubstitution}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isUpdatingSubstitution ? 'Salvando...' : 'Salva modifiche'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Approvals (collapsible) */}
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <button
            type="button"
            onClick={() => setIsPendingOpen(v => !v)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Richieste in Attesa di Approvazione</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">
                {filteredPending.length}
              </span>
            </div>
            <ChevronDown className={`h-4 w-4 text-slate-600 transition-transform ${isPendingOpen ? 'transform rotate-180' : ''}`} />
          </button>
        </div>
        {isPendingOpen && (
          <div className="p-0">
            {filteredPending.length > 0 ? (
              <div className="space-y-4 p-6">
              {filteredPending.map(teacher => (
                <motion.div 
                  key={teacher.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="group rounded-xl border border-amber-100 p-4 sm:p-6 hover:border-amber-200 hover:bg-amber-50/50 transition-all bg-white shadow-sm"
                >
                  {/* Mobile compact header */}
                  <button
                    type="button"
                    className="sm:hidden w-full flex items-center justify-between"
                    onClick={() => handleTogglePendingExpansion(teacher.id)}
                    aria-expanded={expandedPendingId === teacher.id}
                    aria-controls={`pending-${teacher.id}-details`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                        <span className="text-amber-700 font-semibold text-sm">
                          {teacher.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 group-hover:text-amber-900">{teacher.displayName}</h4>
                      </div>
                    </div>
                    {expandedPendingId === teacher.id ? (
                      <ChevronUp className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    )}
                  </button>

                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 sm:flex hidden items-center justify-center">
                        <span className="text-amber-700 font-semibold text-sm">
                          {teacher.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className={`mb-2 ${expandedPendingId === teacher.id ? 'block' : 'hidden'} sm:block`} id={`pending-${teacher.id}-details`}>
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-slate-900 group-hover:text-amber-900 sm:block hidden">{teacher.displayName}</h4>
                          </div>
                          <div className="text-sm text-slate-600">
                            <div className="items-center sm:flex hidden">
                              <Mail className="h-4 w-4 mr-2 text-slate-400" />
                              {teacher.email}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className={`items-center gap-2 ${expandedPendingId === teacher.id ? 'flex' : 'hidden'} sm:flex`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setViewingTeacher(teacher);
                          setIsViewDetailsOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openRejectDialog(teacher)}
                        disabled={processingTeacher === teacher.id}
                        isLoading={processingTeacher === teacher.id}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleApproveTeacher(teacher.id)}
                        disabled={processingTeacher === teacher.id}
                        isLoading={processingTeacher === teacher.id}
                        className="text-green-600 hover:text-green-800 hover:bg-green-50"
                        title="Approva"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            ) : (
              <div className="text-center py-12">
                <Clock className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Nessuna richiesta in attesa</h3>
                <p className="text-slate-500">Tutte le richieste di registrazione sono state elaborate.</p>
              </div>
            )}
          </div>
        )}
      </div>

      

      
      

      {/* Substitution Request Dialog */}
      <AnimatePresence>
        {isSubDialogOpen && subTeacher && (
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
              className="bg-white rounded-lg shadow-xl w-full max-w-lg border border-slate-200"
            >
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Richiedi supplente per {subTeacher.displayName}</h3>
                <p className="text-sm text-slate-600 mt-1">Crea una richiesta di supplenza</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Classe</label>
                  <input
                    type="text"
                    className="block w-full rounded-md border-slate-300 bg-slate-50 text-slate-700 shadow-sm sm:text-sm border p-2"
                    value={classes.find(c => c.id === subForm.classId)?.name || 'Nessuna classe assegnata'}
                    disabled
                    readOnly
                  />
                  {!subForm.classId && (
                    <p className="mt-1 text-xs text-red-600">L'insegnante non ha una classe assegnata. Assegna una classe prima di creare una supplenza.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Sostituto</label>
                  <select
                    className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2"
                    value={subForm.substituteTeacherId}
                    onChange={(e) => setSubForm(prev => ({ ...prev, substituteTeacherId: e.target.value }))}
                  >
                    <option value="">Seleziona Supplente</option>
                    {teachers
                      .filter(t => t.availableForSubstitution && t.id !== subTeacher.id)
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.displayName}</option>
                      ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Data</label>
                    <input type="date" className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2"
                      value={subForm.date}
                      onChange={(e) => setSubForm(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Inizio</label>
                    <input type="time" className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2"
                      value={subForm.startTime}
                      onChange={(e) => setSubForm(prev => ({ ...prev, startTime: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Fine</label>
                    <input type="time" className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2"
                      value={subForm.endTime}
                      onChange={(e) => setSubForm(prev => ({ ...prev, endTime: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Motivo</label>
                  <textarea className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2"
                    rows={3}
                    value={subForm.reason}
                    onChange={(e) => setSubForm(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => { setIsSubDialogOpen(false); setSubTeacher(null); }} className="text-slate-600 hover:text-slate-800 hover:bg-slate-50">Annulla</Button>
                <Button
                  onClick={async () => {
                    if (!userProfile || !subTeacher) return;
                    if (!subForm.classId) {
                      setMessage({ type: 'error', text: "L'insegnante non ha una classe assegnata" });
                      setTimeout(() => setMessage(null), 2000);
                      return;
                    }
                    if (!subForm.date || !subForm.substituteTeacherId) {
                      setMessage({ type: 'error', text: 'Compila data e sostituto' });
                      setTimeout(() => setMessage(null), 2000);
                      return;
                    }
                    try {
                      setIsCreatingSub(true);
                      const cls = classes.find(c => c.id === subForm.classId);
                      const substitute = teachers.find(t => t.id === subForm.substituteTeacherId);
                      const docRef = await addDoc(collection(db, 'substitutions'), {
                        teacherId: subForm.substituteTeacherId,
                        teacherName: substitute?.displayName || 'Insegnante',
                        originalTeacherId: subTeacher.id,
                        originalTeacherName: subTeacher.displayName,
                        classId: subForm.classId,
                        className: cls?.name || 'Classe',
                        date: new Date(subForm.date),
                        startTime: subForm.startTime,
                        endTime: subForm.endTime,
                        reason: subForm.reason,
                        status: 'assigned',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                      });

                      // Record substitution history (admin-assigned)
                      try {
                        await addDoc(collection(db, 'substitutionHistory'), {
                          substitutionId: docRef.id,
                          action: 'assigned',
                          teacherId: subForm.substituteTeacherId,
                          teacherName: substitute?.displayName || 'Insegnante',
                          originalTeacherId: subTeacher.id,
                          originalTeacherName: subTeacher.displayName,
                          classId: subForm.classId,
                          className: cls?.name || 'Classe',
                          date: new Date(subForm.date),
                          status: 'assigned',
                          createdAt: new Date(),
                          createdBy: userProfile.id,
                        });
                      } catch (histErr) {
                        console.warn('Failed to write substitution history (admin):', histErr);
                      }

                      // No pending moderation: directly approved (no local pending list to update)

                          // Notify only the selected substitute teacher
                          try {
                            await addDoc(collection(db, 'notifications'), {
                              recipientId: subForm.substituteTeacherId,
                              type: 'substitution_assigned',
                              title: 'Sei stato assegnato a una supplenza',
                              message: `${cls?.name || 'Classe'} • ${format(new Date(subForm.date), 'dd MMM yyyy', { locale: it })} ${subForm.startTime}-${subForm.endTime}`,
                              substitutionId: docRef.id,
                              classId: subForm.classId,
                              createdAt: new Date(),
                              read: false,
                            });
                            // also set a lightweight user-level unread flag so header can light up instantly
                            try {
                              await updateDoc(doc(db, 'users', subForm.substituteTeacherId), { hasUnread: true });
                            } catch (flagErr) {
                              console.warn('Impossibile aggiornare flag hasUnread utente:', flagErr);
                            }
                          } catch (notifyErr) {
                            console.warn('Notify assigned failed:', notifyErr);
                          }

                          setIsSubDialogOpen(false);
                      setSubTeacher(null);
                      setMessage({ type: 'success', text: 'Supplenza assegnata' });
                      setTimeout(() => setMessage(null), 2000);
                    } catch (e) {
                      console.error(e);
                      setMessage({ type: 'error', text: 'Errore assegnando la supplenza' });
                    } finally {
                      setIsCreatingSub(false);
                    }
                  }}
                  disabled={isCreatingSub}
                >
                  {isCreatingSub ? 'Assegnazione…' : 'Assegna supplenza'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      

      {/* Payment Dialog */}
      <AnimatePresence>
        {isPaymentDialogOpen && paymentTeacher && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white/95 backdrop-blur-md rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl border border-white/20"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-light text-gray-900 flex items-center">
                  <Euro className="h-5 w-5 mr-2 text-green-600" />
                  Registra Pagamento
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsPaymentDialogOpen(false);
                    setPaymentTeacher(null);
                    setPaymentForm({
                      amount: '',
                      paymentType: 'salary',
                      description: '',
                      notes: '',
                      month: format(new Date(), 'yyyy-MM')
                    });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-sm text-gray-600 mb-2 flex items-center">
                    <UserIcon className="h-4 w-4 mr-2 text-gray-400" />
                    <strong>Insegnante:</strong> <span className="ml-2">{paymentTeacher.displayName}</span>
                  </p>
                  <p className="text-sm text-gray-600 mb-2 flex items-center">
                    <Settings className="h-4 w-4 mr-2 text-gray-400" />
                    <strong>Ruolo:</strong> <span className="ml-2">{getTeacherTypeLabel(paymentTeacher.teacherType)}</span>
                  </p>
                  <p className="text-sm text-gray-600 flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-gray-400" />
                    <strong>Email:</strong> <span className="ml-2">{paymentTeacher.email}</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Importo"
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                    leftIcon={<Euro className="h-5 w-5 text-gray-400" />}
                    placeholder="0.00"
                    fullWidth
                    className="anime-input"
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo Pagamento
                    </label>
                    <select
                      className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-3 px-4 transition-colors"
                      value={paymentForm.paymentType}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentType: e.target.value as any }))}
                    >
                      <option value="salary">Stipendio</option>
                      <option value="reimbursement">Rimborso</option>
                    </select>
                  </div>
                </div>

                <Input
                  label="Mese di Riferimento"
                  type="month"
                  value={paymentForm.month}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, month: e.target.value }))}
                  fullWidth
                  className="anime-input"
                  required
                />

                <Input
                  label="Descrizione"
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Es: Stipendio mensile, Bonus performance..."
                  fullWidth
                  className="anime-input"
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note (Opzionale)
                  </label>
                  <textarea
                    className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3 min-h-[80px] transition-colors"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Note aggiuntive..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsPaymentDialogOpen(false);
                      setPaymentTeacher(null);
                      setPaymentForm({
                        amount: '',
                        paymentType: 'salary',
                        description: '',
                        notes: '',
                        month: format(new Date(), 'yyyy-MM')
                      });
                    }}
                    disabled={isSubmittingPayment}
                    className="border-gray-300 text-gray-700"
                  >
                    Chiudi
                  </Button>
                  <Button
                    onClick={handleAddPayment}
                    isLoading={isSubmittingPayment}
                    disabled={isSubmittingPayment || !paymentForm.amount || !paymentForm.description}
                    leftIcon={<Save className="h-4 w-4" />}
                    className="anime-button"
                  >
                    Registra Pagamento
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment History Dialog */}
      <AnimatePresence>
        {isPaymentHistoryOpen && paymentHistoryTeacher && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white/95 backdrop-blur-md rounded-2xl p-6 max-w-4xl w-full mx-4 shadow-xl border border-white/20 max-h-[80vh] overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-light text-gray-900 flex items-center">
                  <History className="h-5 w-5 mr-2 text-purple-600" />
                  Storico Pagamenti - {paymentHistoryTeacher.displayName}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsPaymentHistoryOpen(false);
                    setPaymentHistoryTeacher(null);
                    setTeacherPayments([]);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="overflow-y-auto max-h-[60vh]">
                {isLoadingPayments ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Caricamento storico pagamenti...</p>
                  </div>
                ) : teacherPayments.length > 0 ? (
                  <div className="space-y-4">
                    {teacherPayments.map(payment => (
                      <div key={payment.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <Euro className="h-5 w-5 text-green-600 mr-2" />
                              <span className="text-lg font-semibold text-gray-900">
                                €{payment.amount.toFixed(2)}
                              </span>
                              <span className={`ml-3 px-2 py-1 rounded-full text-xs font-medium ${
                                payment.paymentType === 'salary' ? 'bg-blue-100 text-blue-800' :
                                payment.paymentType === 'bonus' ? 'bg-green-100 text-green-800' :
                                payment.paymentType === 'reimbursement' ? 'bg-amber-100 text-amber-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {getPaymentTypeLabel(payment.paymentType)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mb-1">{payment.description}</p>
                            <div className="flex items-center text-xs text-gray-500">
                              <Calendar className="h-3 w-3 mr-1" />
                              {format(payment.date, 'd MMMM yyyy', { locale: it })} - Mese: {payment.month}
                            </div>
                            {payment.notes && (
                              <p className="text-xs text-gray-600 mt-2 italic">{payment.notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-900">Totale Pagamenti:</span>
                        <span className="text-lg font-bold text-blue-900">
                          €{teacherPayments.reduce((sum, payment) => sum + payment.amount, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Euro className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun pagamento registrato</h3>
                    <p className="text-gray-500">
                      Non ci sono ancora pagamenti registrati per questo insegnante.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </div>
    </div>
  );
};