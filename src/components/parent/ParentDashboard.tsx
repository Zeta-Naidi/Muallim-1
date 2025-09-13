import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, getDoc, doc, orderBy, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Users, BookOpen, Calendar, GraduationCap } from 'lucide-react';
import { PageContainer } from '../layout/PageContainer';
import { useAuth } from '../../context/AuthContext';

interface Lesson {
  id: string;
  title: string;
  date: any;
  topics: string[];
  teacherName: string;
  classId: string;
}

interface Homework {
  id: string;
  title: string;
  description: string;
  dueDate: any;
  status: 'pending' | 'completed' | 'late';
  subject: string;
  attachmentUrls?: string[];
}

interface ClassData {
  id: string;
  name: string;
  turno?: string;
}

interface ChildData {
  id: string;
  firstName: string;
  lastName: string;
  classData?: ClassData;
  recentLessons: Lesson[];
  recentHomework: Homework[];
}

const ParentDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'lessons' | 'homework' | 'grades'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleChildChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedChildId(event.target.value);
  };

  // Format date helper function
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

  // Initialize selected child when children change
  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  // Fetch children data
  useEffect(() => {
    const fetchChildrenData = async () => {
      if (!userProfile?.id) return;
      
      try {
        setLoading(true);
        const parentId = userProfile.id.trim();
        
        const childrenQuery = query(
          collection(db, 'students'),
          where('parentId', '==', parentId)
        );
        
        const childrenSnapshot = await getDocs(childrenQuery);
        
        if (childrenSnapshot.empty) {
          setChildren([]);
          return;
        }
        
        const childrenData: ChildData[] = [];
        
        for (const childDoc of childrenSnapshot.docs) {
          const childData = childDoc.data();
          const childId = childDoc.id;
          
          try {
            const studentClassId = childData.classId || childData.currentClass;
            
            const [lessons, homework] = await Promise.all([
              fetchChildLessons(childId, studentClassId),
              fetchChildHomework(childId, studentClassId)
            ]);
            
            let classDataInfo = undefined;
            if (studentClassId) {
              try {
                const classDocRef = doc(db, 'classes', studentClassId);
                const classDoc = await getDoc(classDocRef);
                
                if (classDoc.exists()) {
                  const classInfo = classDoc.data() as any;
                  classDataInfo = {
                    id: classDoc.id,
                    name: classInfo.name || classInfo.className || 'Classe Senza Nome',
                    turno: classInfo.turno || classInfo.shift || ''
                  };
                }
              } catch (classError) {
                console.warn('Error fetching class data:', classError);
              }
            }
            
            childrenData.push({
              id: childId,
              firstName: childData.firstName || 'Nome',
              lastName: childData.lastName || 'Cognome',
              classData: classDataInfo,
              recentLessons: lessons,
              recentHomework: homework
            });
          } catch (error) {
            console.error(`Error processing child ${childId}:`, error);
          }
        }
        
        setChildren(childrenData);
        
      } catch (err) {
        console.error('Error in fetchChildrenData:', err);
        setError('Errore nel caricamento dei dati');
      } finally {
        setLoading(false);
      }
    };
    
    fetchChildrenData();
  }, [userProfile]);

  // Fetch lessons for a specific child's class
  const fetchChildLessons = useCallback(async (_childId: string, classId?: string): Promise<Lesson[]> => {
    if (!classId) return [];
    
    try {
      const lessonsQuery = query(
        collection(db, 'lessons'),
        where('classId', '==', classId),
        orderBy('date', 'desc'),
        limit(3)
      );
      
      const lessonsSnapshot = await getDocs(lessonsQuery);
      return lessonsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || data.subject || 'Lezione',
          date: data.date,
          topics: data.topics || [],
          teacherName: data.teacherName || 'Insegnante',
          classId: data.classId
        } as Lesson;
      });
    } catch (err) {
      console.error('Error fetching lessons:', err);
      return [];
    }
  }, []);

  // Fetch homework for a specific child's class
  const fetchChildHomework = useCallback(async (childId: string, classId?: string): Promise<Homework[]> => {
    if (!classId) return [];
    
    try {
      const homeworkQuery = query(
        collection(db, 'homework'),
        where('classId', '==', classId),
        orderBy('dueDate', 'asc'),
        limit(10)
      );
      
      const homeworkSnapshot = await getDocs(homeworkQuery);
      
      if (homeworkSnapshot.empty) return [];
      
      const homeworkData = homeworkSnapshot.docs.map(doc => {
        const data = doc.data();
        
        let homeworkStatus = 'pending';
        if (data.dueDate) {
          const dueDate = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
          if (dueDate < new Date()) {
            homeworkStatus = 'late';
          }
        }
        
        return {
          id: doc.id,
          ...data,
          status: homeworkStatus,
          subject: data.className || 'Materia non specificata'
        } as Homework;
      });
      
      const activeHomework = homeworkData
        .filter(hw => hw.status !== 'completed')
        .sort((a, b) => {
          const dateA = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
          const dateB = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
          return dateA.getTime() - dateB.getTime();
        })
        .slice(0, 3);
      
      return activeHomework;
    } catch (err) {
      console.error('Error fetching homework:', err);
      return [];
    }
  }, []);

  if (loading) {
    return (
      <PageContainer title="Caricamento..." description="Genitore">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title="Errore" description="Genitore">
        <div className="text-center py-12">
          <p className="text-red-500">{error}</p>
        </div>
      </PageContainer>
    );
  }

  if (children.length === 0) {
    return (
      <PageContainer title="Nessun figlio trovato" description="Genitore">
        <div className="text-center py-12">
          <p className="text-gray-500">Nessun figlio trovato</p>
        </div>
      </PageContainer>
    );
  }

  const selectedChild = children.find(child => child.id === selectedChildId) || children[0];
  if (!selectedChild) return null;

  return (
    <PageContainer
      title={`Benvenuto, ${userProfile?.displayName || 'Genitore'}`}
      description="Genitore"
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
        <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="text-sm font-medium text-blue-700">Lezioni Recenti</div>
            </div>
            <div className="mt-4 text-3xl font-bold text-slate-900">{selectedChild.recentLessons.length}</div>
            <div className="mt-1 text-sm text-slate-500">Nelle classi</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="text-sm font-medium text-emerald-700">Compiti in Sospeso</div>
            </div>
            <div className="mt-4 text-3xl font-bold text-slate-900">{selectedChild.recentHomework.filter(hw => hw.status !== 'completed').length}</div>
            <div className="mt-1 text-sm text-slate-500">Da completare</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-sm font-medium text-amber-700">Classe Attiva</div>
            </div>
            <div className="mt-4 text-lg font-bold text-slate-900">
              {(selectedChild.classData?.name && selectedChild.classData?.turno)
                ? `${selectedChild.classData.name} ${selectedChild.classData.turno}`
                : 'Non assegnato'}
            </div>
            <div className="mt-1 text-sm text-slate-500">Classe corrente</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-purple-200 bg-white shadow-sm">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="text-sm font-medium text-purple-700">Voti Attivi</div>
            </div>
            <div className="mt-4 text-3xl font-bold text-slate-900">-</div>
            <div className="mt-1 text-sm text-slate-500">In sviluppo</div>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          onClick={() => navigate('/parent/lessons')}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:from-blue-600 hover:to-blue-700"
        >
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="h-6 w-6" />
            <h3 className="text-lg font-semibold">Le Mie Lezioni</h3>
          </div>
          <p className="text-blue-100 text-sm mb-4">Visualizza e monitora tutte le lezioni</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 }}
          onClick={() => navigate('/parent/homework')}
          className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl p-6 text-white cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:from-pink-600 hover:to-pink-700"
        >
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="h-6 w-6" />
            <h3 className="text-lg font-semibold">Compiti</h3>
          </div>
          <p className="text-pink-100 text-sm mb-4">Gestisci compiti e consegne</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.7 }}
          onClick={() => navigate('/parent/grades')}
          className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:from-orange-600 hover:to-orange-700"
        >
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="h-6 w-6" />
            <h3 className="text-lg font-semibold">Voti</h3>
          </div>
          <p className="text-orange-100 text-sm mb-4">Monitora progressi e valutazioni</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.8 }}
          onClick={() => setActiveTab('overview')}
          className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:from-emerald-600 hover:to-emerald-700"
        >
          <div className="flex items-center gap-3 mb-4">
            <Users className="h-6 w-6" />
            <h3 className="text-lg font-semibold">Panoramica</h3>
          </div>
          <p className="text-emerald-100 text-sm mb-4">Vista generale delle attività</p>
        </motion.div>
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/20 shadow-sm"
      >
        <div className="p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {activeTab === 'overview' && `Panoramica di ${selectedChild.firstName} ${selectedChild.lastName}`}
            {activeTab === 'lessons' && 'Lezioni'}
            {activeTab === 'homework' && 'Compiti'}
            {activeTab === 'grades' && 'Voti'}
          </h2>
          <p className="text-slate-600 mb-6">
            {activeTab === 'overview' && 'Monitora il progresso scolastico e le attività'}
            {activeTab === 'lessons' && 'Visualizza tutte le lezioni'}
            {activeTab === 'homework' && 'Gestisci i compiti assegnati'}
            {activeTab === 'grades' && 'Monitora i voti e le valutazioni'}
          </p>
          
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Lezioni Recenti</h3>
                  <p className="text-blue-700">{selectedChild.recentLessons.length} lezioni</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-4">
                  <h3 className="font-semibold text-emerald-900 mb-2">Compiti Attivi</h3>
                  <p className="text-emerald-700">{selectedChild.recentHomework.length} compiti</p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'lessons' && (
            <div className="space-y-4">
              {selectedChild.recentLessons.length > 0 ? (
                selectedChild.recentLessons.map((lesson) => (
                  <div key={lesson.id} className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold">{lesson.title}</h3>
                    <p className="text-sm text-gray-600">{formatDate(lesson.date)}</p>
                    <p className="text-sm">{lesson.topics.join(', ')}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">Nessuna lezione disponibile</p>
              )}
            </div>
          )}
          
          {activeTab === 'homework' && (
            <div className="space-y-4">
              {selectedChild.recentHomework.length > 0 ? (
                selectedChild.recentHomework.map((hw) => (
                  <div key={hw.id} className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold">{hw.title}</h3>
                    <p className="text-sm text-gray-600">Scadenza: {formatDate(hw.dueDate)}</p>
                    <p className="text-sm">{hw.description}</p>
                    <span className={`inline-block px-2 py-1 rounded text-xs ${
                      hw.status === 'completed' ? 'bg-green-100 text-green-800' :
                      hw.status === 'late' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {hw.status === 'completed' ? 'Completato' : 
                       hw.status === 'late' ? 'In ritardo' : 'In sospeso'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">Nessun compito disponibile</p>
              )}
            </div>
          )}
          
          {activeTab === 'grades' && (
            <div className="text-center py-8">
              <p className="text-gray-500">Funzionalità voti in sviluppo</p>
            </div>
          )}
        </div>
      </motion.div>
    </PageContainer>
  );
};

export default ParentDashboard;
