import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db } from '../../services/firebase';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Calendar, Clock, FileText, Upload, Download, Eye, CheckCircle, AlertCircle } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { useAuth } from '../../context/AuthContext';

interface Homework {
  id: string;
  title: string;
  description: string;
  dueDate: any;
  status: 'pending' | 'completed' | 'late';
  subject: string;
  attachmentUrls?: string[];
  className?: string;
}

interface ChildData {
  id: string;
  firstName: string;
  lastName: string;
  classId?: string;
}

const ParentHomework: React.FC = () => {
  const { userProfile } = useAuth();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [homework, setHomework] = useState<Homework[]>([]);
  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Format date helper
  const formatDate = useCallback((date: any): string => {
    try {
      if (!date) return 'Data non specificata';
      
      if (date.toDate) {
        date = date.toDate();
      }
      
      if (typeof date === 'string' || typeof date === 'number') {
        date = new Date(date);
      }
      
      if (!(date instanceof Date) || isNaN(date.getTime())) {
        return 'Data non valida';
      }
      
      return format(date, 'd MMMM yyyy', { locale: it });
    } catch (error) {
      return 'Errore data';
    }
  }, []);

  const formatDateTime = useCallback((date: any): string => {
    try {
      if (!date) return 'Data non specificata';
      
      if (date.toDate) {
        date = date.toDate();
      }
      
      if (typeof date === 'string' || typeof date === 'number') {
        date = new Date(date);
      }
      
      if (!(date instanceof Date) || isNaN(date.getTime())) {
        return 'Data non valida';
      }
      
      return format(date, 'd MMMM yyyy - HH:mm', { locale: it });
    } catch (error) {
      return 'Errore data';
    }
  }, []);

  // Fetch children
  useEffect(() => {
    const fetchChildren = async () => {
      if (!userProfile?.id) return;
      
      try {
        const childrenQuery = query(
          collection(db, 'students'),
          where('parentId', '==', userProfile.id.trim())
        );
        
        const childrenSnapshot = await getDocs(childrenQuery);
        const childrenData: ChildData[] = childrenSnapshot.docs.map(doc => ({
          id: doc.id,
          firstName: doc.data().firstName || 'Nome',
          lastName: doc.data().lastName || 'Cognome',
          classId: doc.data().classId || doc.data().currentClass
        }));
        
        setChildren(childrenData);
        if (childrenData.length > 0) {
          setSelectedChildId(childrenData[0].id);
        }
      } catch (err) {
        console.error('Error fetching children:', err);
        setError('Errore nel caricamento dei figli');
      }
    };
    
    fetchChildren();
  }, [userProfile]);

  // Fetch homework for selected child
  useEffect(() => {
    const fetchHomework = async () => {
      if (!selectedChildId) return;
      
      const selectedChild = children.find(child => child.id === selectedChildId);
      if (!selectedChild?.classId) {
        setHomework([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const homeworkQuery = query(
          collection(db, 'homework'),
          where('classId', '==', selectedChild.classId),
          orderBy('dueDate', 'desc')
        );
        
        const homeworkSnapshot = await getDocs(homeworkQuery);
        const homeworkData: Homework[] = homeworkSnapshot.docs.map(doc => {
          const data = doc.data();
          
          let status = 'pending';
          if (data.dueDate) {
            const dueDate = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
            if (dueDate < new Date()) {
              status = 'late';
            }
          }
          
          return {
            id: doc.id,
            title: data.title || 'Compito',
            description: data.description || '',
            dueDate: data.dueDate,
            status: status as 'pending' | 'completed' | 'late',
            subject: data.subject || data.className || 'Materia non specificata',
            attachmentUrls: data.attachmentUrls || [],
            className: data.className
          };
        });
        
        setHomework(homeworkData);
      } catch (err) {
        console.error('Error fetching homework:', err);
        setError('Errore nel caricamento dei compiti');
      } finally {
        setLoading(false);
      }
    };
    
    fetchHomework();
  }, [selectedChildId, children]);

  const handleChildChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedChildId(event.target.value);
  };

  const handleHomeworkDetails = (hw: Homework) => {
    setSelectedHomework(hw);
    setShowDetailsModal(true);
  };

  const handleHomeworkSubmission = (hw: Homework) => {
    setSelectedHomework(hw);
    setSubmissionText('');
    setSubmissionFile(null);
    setShowSubmissionModal(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSubmissionFile(file);
    }
  };

  const handleSubmitHomework = async () => {
    if (!selectedHomework || !selectedChildId) return;
    
    setIsSubmitting(true);
    try {
      let attachmentUrl = '';
      
      if (submissionFile) {
        const storageRef = ref(storage, `homework-submissions/${selectedChildId}/${selectedHomework.id}/${submissionFile.name}`);
        const snapshot = await uploadBytes(storageRef, submissionFile);
        attachmentUrl = await getDownloadURL(snapshot.ref);
      }
      
      const submissionData = {
        homeworkId: selectedHomework.id,
        studentId: selectedChildId,
        submissionText: submissionText.trim(),
        attachmentUrl,
        submittedAt: new Date(),
        status: 'submitted'
      };
      
      await addDoc(collection(db, 'homework-submissions'), submissionData);
      
      setShowSubmissionModal(false);
      setSubmissionText('');
      setSubmissionFile(null);
      
      // Update homework status locally
      setHomework(prev => prev.map(hw => 
        hw.id === selectedHomework.id 
          ? { ...hw, status: 'completed' as const }
          : hw
      ));
      
    } catch (err) {
      console.error('Error submitting homework:', err);
      setError('Errore nell\'invio del compito');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFileNameFromUrl = (url: string): string => {
    try {
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      return decodeURIComponent(fileName.split('?')[0]);
    } catch {
      return 'File allegato';
    }
  };

  const handleDownloadAttachment = (url: string) => {
    window.open(url, '_blank');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-700';
      case 'late':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completato';
      case 'late':
        return 'In ritardo';
      default:
        return 'In sospeso';
    }
  };

  const selectedChild = children.find(child => child.id === selectedChildId);
  const pendingHomework = homework.filter(hw => hw.status === 'pending');
  const completedHomework = homework.filter(hw => hw.status === 'completed');
  const lateHomework = homework.filter(hw => hw.status === 'late');

  if (loading) {
    return (
      <PageContainer title="Caricamento..." description="Compiti">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Compiti"
      description={selectedChild ? `Compiti di ${selectedChild.firstName} ${selectedChild.lastName}` : "Gestione Compiti"}
    >
      {/* Child Selector */}
      <div className="mb-6">
        <label htmlFor="child-select" className="block text-sm font-medium text-slate-700 mb-2">
          Seleziona figlio
        </label>
        <select
          id="child-select"
          value={selectedChildId}
          onChange={handleChildChange}
          className="bg-white border border-slate-300 text-slate-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {children.map((child) => (
            <option key={child.id} value={child.id}>
              {child.firstName} {child.lastName}
            </option>
          ))}
        </select>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white"
        >
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-8 w-8" />
            <div>
              <h3 className="text-lg font-semibold">Totale</h3>
              <p className="text-blue-100 text-sm">Tutti i compiti</p>
            </div>
          </div>
          <div className="text-3xl font-bold">{homework.length}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white"
        >
          <div className="flex items-center gap-3 mb-4">
            <Clock className="h-8 w-8" />
            <div>
              <h3 className="text-lg font-semibold">In Sospeso</h3>
              <p className="text-amber-100 text-sm">Da completare</p>
            </div>
          </div>
          <div className="text-3xl font-bold">{pendingHomework.length}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white"
        >
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="h-8 w-8" />
            <div>
              <h3 className="text-lg font-semibold">Completati</h3>
              <p className="text-emerald-100 text-sm">Consegnati</p>
            </div>
          </div>
          <div className="text-3xl font-bold">{completedHomework.length}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white"
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="h-8 w-8" />
            <div>
              <h3 className="text-lg font-semibold">In Ritardo</h3>
              <p className="text-red-100 text-sm">Scaduti</p>
            </div>
          </div>
          <div className="text-3xl font-bold">{lateHomework.length}</div>
        </motion.div>
      </div>

      {/* Homework List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="bg-white rounded-2xl shadow-lg border border-slate-200"
      >
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Lista Compiti</h2>
          <p className="text-slate-600 mt-1">Gestisci i compiti di {selectedChild?.firstName}</p>
        </div>

        <div className="overflow-x-auto">
          {homework.length > 0 ? (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Scadenza
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Titolo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Materia
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Stato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {homework.map((hw, index) => (
                  <motion.tr
                    key={hw.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">
                        {formatDate(hw.dueDate)}
                      </div>
                      {hw.status === 'late' && (
                        <div className="text-xs text-red-600 font-medium">Scaduto</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900">{hw.title}</div>
                      <div className="text-sm text-slate-500 max-w-xs truncate">{hw.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">{hw.subject}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(hw.status)}`}>
                        {getStatusText(hw.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleHomeworkDetails(hw)}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Dettagli
                      </button>
                      {hw.status !== 'completed' && (
                        <button
                          onClick={() => handleHomeworkSubmission(hw)}
                          className="inline-flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          Consegna
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center">
              <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nessun compito trovato</h3>
              <p className="text-slate-500">
                {selectedChild ? 
                  `Non ci sono compiti disponibili per ${selectedChild.firstName}` :
                  'Seleziona un figlio per visualizzare i compiti'
                }
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Homework Details Modal */}
      {showDetailsModal && selectedHomework && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Dettagli Compito</h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titolo</label>
                <p className="text-gray-900 font-medium">{selectedHomework.title}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Materia</label>
                  <p className="text-gray-900">{selectedHomework.subject}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza</label>
                  <p className="text-gray-900">{formatDateTime(selectedHomework.dueDate)}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedHomework.status)}`}>
                  {getStatusText(selectedHomework.status)}
                </span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                <p className="text-gray-900 whitespace-pre-wrap">{selectedHomework.description || 'Nessuna descrizione disponibile'}</p>
              </div>
              
              {selectedHomework.attachmentUrls && selectedHomework.attachmentUrls.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Allegati</label>
                  <div className="space-y-2">
                    {selectedHomework.attachmentUrls.map((url, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-blue-500" />
                          <span className="text-sm font-medium text-gray-900">
                            {getFileNameFromUrl(url)}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDownloadAttachment(url)}
                          className="flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Scarica
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Homework Submission Modal */}
      {showSubmissionModal && selectedHomework && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Consegna Compito</h2>
                <button
                  onClick={() => setShowSubmissionModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6">
              <form onSubmit={(e) => { e.preventDefault(); handleSubmitHomework(); }} className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">{selectedHomework.title}</h3>
                  <p className="text-blue-800 text-sm mb-2">
                    <strong>Scadenza:</strong> {formatDateTime(selectedHomework.dueDate)}
                  </p>
                  <p className="text-blue-800 text-sm">
                    <strong>Materia:</strong> {selectedHomework.subject}
                  </p>
                </div>

                <div>
                  <label htmlFor="submissionText" className="block text-sm font-medium text-gray-700 mb-1">
                    Descrizione della consegna
                  </label>
                  <textarea
                    id="submissionText"
                    rows={4}
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                    placeholder="Descrivi il tuo lavoro, aggiungi note o commenti..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="submissionFile" className="block text-sm font-medium text-gray-700 mb-1">
                    File (opzionale)
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
                    <div className="space-y-1 text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="submissionFile"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                        >
                          <span>Carica un file</span>
                          <input
                            id="submissionFile"
                            name="submissionFile"
                            type="file"
                            className="sr-only"
                            onChange={handleFileUpload}
                            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                          />
                        </label>
                        <p className="pl-1">o trascina qui</p>
                      </div>
                      <p className="text-xs text-gray-500">PDF, DOCX, TXT, immagini fino a 10MB</p>
                      {submissionFile && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                          <p className="text-sm text-green-800">
                            <strong>File selezionato:</strong> {submissionFile.name}
                          </p>
                          <p className="text-xs text-green-600">
                            Dimensione: {(submissionFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowSubmissionModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center">
                        <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Invio in corso...
                      </div>
                    ) : (
                      'Consegna Compito'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </PageContainer>
  );
};

export default ParentHomework;
