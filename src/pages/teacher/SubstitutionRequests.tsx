import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, addDoc, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  Calendar, 
  Clock, 
  School, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  X, 
  FileText,
  User,
  Info
} from 'lucide-react';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Substitution, Class } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

export const SubstitutionRequests: React.FC = () => {
  const { userProfile } = useAuth();
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    classId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '14:00',
    endTime: '17:00',
    reason: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile || userProfile.role !== 'teacher') return;
      
      setIsLoading(true);
      try {
        // Fetch all classes
        const classesQuery = query(collection(db, 'classes'));
        const classesDocs = await getDocs(classesQuery);
        const fetchedClasses = classesDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));
        setClasses(fetchedClasses);
        
        // Fetch teacher's substitution requests
        const substitutionsQuery = query(
          collection(db, 'substitutions'),
          where('teacherId', '==', userProfile.id),
          orderBy('createdAt', 'desc')
        );
        const substitutionsDocs = await getDocs(substitutionsQuery);
        const fetchedSubstitutions = substitutionsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
            approvedAt: data.approvedAt?.toDate() || null
          } as Substitution;
        });
        setSubstitutions(fetchedSubstitutions);
      } catch (error) {
        console.error('Error fetching data:', error);
        setMessage({ type: 'error', text: 'Errore nel caricamento dei dati' });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userProfile) return;
    
    if (!formData.classId || !formData.date || !formData.startTime || !formData.endTime || !formData.reason) {
      setMessage({ type: 'error', text: 'Tutti i campi sono obbligatori' });
      return;
    }
    
    setIsSubmitting(true);
    setMessage(null);
    
    try {
      const selectedClass = classes.find(c => c.id === formData.classId);
      if (!selectedClass) {
        throw new Error('Classe non trovata');
      }
      
      const newSubstitution: Omit<Substitution, 'id'> = {
        teacherId: userProfile.id,
        teacherName: userProfile.displayName,
        classId: formData.classId,
        className: selectedClass.name,
        originalTeacherId: selectedClass.teacherId || undefined,
        originalTeacherName: selectedClass.teacherId ? 'Insegnante originale' : undefined, // This would need to be fetched
        date: new Date(formData.date),
        startTime: formData.startTime,
        endTime: formData.endTime,
        reason: formData.reason.trim(),
        status: 'pending',
        createdAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'substitutions'), newSubstitution);

      // Record substitution history entry
      try {
        await addDoc(collection(db, 'substitutionHistory'), {
          substitutionId: docRef.id,
          action: 'created',
          teacherId: newSubstitution.teacherId,
          teacherName: newSubstitution.teacherName,
          classId: newSubstitution.classId,
          className: newSubstitution.className,
          date: newSubstitution.date,
          status: newSubstitution.status,
          createdAt: new Date(),
        });
      } catch (e) {
        // Non-blocking: log but do not fail the main flow
        console.warn('Failed to write substitution history:', e);
      }

      // Add to local state
      setSubstitutions(prev => [{
        ...newSubstitution,
        id: docRef.id
      } as Substitution, ...prev]);
      
      setMessage({ type: 'success', text: 'Richiesta di supplenza inviata con successo' });
      setIsFormOpen(false);
      
      // Reset form
      setFormData({
        classId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '14:00',
        endTime: '17:00',
        reason: ''
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error submitting substitution request:', error);
      setMessage({ type: 'error', text: 'Errore nell\'invio della richiesta' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">In attesa</span>;
      case 'approved':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Approvata</span>;
      case 'rejected':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Rifiutata</span>;
      case 'completed':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Completata</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const formatDate = (date: Date): string => {
    return format(date, 'd MMMM yyyy', { locale: it });
  };

  if (!userProfile || userProfile.role !== 'teacher') {
    return (
      <PageContainer title="Accesso non autorizzato">
        <p>Non hai i permessi per accedere a questa pagina.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Richieste di Supplenza"
      description="Richiedi e gestisci le tue supplenze"
      actions={
        <Button
          onClick={() => setIsFormOpen(true)}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Nuova Richiesta
        </Button>
      }
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

      {/* New Substitution Form */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <Card variant="elevated" className="bg-white/95 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden border border-white/20">
              <CardHeader className="bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 border-b border-amber-100">
                <CardTitle className="flex items-center text-gray-900">
                  <Plus className="h-5 w-5 mr-2 text-amber-600" />
                  Nuova Richiesta di Supplenza
                </CardTitle>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Classe *
                      </label>
                      <div className="relative">
                        <School className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <select
                          className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm bg-white py-3 pl-10 pr-4 transition-colors anime-input"
                          value={formData.classId}
                          onChange={(e) => setFormData(prev => ({ ...prev, classId: e.target.value }))}
                          required
                        >
                          <option value="">Seleziona una classe</option>
                          {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data *
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="date"
                          className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm bg-white py-3 pl-10 pr-4 transition-colors anime-input"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        min={format(new Date(), 'yyyy-MM-dd')}
                        required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Turno *
                      </label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <select
                          className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm bg-white py-3 pl-10 pr-4 transition-colors anime-input"
                          value={formData.timeSlot}
                          onChange={(e) => setFormData(prev => ({ ...prev, timeSlot: e.target.value }))}
                          required
                        >
                          <option value="">Seleziona turno</option>
                          <option value="domenica_mattina">Domenica Mattina (9:00 - 12:30)</option>
                          <option value="sabato_pomeriggio">Sabato Pomeriggio (14:00 - 17:00)</option>
                          <option value="domenica_pomeriggio">Domenica Pomeriggio (14:00 - 17:00)</option>
                          <option value="sabato_sera">Sabato Sera (17:30 - 20:00)</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Motivo *
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {SUBSTITUTION_REASONS.map(reason => (
                          <button
                            key={reason.id}
                            type="button"
                            onClick={() => setFormData(prev => ({ 
                              ...prev, 
                              reason: reason.id,
                              priority: reason.defaultPriority 
                            }))}
                            className={`p-4 rounded-xl border-2 transition-all text-center ${
                              formData.reason === reason.id
                                ? 'border-amber-500 bg-amber-50 shadow-md'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="text-2xl mb-2">{reason.icon}</div>
                            <div className="text-sm font-medium text-gray-900">{reason.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Priorità
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {PRIORITY_LEVELS.map(level => (
                          <button
                            key={level.id}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, priority: level.id }))}
                            className={`p-3 rounded-lg border-2 transition-all text-center ${
                              formData.priority === level.id
                                ? `border-${level.color}-500 bg-${level.color}-50`
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className={`text-xs font-medium text-${level.color}-700`}>
                              {level.label}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descrizione dettagliata *
                      </label>
                      <textarea
                        className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm bg-white py-3 px-4 transition-colors anime-input"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        placeholder="Fornisci dettagli aggiuntivi sulla richiesta..."
                        required
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <div className="flex items-center">
                        <input
                          id="isRecurring"
                          type="checkbox"
                          checked={formData.isRecurring}
                          onChange={(e) => setFormData(prev => ({ ...prev, isRecurring: e.target.checked }))}
                          className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                        />
                        <label htmlFor="isRecurring" className="ml-2 block text-sm text-gray-700">
                          Richiesta ricorrente (più date)
                        </label>
                      </div>
                      
                      {formData.isRecurring && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Data fine ricorrenza
                          </label>
                          <input
                            type="date"
                            className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm bg-white py-3 px-4 transition-colors anime-input"
                            value={formData.endDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                            min={formData.date}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
                <div className="bg-gradient-to-r from-gray-50 to-amber-50 border-t border-amber-100 flex justify-end space-x-4 p-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsFormOpen(false)}
                    disabled={isSubmitting}
                    leftIcon={<X className="h-4 w-4" />}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Annulla
                  </Button>
                  <Button
                    type="submit"
                    isLoading={isSubmitting}
                    disabled={isSubmitting}
                    leftIcon={<Send className="h-4 w-4" />}
                    className="anime-button bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                  >
                    Invia Richiesta
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Substitution List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-light">Caricamento delle richieste di supplenza...</p>
        </div>
      ) : substitutions.length > 0 ? (
        <div className="space-y-6">
          {substitutions.map((substitution) => (
            <Card 
              key={substitution.id}
              variant="bordered" 
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="flex items-center mb-2">
                      <School className="h-5 w-5 text-blue-600 mr-2" />
                      <h3 className="text-lg font-medium text-gray-900">{substitution.className}</h3>
                      <div className="ml-3">
                        {getStatusBadge(substitution.status)}
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{formatDate(substitution.date)}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-gray-400" />
                        <span>Orario: {substitution.startTime} - {substitution.endTime}</span>
                      </div>
                      <div className="flex items-start">
                        <FileText className="h-4 w-4 mr-2 text-gray-400 mt-1" />
                        <span>Motivo: {substitution.reason}</span>
                      </div>
                      {substitution.notes && (
                        <div className="flex items-start">
                          <Info className="h-4 w-4 mr-2 text-gray-400 mt-1" />
                          <span>Note: {substitution.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <div className="text-sm text-gray-500">
                      Richiesta il {format(substitution.createdAt, 'd MMM yyyy', { locale: it })}
                    </div>
                    
                    {substitution.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 text-red-600 hover:bg-red-50 border-red-200"
                        leftIcon={<X className="h-4 w-4" />}
                        onClick={() => {
                          // Implement cancel functionality
                          alert('Funzionalità di annullamento non ancora implementata');
                        }}
                      >
                        Annulla
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-6">
              <School className="h-10 w-10 text-amber-600" />
            </div>
            <h3 className="text-2xl font-light text-gray-900 mb-3">Nessuna richiesta di supplenza</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-8">
              Non hai ancora effettuato richieste di supplenza. Clicca sul pulsante "Nuova Richiesta" per iniziare.
            </p>
            <Button
              onClick={() => setIsFormOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
              className="anime-button bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
            >
              Nuova Richiesta
            </Button>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
};