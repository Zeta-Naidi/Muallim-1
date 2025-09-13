import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { BookOpen, Calendar, User, ArrowLeft, Eye } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { useAuth } from '../../context/AuthContext';

interface Lesson {
  id: string;
  title: string;
  date: any;
  topics: string[];
  teacherName: string;
  classId: string;
  description?: string;
  duration?: number;
}

interface ChildData {
  id: string;
  firstName: string;
  lastName: string;
  classId?: string;
}

const ParentLessons: React.FC = () => {
  const { userProfile } = useAuth();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [showModal, setShowModal] = useState(false);
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

  const formatTime = useCallback((date: any): string => {
    try {
      if (!date) return '';
      
      if (date.toDate) {
        date = date.toDate();
      }
      
      if (typeof date === 'string' || typeof date === 'number') {
        date = new Date(date);
      }
      
      if (!(date instanceof Date) || isNaN(date.getTime())) {
        return '';
      }
      
      return format(date, 'HH:mm', { locale: it });
    } catch (error) {
      return '';
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

  // Fetch lessons for selected child
  useEffect(() => {
    const fetchLessons = async () => {
      if (!selectedChildId) return;
      
      const selectedChild = children.find(child => child.id === selectedChildId);
      if (!selectedChild?.classId) {
        setLessons([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const lessonsQuery = query(
          collection(db, 'lessons'),
          where('classId', '==', selectedChild.classId),
          orderBy('date', 'desc')
        );
        
        const lessonsSnapshot = await getDocs(lessonsQuery);
        const lessonsData: Lesson[] = lessonsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || data.subject || 'Lezione',
            date: data.date,
            topics: data.topics || [],
            teacherName: data.teacherName || 'Insegnante',
            classId: data.classId,
            description: data.description || '',
            duration: data.duration || 60
          };
        });
        
        setLessons(lessonsData);
      } catch (err) {
        console.error('Error fetching lessons:', err);
        setError('Errore nel caricamento delle lezioni');
      } finally {
        setLoading(false);
      }
    };
    
    fetchLessons();
  }, [selectedChildId, children]);

  const handleChildChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedChildId(event.target.value);
  };

  const handleLessonDetails = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setShowModal(true);
  };

  const selectedChild = children.find(child => child.id === selectedChildId);

  if (loading) {
    return (
      <PageContainer title="Caricamento..." description="Lezioni">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Lezioni"
      description={selectedChild ? `Lezioni di ${selectedChild.firstName} ${selectedChild.lastName}` : "Gestione Lezioni"}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white"
        >
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="h-8 w-8" />
            <div>
              <h3 className="text-lg font-semibold">Totale Lezioni</h3>
              <p className="text-blue-100 text-sm">Tutte le lezioni</p>
            </div>
          </div>
          <div className="text-3xl font-bold">{lessons.length}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white"
        >
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="h-8 w-8" />
            <div>
              <h3 className="text-lg font-semibold">Questo Mese</h3>
              <p className="text-emerald-100 text-sm">Lezioni recenti</p>
            </div>
          </div>
          <div className="text-3xl font-bold">
            {lessons.filter(lesson => {
              const lessonDate = lesson.date?.toDate ? lesson.date.toDate() : new Date(lesson.date);
              const now = new Date();
              return lessonDate.getMonth() === now.getMonth() && lessonDate.getFullYear() === now.getFullYear();
            }).length}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white"
        >
          <div className="flex items-center gap-3 mb-4">
            <User className="h-8 w-8" />
            <div>
              <h3 className="text-lg font-semibold">Insegnanti</h3>
              <p className="text-purple-100 text-sm">Diversi docenti</p>
            </div>
          </div>
          <div className="text-3xl font-bold">
            {new Set(lessons.map(lesson => lesson.teacherName)).size}
          </div>
        </motion.div>
      </div>

      {/* Lessons List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="bg-white rounded-2xl shadow-lg border border-slate-200"
      >
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Cronologia Lezioni</h2>
          <p className="text-slate-600 mt-1">Visualizza tutte le lezioni di {selectedChild?.firstName}</p>
        </div>

        <div className="overflow-x-auto">
          {lessons.length > 0 ? (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Materia
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Argomenti
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Insegnante
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {lessons.map((lesson, index) => (
                  <motion.tr
                    key={lesson.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">
                        {formatDate(lesson.date)}
                      </div>
                      <div className="text-sm text-slate-500">
                        {formatTime(lesson.date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{lesson.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900 max-w-xs">
                        {lesson.topics.length > 0 ? lesson.topics.join(', ') : 'Nessun argomento specificato'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">{lesson.teacherName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleLessonDetails(lesson)}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Dettagli
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center">
              <BookOpen className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nessuna lezione trovata</h3>
              <p className="text-slate-500">
                {selectedChild ? 
                  `Non ci sono lezioni disponibili per ${selectedChild.firstName}` :
                  'Seleziona un figlio per visualizzare le lezioni'
                }
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Lesson Details Modal */}
      {showModal && selectedLesson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Dettagli Lezione</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <p className="text-gray-900 font-medium">{formatDate(selectedLesson.date)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orario</label>
                  <p className="text-gray-900 font-medium">{formatTime(selectedLesson.date)}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Materia</label>
                <p className="text-gray-900 font-medium">{selectedLesson.title}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insegnante</label>
                <p className="text-gray-900">{selectedLesson.teacherName}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Argomenti Trattati</label>
                {selectedLesson.topics && selectedLesson.topics.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-gray-900">
                    {selectedLesson.topics.map((topic, index) => (
                      <li key={index}>{topic}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 italic">Nessun argomento specificato</p>
                )}
              </div>
              
              {selectedLesson.description && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedLesson.description}</p>
                </div>
              )}
              
              {selectedLesson.duration && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durata</label>
                  <p className="text-gray-900">{selectedLesson.duration} minuti</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </PageContainer>
  );
};

export default ParentLessons;
