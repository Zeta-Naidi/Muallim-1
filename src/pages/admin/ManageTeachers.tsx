import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, updateDoc, doc, deleteDoc, orderBy, addDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  Users, 
  UserPlus, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Check,
  Clock,
  Mail,
  Phone,
  MapPin,
  Calendar,
  User as UserIcon,
  Shield,
  Eye,
  Search,
  Edit,
  Save,
  Euro,
  History,
  Settings,
  ChevronDown
} from 'lucide-react';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StudentDetailsDialog } from '../../components/dialogs/StudentDetailsDialog';
import { User, Class, TeacherPayment, TeacherType, Substitution } from '../../types';
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
  // Filters (essential only)
  const [filterTeacherType, setFilterTeacherType] = useState<'' | TeacherType>('');
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);
  const [isTeacherDetailsOpen, setIsTeacherDetailsOpen] = useState(false);
  const [processingTeacher, setProcessingTeacher] = useState<string | null>(null);
  
  // Edit teacher state
  const [editingTeacher, setEditingTeacher] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TeacherEditForm>({
    teacherType: 'insegnante_regolare',
    assignedClassId: '',
    assistantId: '',
    availableForSubstitution: false,
  });
  
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPendingOpen, setIsPendingOpen] = useState(false);

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

        // Fetch classes
        const classesQuery = query(collection(db, 'classes'));
        const classesDocs = await getDocs(classesQuery);
        const fetchedClasses = classesDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));
        setClasses(fetchedClasses);

        // Fetch past substitutions (history): date strictly before today, latest first
        const today = new Date();
        today.setHours(0,0,0,0);
        const historyQueryRef = query(
          collection(db, 'substitutions'),
          where('date', '<', today),
          orderBy('date', 'desc')
        );
        const historyDocs = await getDocs(historyQueryRef);
        const history = historyDocs.docs.map(doc => {
          const data: any = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data?.date?.toDate ? data.date.toDate() : (data?.date ? new Date(data.date) : new Date()),
          } as Substitution;
        });
        setHistorySubs(history);

        setIsLoadingSubs(false);
      } catch (error) {
        console.error('Error fetching teachers:', error);
        setMessage({ type: 'error', text: 'Errore nel caricamento dei dati' });
        setIsLoadingSubs(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
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

  const handleCancelEdit = () => {
    setEditingTeacher(null);
    setEditForm({
      teacherType: 'insegnante_regolare',
      assignedClassId: '',
      assistantId: ''
    });
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

  const handleViewTeacherDetails = (teacher: User) => {
    setSelectedTeacher(teacher);
    setIsTeacherDetailsOpen(true);
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
      <PageContainer title="Accesso non autorizzato">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-8 text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-2xl font-light text-gray-900 mb-2">Accesso non autorizzato</h3>
          <p className="text-gray-600">Non hai i permessi per accedere a questa pagina.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Gestione Insegnanti"
      description="Approva le richieste di registrazione degli insegnanti e gestisci gli account"
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
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-lg border border-slate-200"
            >
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Modifica Insegnante</h3>
                <p className="text-sm text-slate-600 mt-1">Aggiorna ruolo, classe e disponibilità</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                  <select
                    className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2"
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
                  <label className="block text-xs font-medium text-slate-600 mb-1">Classe Assegnata</label>
                  <select
                    className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2"
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
                  <label className="block text-xs font-medium text-slate-600 mb-1">Assistente</label>
                  <select
                    className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2"
                    value={editForm.assistantId}
                    onChange={(e) => setEditForm(prev => ({ ...prev, assistantId: e.target.value }))}
                  >
                    <option value="">Nessun assistente</option>
                    {allTeachers.filter(t => t.teacherType === 'assistente' && t.id !== editingTeacher).map(t => (
                      <option key={t.id} value={t.id}>{t.displayName}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="availableSub"
                    type="checkbox"
                    className="h-4 w-4 text-emerald-600 border-slate-300 rounded"
                    checked={!!editForm.availableForSubstitution}
                    onChange={(e) => setEditForm(prev => ({ ...prev, availableForSubstitution: e.target.checked }))}
                  />
                  <label htmlFor="availableSub" className="text-sm text-slate-700">Disponibile per supplenze</label>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => { setIsEditDialogOpen(false); }} className="text-slate-600 hover:text-slate-800 hover:bg-slate-50">Annulla</Button>
                <Button onClick={() => editingTeacher && handleSaveTeacherEdit(editingTeacher)}>
                  <Save className="h-4 w-4 mr-1" /> Salva
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
              className="bg-white rounded-lg shadow-xl w-full max-w-md border border-slate-200"
            >
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Conferma rifiuto</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Rifiutare la richiesta di <span className="font-medium">{rejectTarget.displayName}</span>?<br />
                  L'operazione eliminerà l'account e i dati profilo.
                </p>
              </div>
              <div className="px-6 py-4 flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setRejectTarget(null)}
                  className="text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                  disabled={processingTeacher === rejectTarget.id}
                >
                  Annulla
                </Button>
                <Button
                  onClick={() => handleRejectTeacher(rejectTarget.id)}
                  isLoading={processingTeacher === rejectTarget.id}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Rifiuta definitivamente
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notifications bell is now global in Header */}


{/* Instructions for Teachers */}
      <Card variant="elevated" className="mb-8 bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mr-4 flex-shrink-0">
              <UserPlus className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Come diventare insegnante</h3>
              <div className="text-sm text-slate-700 space-y-2">
                <p>1. Gli insegnanti devono registrarsi autonomamente sulla pagina di registrazione</p>
                <p>2. Selezionare "Insegnante" durante la registrazione</p>
                <p>3. Compilare tutti i dati richiesti</p>
                <p>4. L'amministratore riceverà la richiesta e potrà approvarla</p>
                <p>5. Solo dopo l'approvazione l'insegnante potrà accedere al sistema</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Approved Teachers */}
      <Card variant="elevated" className="mb-8 bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-200">
          <CardTitle className="flex items-center text-slate-900">
            <Users className="h-5 w-5 mr-2 text-slate-600" />
            Insegnanti Approvati ({filteredTeachers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Filters moved here */}
          <div className="px-6 py-4 border-b border-slate-200 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Cerca"
                placeholder="Nome o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="h-5 w-5" />}
                fullWidth
              />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo Insegnante</label>
                <select
                  className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2"
                  value={filterTeacherType}
                  onChange={(e) => setFilterTeacherType(e.target.value as any)}
                >
                  <option value="">Tutti</option>
                  <option value="insegnante_regolare">Insegnante Regolare</option>
                  <option value="insegnante_volontario">Insegnante Volontario</option>
                  <option value="assistente">Assistente</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Classe Assegnata</label>
                <select
                  className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2"
                  value={filterClassId}
                  onChange={(e) => setFilterClassId(e.target.value)}
                >
                  <option value="">Tutte</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.turno ? ` – ${c.turno}` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mx-auto"></div>
              <p className="mt-2 text-slate-600">Caricamento insegnanti...</p>
            </div>
          ) : filteredTeachers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Insegnante
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ruolo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Classe Assegnata
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assistente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contatti
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTeachers.map(teacher => {
                    const assignedClass = teacher.assignedClassId
                      ? classes.find(c => c.id === teacher.assignedClassId)
                      : classes.find(c => c.teacherId === teacher.id);
                    const assistant = allTeachers.find(t => t.id === teacher.assistantId);
                    const isEditing = editingTeacher === teacher.id;
                    
                    return (
                      <motion.tr 
                        key={teacher.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="hover:bg-slate-50 transition-colors odd:bg-white even:bg-slate-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                              <span className="text-slate-700 font-medium text-sm">
                                {teacher.displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-slate-900">
                                {teacher.displayName}
                              </div>
                              <div className="text-sm text-slate-600">
                                Registrato il {formatDate(teacher.createdAt)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTeacherTypeColor(teacher.teacherType)}`}>
                            {getTeacherTypeLabel(teacher.teacherType)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {assignedClass ? `${assignedClass.name}${assignedClass.turno ? ' – ' + assignedClass.turno : ''}` : 'Non assegnato'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {assistant && assistant.teacherType === 'assistente' ? assistant.displayName : 'Nessuno'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 flex items-center">
                            <Mail className="h-4 w-4 mr-2 text-gray-400" />
                            {teacher.email}
                          </div>
                          {teacher.phoneNumber && (
                            <div className="text-sm text-gray-500 flex items-center mt-1">
                              <Phone className="h-4 w-4 mr-2 text-gray-400" />
                              {teacher.phoneNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewTeacherDetails(teacher)}
                                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditTeacher(teacher)}
                                  className="text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setPaymentTeacher(teacher);
                                    setIsPaymentDialogOpen(true);
                                  }}
                                  className="text-green-600 hover:text-green-800 hover:bg-green-50"
                                >
                                  <Euro className="h-4 w-4" />
                                </Button>
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewPaymentHistory(teacher)}
                                  className="text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                                >
                                  <History className="h-4 w-4" />
                                </Button>

                                {/* Open substitution request dialog */}
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSubTeacher(teacher);
                                    const assigned = classes.find(c => c.teacherId === teacher.id)?.id || '';
                                    setSubForm({ classId: assigned, date: '', startTime: '17:00', endTime: '19:00', reason: '', substituteTeacherId: '' });
                                    setIsSubDialogOpen(true);
                                  }}
                                >
                                  Richiedi supplente
                                </Button>
                              </>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
        </CardContent>
      </Card>

      {/* Substitutions History (Expandable) */}
      <Card variant="elevated" className="mb-8 bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
        <CardContent className="p-0">
          <div>
            <button
              type="button"
              onClick={() => setIsHistoryOpen(v => !v)}
              className="w-full flex items-center justify-between px-6 py-3 hover:bg-slate-50"
            >
              <div className="flex items-center gap-2 text-slate-900 font-medium text-xl">
              <Clock className="h-5 w-5 mr-2 text-slate-600" />
                Storico supplenze
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">{historySubs.length}</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-slate-600 transition-transform ${isHistoryOpen ? 'transform rotate-180' : ''}`} />
            </button>
            {isHistoryOpen && (
              <div className="px-6 pb-4">
                {isLoadingSubs ? (
                  <div className="text-sm text-slate-600 py-3">Caricamento…</div>
                ) : historySubs.length === 0 ? (
                  <div className="text-sm text-slate-500 py-3">Nessuna supplenza passata</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {historySubs.map((s) => (
                      <div key={s.id} className="py-3 flex items-center justify-between">
                        <div className="text-sm">
                          <div className="font-medium text-slate-900">{s.className} • {format(new Date(s.date), 'dd MMM yyyy', { locale: it })}</div>
                          <div className="text-slate-600">{s.startTime}–{s.endTime} • Sostituto: {s.teacherName}</div>
                          {s.reason && <div className="text-slate-500">Motivo: {s.reason}</div>}
                        </div>
                        <div className="text-xs text-slate-600">{s.status}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>


      {/* Pending Approvals (collapsible) */}
      <Card variant="elevated" className="mb-8 bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-200">
          <button
            type="button"
            onClick={() => setIsPendingOpen(v => !v)}
            className="w-full flex items-center justify-between px-0 py-0"
          >
            <CardTitle className="flex items-center text-slate-900 text-xl font-medium">
              <Clock className="h-5 w-5 mr-2 text-slate-600" />
              Richieste in Attesa di Approvazione
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                {filteredPending.length}
              </span>
            </CardTitle>
            <ChevronDown className={`h-4 w-4 text-slate-600 transition-transform ${isPendingOpen ? 'transform rotate-180' : ''}`} />
          </button>
        </CardHeader>
        {isPendingOpen && (
          <CardContent className="p-0">
            {filteredPending.length > 0 ? (
              <div className="divide-y divide-gray-200">
              {filteredPending.map(teacher => (
                <motion.div 
                  key={teacher.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-6 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center mr-4">
                        <span className="text-slate-700 font-medium text-lg">
                          {teacher.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-slate-900">{teacher.displayName}</h3>
                        <div className="mt-1 space-y-1">
                          <div className="flex items-center text-sm text-slate-600">
                            <Mail className="h-4 w-4 mr-2 text-slate-400" />
                            {teacher.email}
                          </div>
                          {teacher.phoneNumber && (
                            <div className="flex items-center text-sm text-slate-600">
                              <Phone className="h-4 w-4 mr-2 text-slate-400" />
                              {teacher.phoneNumber}
                            </div>
                          )}
                          {teacher.address && (
                            <div className="flex items-center text-sm text-slate-600">
                              <MapPin className="h-4 w-4 mr-2 text-slate-400" />
                              {teacher.address}
                            </div>
                          )}
                          <div className="flex items-center text-sm text-slate-600">
                            <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                            Richiesta inviata il {formatDate(teacher.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewTeacherDetails(teacher)}
                        className="text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openRejectDialog(teacher)}
                        disabled={processingTeacher === teacher.id}
                        isLoading={processingTeacher === teacher.id}
                        className="text-red-600 hover:bg-red-50 border-red-200"
                        leftIcon={<X className="h-4 w-4" />}
                      >
                        Rifiuta
                      </Button>
                      
                      <Button
                        size="sm"
                        onClick={() => handleApproveTeacher(teacher.id)}
                        disabled={processingTeacher === teacher.id}
                        isLoading={processingTeacher === teacher.id}
                        leftIcon={<Check className="h-4 w-4" />}
                        className="anime-button"
                      >
                        Approva
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
              </div>
            )}
          </CardContent>
        )}
      </Card>

      

      
      

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
                  <select
                    className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2"
                    value={subForm.classId}
                    onChange={(e) => setSubForm(prev => ({ ...prev, classId: e.target.value }))}
                  >
                    <option value="">Seleziona classe</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.turno ? ` – ${c.turno}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Sostituto</label>
                  <select
                    className="block w-full rounded-md border-slate-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm bg-white border p-2"
                    value={subForm.substituteTeacherId}
                    onChange={(e) => setSubForm(prev => ({ ...prev, substituteTeacherId: e.target.value }))}
                  >
                    <option value="">Seleziona insegnante sostituto</option>
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
                    if (!userProfile || !subTeacher || !subForm.classId || !subForm.date || !subForm.substituteTeacherId) {
                      setMessage({ type: 'error', text: 'Compila classe, data e sostituto' });
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

                      // No pending moderation: directly approved
                      setPendingSubs(prev => prev);

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

      {/* Teacher Details Dialog */}
      <StudentDetailsDialog
        student={selectedTeacher}
        isOpen={isTeacherDetailsOpen}
        onClose={() => {
          setIsTeacherDetailsOpen(false);
          setSelectedTeacher(null);
        }}
      />
    </PageContainer>
  );
};