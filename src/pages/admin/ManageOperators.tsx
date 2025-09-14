import React, { useState, useEffect } from 'react';
import { Users, Search, Eye, Edit, Check, X, AlertCircle, Shield, Settings, Mail, Phone, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { collection, query, where, orderBy, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { User } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

export const ManageOperators: React.FC = () => {
  const { userProfile } = useAuth();
  const [operators, setOperators] = useState<User[]>([]);
  const [pendingOperators, setPendingOperators] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingOperator, setProcessingOperator] = useState<string | null>(null);
  const [viewingOperator, setViewingOperator] = useState<User | null>(null);
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<User | null>(null);

  useEffect(() => {
    const fetchOperators = async () => {
      if (!userProfile || userProfile.role !== 'admin') return;
      
      setIsLoading(true);
      
      try {
        const operatorsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'operatore'),
          orderBy('createdAt', 'desc')
        );
        const operatorsDocs = await getDocs(operatorsQuery);
        const allOperators = operatorsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate() || new Date(),
            birthDate: data.birthDate?.toDate() || null,
          } as User;
        });

        const approved = allOperators.filter(op => op.accountStatus === 'active');
        const pending = allOperators.filter(op => op.accountStatus === 'pending_approval');

        setOperators(approved);
        setPendingOperators(pending);
      } catch (error) {
        console.error('Error fetching operators:', error);
        setMessage({ type: 'error', text: 'Errore nel caricamento degli operatori' });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchOperators();
  }, [userProfile]);

  const handleApproveOperator = async (operatorId: string) => {
    if (!userProfile) return;
    
    setProcessingOperator(operatorId);
    
    try {
      await updateDoc(doc(db, 'users', operatorId), {
        accountStatus: 'active',
        approvedBy: userProfile.id,
        approvedAt: new Date(),
        updatedAt: new Date()
      });

      const operator = pendingOperators.find(op => op.id === operatorId);
      if (operator) {
        const updatedOperator = {
          ...operator,
          accountStatus: 'active' as const,
          approvedBy: userProfile.id,
          approvedAt: new Date()
        };
        
        setOperators(prev => [...prev, updatedOperator]);
        setPendingOperators(prev => prev.filter(op => op.id !== operatorId));
      }

      setMessage({ type: 'success', text: 'Operatore approvato con successo' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error approving operator:', error);
      setMessage({ type: 'error', text: 'Errore nell\'approvazione dell\'operatore' });
    } finally {
      setProcessingOperator(null);
    }
  };

  const handleRejectOperator = async (operatorId: string) => {
    setProcessingOperator(operatorId);
    try {
      await deleteDoc(doc(db, 'users', operatorId));
      setPendingOperators(prev => prev.filter(op => op.id !== operatorId));
      setMessage({ type: 'success', text: 'Richiesta rifiutata e profilo rimosso' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error rejecting operator:', error);
      setMessage({ type: 'error', text: 'Errore nel rifiuto della richiesta' });
    } finally {
      setProcessingOperator(null);
      setRejectTarget(null);
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return 'Data non valida';
    }
    return format(date, 'd MMMM yyyy', { locale: it });
  };

  const filteredOperators = operators.filter(op => 
    op.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    op.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPending = pendingOperators.filter(op => 
    op.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    op.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-8 text-center max-w-md mx-auto">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-2xl font-light text-gray-900 mb-2">Accesso non autorizzato</h3>
          <p className="text-gray-600">Solo gli amministratori possono gestire gli operatori.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-green-600 to-teal-700 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
                <Settings className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Gestione Operatori</h1>
                <p className="text-green-100 mt-1">Approva le richieste di registrazione degli operatori</p>
              </div>
            </div>
          </div>
        </div>
      </div>

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
              <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
              <span>{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search */}
        <div className="mb-6">
          <Input
            type="text"
            placeholder="Cerca operatori per nome o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-5 w-5 text-gray-400" />}
            className="max-w-md"
          />
        </div>

        {/* Pending Approvals */}
        {filteredPending.length > 0 && (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
            <div className="border-b border-amber-200 p-6">
              <h3 className="text-lg font-semibold text-amber-800 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Richieste in Attesa ({filteredPending.length})
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {filteredPending.map(operator => (
                <div key={operator.id} className="bg-white rounded-xl p-4 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{operator.displayName}</h4>
                      <p className="text-sm text-gray-600">{operator.email}</p>
                      <p className="text-xs text-gray-500">Registrato il {formatDate(operator.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setViewingOperator(operator);
                          setIsViewDetailsOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Dettagli
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRejectTarget(operator)}
                        className="text-red-600 hover:text-red-700"
                        disabled={processingOperator === operator.id}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Rifiuta
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApproveOperator(operator.id)}
                        isLoading={processingOperator === operator.id}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approva
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Operators */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Operatori Attivi ({filteredOperators.length})
            </h3>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mx-auto"></div>
                <p className="mt-2 text-slate-600">Caricamento operatori...</p>
              </div>
            ) : filteredOperators.length > 0 ? (
              <div className="space-y-4">
                {filteredOperators.map(operator => (
                  <div key={operator.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 flex items-center justify-center">
                          <span className="text-emerald-700 font-semibold text-sm">
                            {operator.displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{operator.displayName}</h4>
                          <div className="flex items-center text-sm text-gray-600 mt-1">
                            <Mail className="h-4 w-4 mr-1" />
                            {operator.email}
                          </div>
                          {operator.phoneNumber && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Phone className="h-4 w-4 mr-1" />
                              {operator.phoneNumber}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-sm font-medium rounded-full">
                          Attivo
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setViewingOperator(operator);
                            setIsViewDetailsOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Settings className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">Nessun operatore trovato</h3>
                <p className="text-gray-500">Non ci sono operatori che corrispondono ai criteri di ricerca.</p>
              </div>
            )}
          </div>
        </div>

        {/* View Details Dialog */}
        <AnimatePresence>
          {isViewDetailsOpen && viewingOperator && (
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
                className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">Dettagli Operatore</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsViewDetailsOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                      <div className="p-3 bg-gray-50 rounded-lg">{viewingOperator.displayName}</div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <div className="p-3 bg-gray-50 rounded-lg">{viewingOperator.email}</div>
                    </div>
                    {viewingOperator.phoneNumber && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                        <div className="p-3 bg-gray-50 rounded-lg">{viewingOperator.phoneNumber}</div>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data Registrazione</label>
                      <div className="p-3 bg-gray-50 rounded-lg">{formatDate(viewingOperator.createdAt)}</div>
                    </div>
                  </div>

                  {viewingOperator.accountStatus === 'pending_approval' && (
                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setIsViewDetailsOpen(false);
                          setRejectTarget(viewingOperator);
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Rifiuta
                      </Button>
                      <Button
                        onClick={() => {
                          setIsViewDetailsOpen(false);
                          handleApproveOperator(viewingOperator.id);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Approva Operatore
                      </Button>
                    </div>
                  )}
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
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
              >
                <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 rounded-t-2xl text-white">
                  <h3 className="text-lg font-semibold">Conferma rifiuto</h3>
                  <p className="text-red-100 mt-1">
                    Rifiutare la richiesta di <span className="font-medium">{rejectTarget.displayName}</span>?
                  </p>
                </div>
                <div className="px-6 py-4 flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setRejectTarget(null)}
                    disabled={processingOperator === rejectTarget.id}
                  >
                    Annulla
                  </Button>
                  <Button
                    onClick={() => handleRejectOperator(rejectTarget.id)}
                    isLoading={processingOperator === rejectTarget.id}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Rifiuta definitivamente
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
