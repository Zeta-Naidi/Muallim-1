import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, addDoc, updateDoc, doc, orderBy, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Euro, Search, AlertCircle, CheckCircle, Calendar, CreditCard, FileText, Plus, Users, Phone, Edit, Save, X, Shield, Trash2, Wallet, Receipt, CreditCard as CreditCardIcon, UserPlus, Filter, ArrowUpDown, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { User, Class } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

interface ParentGroup {
  parentContact: string;
  parentName: string;
  children: User[];
  totalAmount: number;
  paidAmount: number;
  isExempted: boolean;
}

interface PaymentRecord {
  id: string;
  parentContact: string;
  parentName: string;
  amount: number;
  date: Date;
  notes: string;
  createdBy: string;
  createdAt: Date;
}

export const Payments: React.FC = () => {
  const { userProfile } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [parentGroups, setParentGroups] = useState<ParentGroup[]>([]);
  const [filteredParentGroups, setFilteredParentGroups] = useState<ParentGroup[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [classes, setClasses] = useState<Record<string, Class>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParent, setSelectedParent] = useState<ParentGroup | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingExemption, setEditingExemption] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [showPaymentHistory, setShowPaymentHistory] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid' | 'exempted'>('all');
  // compact row expansion state
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<'parentName' | 'totalAmount' | 'paidAmount'>('parentName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Pricing structure based on number of children
  const getPricing = (childrenCount: number): number => {
    switch (childrenCount) {
      case 1: return 120;
      case 2: return 220;
      case 3: return 300;
      case 4: return 360;
      default: return 360; // 4+ children same price as 4
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile || userProfile.role !== 'admin') return;
      
      try {
        // Fetch all classes
        const classesQuery = query(collection(db, 'classes'));
        const classesDocs = await getDocs(classesQuery);
        const classesMap: Record<string, Class> = {};
        classesDocs.docs.forEach(doc => {
          const classData = { ...doc.data(), id: doc.id } as Class;
          classesMap[doc.id] = classData;
        });
        setClasses(classesMap);

        // Fetch ONLY enrolled students from students collection
        const studentsQuery = query(
          collection(db, 'students'),
          where('isEnrolled', '==', true)
        );
        const studentsDocs = await getDocs(studentsQuery);
        const fetchedStudents = studentsDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setStudents(fetchedStudents);

        // Fetch payment records
        const paymentsQuery = query(
          collection(db, 'paymentRecords'),
          orderBy('date', 'desc')
        );
        const paymentsDocs = await getDocs(paymentsQuery);
        const fetchedPayments = paymentsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
          } as PaymentRecord;
        });
        setPaymentRecords(fetchedPayments);

        // Group students by parent contact (phone number) - ONLY enrolled students
        const parentGroupsMap = new Map<string, ParentGroup>();
        
        fetchedStudents.forEach(student => {
          const parentContact = student.parentContact?.trim();
          const parentName = student.parentName?.trim() || 'Nome non specificato';
          
          if (!parentContact) return; // Skip students without parent contact
          
          if (!parentGroupsMap.has(parentContact)) {
            parentGroupsMap.set(parentContact, {
              parentContact,
              parentName,
              children: [],
              totalAmount: 0,
              paidAmount: 0,
              isExempted: false,
            });
          }
          
          const group = parentGroupsMap.get(parentContact)!;
          group.children.push(student);
          
          // Check if any child in the group is exempted
          if (student.paymentExempted) {
            group.isExempted = true;
          }
        });

        // Calculate total amounts and paid amounts for each parent group
        const parentGroupsArray = Array.from(parentGroupsMap.values()).map(group => {
          const childrenCount = group.children.length;
          const totalAmount = group.isExempted ? 0 : getPricing(childrenCount);
          
          // Calculate paid amount from payment records
          const paidAmount = fetchedPayments
            .filter(payment => payment.parentContact === group.parentContact)
            .reduce((sum, payment) => sum + payment.amount, 0);
          
          return {
            ...group,
            totalAmount,
            paidAmount,
          };
        });

        // Sort by parent name
        parentGroupsArray.sort((a, b) => a.parentName.localeCompare(b.parentName));
        
        // Apply initial sorting
        sortParentGroups(parentGroupsArray, 'parentName', 'asc');
        
        setParentGroups(parentGroupsArray);
        setFilteredParentGroups(parentGroupsArray);
      } catch (error) {
        console.error('Error fetching payment data:', error);
        setMessage({ type: 'error', text: 'Errore nel caricamento dei dati' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userProfile]);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    const filteredBySearch = q === ''
      ? parentGroups
      : parentGroups.filter(group =>
          group.parentName.toLowerCase().includes(q) ||
          group.parentContact.includes(q) ||
          group.children.some(child => child.displayName.toLowerCase().includes(q))
        );

    const filteredByStatus = filteredBySearch.filter(group => {
      const s = getPaymentStatus(group).status;
      if (statusFilter === 'all') return true;
      return s === statusFilter;
    });

    // Respect current sort selection
    const sorted = sortParentGroups(filteredByStatus, sortField, sortDirection);
    setFilteredParentGroups(sorted);
  }, [searchQuery, parentGroups, statusFilter, sortField, sortDirection]);

  // Function to sort parent groups
  const sortParentGroups = (groups: ParentGroup[], field: 'parentName' | 'totalAmount' | 'paidAmount', direction: 'asc' | 'desc') => {
    return [...groups].sort((a, b) => {
      let comparison = 0;
      
      if (field === 'parentName') {
        comparison = a.parentName.localeCompare(b.parentName);
      } else if (field === 'totalAmount') {
        comparison = a.totalAmount - b.totalAmount;
      } else if (field === 'paidAmount') {
        comparison = a.paidAmount - b.paidAmount;
      }
      
      return direction === 'asc' ? comparison : -comparison;
    });
  };

  const handleSort = (field: 'parentName' | 'totalAmount' | 'paidAmount') => {
    const newDirection = field === sortField && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
    
    const sorted = sortParentGroups([...filteredParentGroups], field, newDirection);
    setFilteredParentGroups(sorted);
  };

  const handleAddPayment = async () => {
    if (!selectedParent || !paymentAmount || !userProfile) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage({ type: 'error', text: 'Inserire un importo valido' });
      return;
    }

    // Validate that payment doesn't exceed remaining amount
    const remainingAmount = selectedParent.totalAmount - selectedParent.paidAmount;
    if (amount > remainingAmount && !selectedParent.isExempted) {
      setMessage({ 
        type: 'error', 
        text: `L'importo non può superare il rimanente da pagare (€${remainingAmount.toFixed(2)})` 
      });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const paymentData = {
        parentContact: selectedParent.parentContact,
        parentName: selectedParent.parentName,
        amount,
        date: new Date(),
        notes: paymentNotes.trim(),
        createdBy: userProfile.id,
        createdAt: new Date(),
      };

      const docRef = await addDoc(collection(db, 'paymentRecords'), paymentData);
      
      const newPayment: PaymentRecord = {
        ...paymentData,
        id: docRef.id,
      };

      setPaymentRecords(prev => [newPayment, ...prev]);
      
      // Update parent group paid amount
      setParentGroups(prev => prev.map(group => 
        group.parentContact === selectedParent.parentContact
          ? { ...group, paidAmount: group.paidAmount + amount }
          : group
      ));

      setMessage({ type: 'success', text: 'Pagamento registrato con successo' });
      
      // Reset form
      setPaymentAmount('');
      setPaymentNotes('');
      setIsPaymentDialogOpen(false);
      setSelectedParent(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error recording payment:', error);
      setMessage({ type: 'error', text: 'Errore nella registrazione del pagamento' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditPayment = async (paymentId: string, newAmount: number) => {
    const payment = paymentRecords.find(p => p.id === paymentId);
    if (!payment) return;

    const parentGroup = parentGroups.find(g => g.parentContact === payment.parentContact);
    if (!parentGroup) return;

    // Calculate what the new total paid amount would be
    const otherPayments = paymentRecords
      .filter(p => p.parentContact === payment.parentContact && p.id !== paymentId)
      .reduce((sum, p) => sum + p.amount, 0);
    
    const newTotalPaid = otherPayments + newAmount;

    // Validate that new total doesn't exceed total amount due (unless exempted)
    if (!parentGroup.isExempted && newTotalPaid > parentGroup.totalAmount) {
      setMessage({ 
        type: 'error', 
        text: `Il totale pagato non può superare l'importo dovuto (€${parentGroup.totalAmount.toFixed(2)})` 
      });
      return;
    }

    try {
      await updateDoc(doc(db, 'paymentRecords', paymentId), {
        amount: newAmount,
        updatedAt: new Date(),
      });

      // Update local state
      setPaymentRecords(prev => prev.map(p => 
        p.id === paymentId ? { ...p, amount: newAmount } : p
      ));

      setParentGroups(prev => prev.map(group => 
        group.parentContact === payment.parentContact
          ? { ...group, paidAmount: newTotalPaid }
          : group
      ));

      setMessage({ type: 'success', text: 'Pagamento aggiornato con successo' });
      setEditingPayment(null);
      setEditAmount('');
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error updating payment:', error);
      setMessage({ type: 'error', text: 'Errore nell\'aggiornamento del pagamento' });
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    const payment = paymentRecords.find(p => p.id === paymentId);
    if (!payment) return;

    if (!window.confirm(`Sei sicuro di voler eliminare questo pagamento di €${payment.amount.toFixed(2)}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'paymentRecords', paymentId));

      // Update local state
      setPaymentRecords(prev => prev.filter(p => p.id !== paymentId));

      setParentGroups(prev => prev.map(group => 
        group.parentContact === payment.parentContact
          ? { ...group, paidAmount: group.paidAmount - payment.amount }
          : group
      ));

      setMessage({ type: 'success', text: 'Pagamento eliminato con successo' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting payment:', error);
      setMessage({ type: 'error', text: 'Errore nell\'eliminazione del pagamento' });
    }
  };

  const handleToggleExemption = async (parentGroup: ParentGroup) => {
    setEditingExemption(parentGroup.parentContact);
    
    try {
      const newExemptionStatus = !parentGroup.isExempted;
      
      // Update all children in the group
      const updatePromises = parentGroup.children.map(child =>
        updateDoc(doc(db, 'users', child.id), {
          paymentExempted: newExemptionStatus,
          updatedAt: new Date(),
        })
      );

      await Promise.all(updatePromises);

      // Update local state
      setParentGroups(prev => prev.map(group => 
        group.parentContact === parentGroup.parentContact
          ? { 
              ...group, 
              isExempted: newExemptionStatus,
              totalAmount: newExemptionStatus ? 0 : getPricing(group.children.length)
            }
          : group
      ));

      setStudents(prev => prev.map(student => 
        parentGroup.children.some(child => child.id === student.id)
          ? { ...student, paymentExempted: newExemptionStatus }
          : student
      ));

      setMessage({ 
        type: 'success', 
        text: `Famiglia ${newExemptionStatus ? 'esentata' : 'non più esentata'} dal pagamento` 
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error updating exemption status:', error);
      setMessage({ type: 'error', text: 'Errore nell\'aggiornamento dello stato di esenzione' });
    } finally {
      setEditingExemption(null);
    }
  };

  const getPaymentStatus = (group: ParentGroup) => {
    if (group.isExempted) {
      return { status: 'exempted', color: 'bg-purple-100 text-purple-800', text: 'Esentato' };
    }
    
    if (group.paidAmount >= group.totalAmount) {
      return { status: 'paid', color: 'bg-green-100 text-green-800', text: 'Pagato' };
    }
    
    if (group.paidAmount > 0) {
      return { status: 'partial', color: 'bg-amber-100 text-amber-800', text: 'Parziale' };
    }
    
    return { status: 'unpaid', color: 'bg-red-100 text-red-800', text: 'Non Pagato' };
  };

  // Export CSV of current filtered families
  const handleExportCsv = () => {
    const headers = ['Genitore','Telefono','Figli','Totale','Pagato','Rimanente','Stato'];
    const rows = filteredParentGroups.map(g => {
      const remaining = g.isExempted ? 0 : Math.max(0, g.totalAmount - g.paidAmount);
      const status = getPaymentStatus(g).text;
      return [
        g.parentName,
        g.parentContact,
        String(g.children.length),
        g.isExempted ? '0' : `€${g.totalAmount.toFixed(0)}`,
        `€${g.paidAmount.toFixed(0)}`,
        `€${remaining.toFixed(0)}`,
        status,
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pagamenti_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getPaymentHistoryForParent = (parentContact: string) => {
    return paymentRecords.filter(payment => payment.parentContact === parentContact);
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
                <Wallet className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Gestione Pagamenti</h1>
                <p className="text-blue-100 mt-1">Gestisci i pagamenti delle famiglie con studenti iscritti</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Payment Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Famiglie</p>
                  <p className="text-3xl font-bold text-gray-900">{parentGroups.length}</p>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Pagato</p>
                  <p className="text-3xl font-bold text-gray-900">
                    €{parentGroups.reduce((sum, group) => sum + group.paidAmount, 0).toFixed(0)}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-green-50 border border-green-100">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Da Incassare</p>
                  <p className="text-3xl font-bold text-gray-900">
                    €{parentGroups.reduce((sum, group) => sum + Math.max(0, group.totalAmount - group.paidAmount), 0).toFixed(0)}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                  <Clock className="h-8 w-8 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Esentati</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {parentGroups.filter(group => group.isExempted).length}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-100">
                  <Shield className="h-8 w-8 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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

      <Card className="mb-6 md:sticky md:top-24 z-30 bg-gradient-to-r from-white/80 to-white/60 backdrop-blur-md border border-white/20 shadow-lg rounded-2xl overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Cerca per nome genitore, telefono o nome studente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="h-5 w-5 text-gray-400" />}
                fullWidth
                className="anime-input"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto md:overflow-visible pb-1">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleSort('parentName')}
                className="whitespace-nowrap"
                leftIcon={<Filter className="h-4 w-4" />}
                rightIcon={sortField === 'parentName' ? (
                  sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                ) : undefined}
              >
                Nome
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleSort('totalAmount')}
                className="whitespace-nowrap"
                leftIcon={<ArrowUpDown className="h-4 w-4" />}
                rightIcon={sortField === 'totalAmount' ? (
                  sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                ) : undefined}
              >
                Importo
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleSort('paidAmount')}
                className="whitespace-nowrap"
                leftIcon={<CreditCard className="h-4 w-4" />}
                rightIcon={sortField === 'paidAmount' ? (
                  sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                ) : undefined}
              >
                Pagato
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="whitespace-nowrap"
                leftIcon={<FileText className="h-4 w-4" />}
                title="Esporta CSV"
                aria-label="Esporta CSV"
              >
                Esporta CSV
              </Button>
            </div>
          </div>
          {/* Status filter tabs */}
          <div className="mt-4 flex flex-wrap gap-2">
            {([
              { key: 'all', label: 'Tutti' },
              { key: 'paid', label: 'Pagato' },
              { key: 'partial', label: 'Parziale' },
              { key: 'unpaid', label: 'Non Pagato' },
              { key: 'exempted', label: 'Esentati' },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`px-3 py-1.5 rounded-full text-sm transition border ${
                  statusFilter === t.key
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white/70 text-gray-700 border-gray-200 hover:bg-white'
                }`}
                aria-pressed={statusFilter === t.key}
              >
                {t.label}
                {t.key !== 'all' && (
                  <span className="ml-2 text-xs opacity-80">
                    {parentGroups.filter(g => getPaymentStatus(g).status === t.key).length}
                  </span>
                )}
                {t.key === 'all' && (
                  <span className="ml-2 text-xs opacity-80">{parentGroups.length}</span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main layout */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-light">Caricamento dei dati di pagamento...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          {/* Families list */}
          <div className="lg:col-span-2">
            {filteredParentGroups.length > 0 ? (
              <div className="space-y-4">
                {filteredParentGroups.map(group => {
                  const paymentStatus = getPaymentStatus(group);
                  const remainingAmount = group.isExempted ? 0 : Math.max(0, group.totalAmount - group.paidAmount);
                  const paymentHistory = getPaymentHistoryForParent(group.parentContact);
                  const isHistoryExpanded = showPaymentHistory === group.parentContact;
            
            return (
              <motion.div
                key={group.parentContact}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="group"
              >
                <Card
                  className="relative bg-white/80 backdrop-blur-md border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden hover:bg-white/90"
                >
                  <CardContent className="p-6">
                    {/* Row header - compact list style */}
                    <button
                      type="button"
                      onClick={() => setExpandedRow(expandedRow === group.parentContact ? null : group.parentContact)}
                      className="w-full text-left"
                      aria-expanded={expandedRow === group.parentContact}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 items-center justify-center shadow-sm hidden sm:flex">
                            <Users className="h-6 w-6 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-semibold text-gray-900 truncate">{group.parentName}</h3>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${paymentStatus.color} hidden sm:inline-flex`}>
                                {paymentStatus.text}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 truncate hidden sm:flex items-center gap-3">
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-4 w-4 text-gray-400" />
                                {group.parentContact}
                              </span>
                              <span className="text-gray-300">•</span>
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-4 w-4 text-gray-400" />
                                {group.children.length} {group.children.length === 1 ? 'Figlio/a' : 'figli'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <div className={`text-xl font-bold mb-1 ${
                              paymentStatus.status === 'paid' ? 'text-green-700' :
                              paymentStatus.status === 'partial' ? 'text-amber-700' :
                              paymentStatus.status === 'unpaid' ? 'text-red-700' :
                              'text-purple-700'
                            }`}>
                              €{group.paidAmount.toFixed(0)}
                              <span className={`text-sm font-normal ml-1 ${
                                paymentStatus.status === 'paid' ? 'text-green-600' :
                                paymentStatus.status === 'partial' ? 'text-amber-600' :
                                paymentStatus.status === 'unpaid' ? 'text-red-600' :
                                'text-purple-600'
                              }`}>
                                / {group.isExempted ? '0' : `€${group.totalAmount.toFixed(0)}`}
                              </span>
                            </div>
                            {!group.isExempted && (
                              <div className={`text-sm font-medium ${remainingAmount > 0 ? 'text-red-600' : 'text-green-600'} hidden sm:block`}>
                                Rimanente: €{remainingAmount.toFixed(0)}
                              </div>
                            )}
                          </div>
                          <div className="p-2 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors">
                            {expandedRow === group.parentContact ? (
                              <ChevronUp className="h-5 w-5 text-gray-600" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-gray-600" />
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Details and actions container */}
                    <div className="mt-3 flex flex-col md:flex-row items-stretch md:items-start justify-between gap-4">

                        {/* Details (collapsed by default) */}
                        <AnimatePresence>
                          {expandedRow === group.parentContact && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex-1 mt-3 pt-3 border-t border-slate-200"
                              >
                        {/* Children List (compact, show max 3) */}
                        <div className="mb-3">
                          <h4 className="text-xs font-medium text-gray-700 mb-1">Figli Iscritti</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {(() => {
                              const max = 3;
                              const shown = group.children.slice(0, max);
                              const extra = group.children.length - shown.length;
                              return (
                                <>
                                  {shown.map(child => {
                                    const childClass = classes[child.classId || ''];
                                    return (
                                      <span
                                        key={child.id}
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-medium border ${childClass ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-gray-50 text-gray-800 border-gray-200'}`}
                                      >
                                        {child.displayName}
                                        {child.classId && childClass && (
                                          <span className="ml-1 text-blue-600 font-normal">({childClass.name})</span>
                                        )}
                                      </span>
                                    );
                                  })}
                                  {extra > 0 && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-medium bg-white border border-gray-200 text-gray-600">+{extra}</span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Payment Summary (compact) */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-3">
                          <div className={`p-3 rounded-xl border ${group.isExempted ? 'bg-purple-50 border-purple-100' : 'bg-gray-50 border-gray-100'}`}>
                            <span className={`text-[10px] uppercase tracking-wider ${group.isExempted ? 'text-purple-600' : 'text-gray-500'}`}>
                              Totale dovuto:
                            </span>
                            <div className={`font-semibold text-base mt-0.5 ${group.isExempted ? 'text-purple-700' : 'text-gray-900'}`}>
                              {group.isExempted ? 'Esentato' : `€${group.totalAmount.toFixed(0)}`}
                            </div>
                          </div>
                          <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                            <span className="text-green-600 text-[10px] uppercase tracking-wider">Già pagato:</span>
                            <div className="font-semibold text-green-700 text-base mt-0.5 flex items-center">
                              €{group.paidAmount.toFixed(0)}
                              {paymentHistory.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowPaymentHistory(
                                    isHistoryExpanded ? null : group.parentContact
                                  )}
                                  className="ml-1 p-1 h-auto"
                                  aria-label="Visualizza lo storico dei pagamenti"
                                  title="Visualizza lo storico dei pagamenti"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className={`p-3 rounded-xl border ${
                            remainingAmount > 0 ? 'bg-red-50 border-red-100' : 
                            group.isExempted ? 'bg-purple-50 border-purple-100' : 
                            'bg-green-50 border-green-100'
                          }`}>
                            <span className={`text-[10px] uppercase tracking-wider ${
                              remainingAmount > 0 ? 'text-red-600' : 
                              group.isExempted ? 'text-purple-600' : 
                              'text-green-600'
                            }`}>
                              Rimanente:
                            </span>
                            <div className={`font-semibold text-base mt-0.5 ${
                              remainingAmount > 0 ? 'text-red-700' : 
                              group.isExempted ? 'text-purple-700' : 
                              'text-green-700'
                            }`}>
                              €{remainingAmount.toFixed(0)}
                            </div>
                          </div>
                          <div className="col-span-2 sm:col-span-3 bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col justify-between">
                            <span className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Progresso</span>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-0.5 relative">
                              <div 
                                className={`h-2 rounded-full ${
                                  group.isExempted ? 'bg-purple-500' : 
                                  group.paidAmount >= group.totalAmount ? 'bg-green-500' : 
                                  group.paidAmount > 0 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ 
                                  width: group.isExempted ? '100%' : `${Math.min(100, (group.paidAmount / group.totalAmount) * 100)}%` 
                                }}
                                title={group.isExempted 
                                  ? 'Esentato'
                                  : `${Math.round((group.paidAmount / group.totalAmount) * 100)}% • Pagato €${group.paidAmount.toFixed(0)} su €${group.totalAmount.toFixed(0)}`}
                              >
                                {/* percent label removed for compactness */}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Payment History */}
                        <AnimatePresence>
                          {isHistoryExpanded && paymentHistory.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100"
                            >
                              <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                                <Receipt className="h-4 w-4 mr-2 text-gray-500" />
                                Storico Pagamenti:
                                <span className="ml-2 text-xs text-gray-500">
                                  ({paymentHistory.length} {paymentHistory.length === 1 ? 'pagamento' : 'pagamenti'})
                                </span>
                              </h5>
                              <div className="space-y-3">
                                {paymentHistory.map(payment => (
                                  <div key={payment.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                                    <div className="flex-1">
                                      <div className="text-sm font-medium flex items-center">
                                        {editingPayment === payment.id ? (
                                          <div className="flex items-center space-x-2">
                                            <span className="text-gray-500">€</span>
                                            <input
                                              type="text"
                                              step="0.01"
                                              value={editAmount}
                                              onChange={(e) => setEditAmount(e.target.value)}
                                              className="w-24 px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 anime-input"
                                              autoFocus
                                            />
                                            <Button
                                              size="sm"
                                              onClick={() => {
                                                const amount = parseFloat(editAmount);
                                                if (!isNaN(amount) && amount > 0) {
                                                  handleEditPayment(payment.id, Math.round(amount * 100) / 100);
                                                }
                                              }}
                                              disabled={!editAmount || parseFloat(editAmount) <= 0}
                                              className="anime-button"
                                              aria-label="Salva importo modificato"
                                            >
                                              <Save className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => {
                                                setEditingPayment(null);
                                                setEditAmount('');
                                              }}
                                              className="border-gray-300"
                                              aria-label="Annulla modifica importo"
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <span className="flex items-center">
                                            <CreditCardIcon className="h-4 w-4 mr-2 text-green-500" />
                                            €{payment.amount.toFixed(2).replace(/\.00$/, '')}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1 flex items-center">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {format(payment.date, 'd MMMM yyyy', { locale: it })}
                                        {payment.notes && <span className="ml-2 truncate max-w-[120px]">• {payment.notes}</span>}
                                      </div>
                                    </div>
                                    {editingPayment !== payment.id && (
                                      <div className="flex items-center space-x-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setEditingPayment(payment.id);
                                            setEditAmount(payment.amount.toString());
                                          }}
                                          className="p-1 h-auto text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                          aria-label="Modifica importo pagamento"
                                          title="Modifica importo"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeletePayment(payment.id)}
                                          className="p-1 h-auto text-red-600 hover:text-red-800 hover:bg-red-50"
                                          aria-label="Elimina pagamento"
                                          title="Elimina pagamento"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        {/* Empty history state when expanded but no records */}
                        <AnimatePresence>
                          {isHistoryExpanded && paymentHistory.length === 0 && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-600 flex items-center"
                            >
                              <Receipt className="h-4 w-4 mr-2 text-gray-400" />
                              Nessun pagamento registrato per questa famiglia.
                            </motion.div>
                          )}
                        </AnimatePresence>
                              </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Actions column (only when expanded) */}
                        {expandedRow === group.parentContact && (
                          <div className="flex flex-col space-y-3 md:ml-6 w-full md:w-auto">
                            <div className="flex flex-col space-y-3">
                              <Button
                                size="md"
                                onClick={() => {
                                  setSelectedParent(group);
                                  setIsPaymentDialogOpen(true);
                                }}
                                disabled={group.isExempted}
                                leftIcon={<Plus className="h-5 w-5" />}
                                className={`bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl ${group.isExempted ? 'opacity-50 cursor-not-allowed' : ''} w-full md:w-auto`}
                              >
                                Aggiungi Pagamento
                              </Button>
                              
                              <Button
                                size="md"
                                variant="outline"
                                onClick={() => handleToggleExemption(group)}
                                disabled={editingExemption === group.parentContact}
                                leftIcon={
                                  editingExemption === group.parentContact ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />
                                  ) : (
                                    <Shield className="h-5 w-5" />
                                  )
                                }
                                className={`rounded-xl transition-all duration-200 ${group.isExempted ? 
                                  "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300" : 
                                  "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                                } shadow-sm hover:shadow-md w-full md:w-auto`}
                              >
                                {group.isExempted ? 'Rimuovi Esenzione' : 'Esenta'}
                              </Button>
                            </div>
                          </div>
                        )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
                );
              })}
              </div>
            ) : (
              <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
                <CardContent className="p-12 text-center">
                  <Euro className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                  <h3 className="text-xl font-light text-gray-900 mb-2">Nessuna famiglia trovata</h3>
                  <p className="text-gray-600 max-w-md mx-auto mb-8">
                    {searchQuery 
                      ? 'Nessun risultato per la ricerca corrente. Prova a modificare o pulire i filtri.' 
                      : 'Non ci sono famiglie con studenti iscritti.'}
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    {searchQuery && (
                      <Button
                        variant="outline"
                        onClick={() => setSearchQuery('')}
                        className="border-gray-300"
                        aria-label="Pulisci ricerca"
                      >
                        Pulisci ricerca
                      </Button>
                    )}
                    <Button
                      leftIcon={<UserPlus className="h-4 w-4" />}
                      className="anime-button"
                    >
                      Aggiungi Studente
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent payments sidebar (hidden on mobile) */}
          <div className="hidden lg:block">
            <Card className="bg-white/70 backdrop-blur-md border border-white/20 shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-white/60 border-b border-gray-200">
                <CardTitle className="text-gray-900 flex items-center">
                  <Receipt className="h-5 w-5 mr-2 text-gray-500" />
                  Pagamenti Recenti
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {paymentRecords.length === 0 ? (
                  <p className="text-sm text-gray-600">Nessun pagamento registrato.</p>
                ) : (
                  <div className="space-y-3">
                    {paymentRecords.slice(0, 8).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-white/80 rounded-xl border border-gray-100">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{p.parentName}</div>
                          <div className="text-xs text-gray-500 flex items-center mt-0.5">
                            <Calendar className="h-3 w-3 mr-1" />
                            {format(p.date, 'd MMMM yyyy', { locale: it })}
                            {p.notes && <span className="ml-2 truncate max-w-[120px]">• {p.notes}</span>}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-green-700">€{p.amount.toFixed(0)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Payment Dialog */}
      <AnimatePresence>
        {isPaymentDialogOpen && selectedParent && (
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
                  <Wallet className="h-5 w-5 mr-2 text-blue-600" />
                  Aggiungi Pagamento
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsPaymentDialogOpen(false);
                    setSelectedParent(null);
                    setPaymentAmount('');
                    setPaymentNotes('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="Chiudi"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-sm text-gray-600 mb-2 flex items-center">
                    <Users className="h-4 w-4 mr-2 text-gray-400" />
                    <strong>Famiglia:</strong> <span className="ml-2">{selectedParent.parentName}</span>
                    <span className="ml-2 text-xs text-gray-500">({selectedParent.children.length} {selectedParent.children.length === 1 ? 'Figlio/a' : 'figli'})</span>
                  </p>
                  <p className="text-sm text-gray-600 mb-2 flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-gray-400" />
                    <strong>Telefono:</strong> <span className="ml-2">{selectedParent.parentContact}</span>
                  </p>
                  <p className="text-sm text-gray-600 mb-2 flex items-center">
                    <Euro className="h-4 w-4 mr-2 text-gray-400" />
                    <strong>Totale dovuto:</strong> <span className="ml-2">€{selectedParent.totalAmount.toFixed(0)}</span>
                  </p>
                  <p className="text-sm text-gray-600 mb-2 flex items-center">
                    <Euro className="h-4 w-4 mr-2 text-gray-400" />
                    <strong>Rimanente da pagare:</strong> <span className="ml-2 font-medium text-blue-700">€{Math.max(0, selectedParent.totalAmount - selectedParent.paidAmount).toFixed(0)}</span>
                  </p>
                </div>

                {/* Tariffe Annuali (visible only in dialog) */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 flex items-center gap-2 flex-wrap">
                  <Euro className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-gray-900">Tariffe Annuali</span>
                  <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">1 Figlio/a: €120</span>
                  <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">2: €220</span>
                  <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">3: €300</span>
                  <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">4+: €360</span>
                </div>

                <Input
                  label="Importo Pagamento"
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => {
                    // Limit to 2 decimal places
                    const value = e.target.value;
                    if (value === '' || /^\d+(\.\d{0,2})?$/.test(value)) {
                      setPaymentAmount(value);
                    }
                  }}
                  leftIcon={<Euro className="h-5 w-5 text-gray-400" />}
                  placeholder="0.00"
                  helperText={`Massimo: €${Math.max(0, selectedParent.totalAmount - selectedParent.paidAmount).toFixed(0)}`}
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
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Es: Pagamento in contanti, Bonifico bancario, ecc."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsPaymentDialogOpen(false);
                      setSelectedParent(null);
                      setPaymentAmount('');
                      setPaymentNotes('');
                    }}
                    disabled={isSaving}
                    className="border-gray-300 text-gray-700"
                  >
                    Chiudi
                  </Button>
                  <Button
                    onClick={handleAddPayment}
                    isLoading={isSaving}
                    disabled={isSaving || !paymentAmount}
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
      </div>
    </div>
  );
};