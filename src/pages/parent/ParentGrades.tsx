import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  TrendingUp, 
  Award, 
  Calendar,
  ChevronDown,
  Eye,
  X,
  User,
  GraduationCap,
  Star
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface ChildData {
  id: string;
  firstName: string;
  lastName: string;
  currentClass: string;
  classData?: {
    name: string;
    turno: string;
    teacherName: string;
    description: string;
  };
}

interface Grade {
  id: string;
  studentId: string;
  subject: string;
  grade: number;
  maxGrade: number;
  description: string;
  date: Date;
  teacherId: string;
  teacherName: string;
  type: 'test' | 'homework' | 'participation' | 'project';
  semester: 'first' | 'second';
}

const ParentGrades: React.FC = () => {
  const { currentUser } = useAuth();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [showGradeModal, setShowGradeModal] = useState(false);

  useEffect(() => {
    if (currentUser?.uid) {
      fetchChildrenData();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedChildId) {
      fetchChildGrades();
    }
  }, [selectedChildId]);

  const fetchChildrenData = async () => {
    try {
      setLoading(true);
      const childrenQuery = query(
        collection(db, 'students'),
        where('parentId', '==', currentUser?.uid)
      );
      
      const childrenSnapshot = await getDocs(childrenQuery);
      const childrenData: ChildData[] = [];

      for (const childDoc of childrenSnapshot.docs) {
        const data = childDoc.data();
        const childData: ChildData = {
          id: childDoc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          currentClass: data.currentClass || data.classId || '',
        };

        // Fetch class data
        if (childData.currentClass) {
          try {
            const classDoc = await getDoc(doc(db, 'classes', childData.currentClass));
            if (classDoc.exists()) {
              const classData = classDoc.data();
              childData.classData = {
                name: classData.name || '',
                turno: classData.turno || '',
                teacherName: classData.teacherName || '',
                description: classData.description || ''
              };
            }
          } catch (classError) {
            console.error('Error fetching class data:', classError);
          }
        }

        childrenData.push(childData);
      }

      setChildren(childrenData);
      if (childrenData.length > 0 && !selectedChildId) {
        setSelectedChildId(childrenData[0].id);
      }
    } catch (error) {
      console.error('Error fetching children:', error);
      setError('Errore nel caricamento dei dati dei figli');
    } finally {
      setLoading(false);
    }
  };

  const fetchChildGrades = async () => {
    if (!selectedChildId) return;

    try {
      setLoading(true);
      const gradesQuery = query(
        collection(db, 'grades'),
        where('studentId', '==', selectedChildId),
        orderBy('date', 'desc')
      );

      const gradesSnapshot = await getDocs(gradesQuery);
      const gradesData: Grade[] = gradesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date()
      })) as Grade[];

      setGrades(gradesData);
    } catch (error) {
      console.error('Error fetching grades:', error);
      setError('Errore nel caricamento dei voti');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    if (grades.length === 0) {
      return {
        totalGrades: 0,
        averageGrade: 0,
        highestGrade: 0,
        subjectCount: 0
      };
    }

    const total = grades.reduce((sum, grade) => sum + (grade.grade / grade.maxGrade) * 10, 0);
    const average = total / grades.length;
    const highest = Math.max(...grades.map(g => (g.grade / g.maxGrade) * 10));
    const subjects = new Set(grades.map(g => g.subject)).size;

    return {
      totalGrades: grades.length,
      averageGrade: Math.round(average * 10) / 10,
      highestGrade: Math.round(highest * 10) / 10,
      subjectCount: subjects
    };
  };

  const getGradeColor = (grade: number, maxGrade: number) => {
    const percentage = (grade / maxGrade) * 100;
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 80) return 'text-blue-600';
    if (percentage >= 70) return 'text-yellow-600';
    if (percentage >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getGradeBadgeColor = (grade: number, maxGrade: number) => {
    const percentage = (grade / maxGrade) * 100;
    if (percentage >= 90) return 'bg-green-100 text-green-800';
    if (percentage >= 80) return 'bg-blue-100 text-blue-800';
    if (percentage >= 70) return 'bg-yellow-100 text-yellow-800';
    if (percentage >= 60) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'test': return <BookOpen className="w-4 h-4" />;
      case 'homework': return <GraduationCap className="w-4 h-4" />;
      case 'participation': return <User className="w-4 h-4" />;
      case 'project': return <Star className="w-4 h-4" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'test': return 'Verifica';
      case 'homework': return 'Compito';
      case 'participation': return 'Partecipazione';
      case 'project': return 'Progetto';
      default: return 'Altro';
    }
  };

  const selectedChild = children.find(child => child.id === selectedChildId);
  const stats = calculateStats();

  if (loading && children.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento voti...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Voti</h1>
              <p className="text-gray-600">Visualizza i voti e le valutazioni</p>
            </div>
            
            {/* Child Selector */}
            {children.length > 0 && (
              <div className="relative">
                <select
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
                >
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.firstName} {child.lastName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedChild && (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Voti Totali</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalGrades}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Media</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.averageGrade}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Award className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Voto Migliore</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.highestGrade}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <GraduationCap className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Materie</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.subjectCount}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Grades List */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-xl shadow-sm border border-gray-100"
            >
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Elenco Voti</h2>
                <p className="text-sm text-gray-600">
                  {selectedChild.firstName} {selectedChild.lastName} - {selectedChild.classData?.name}
                </p>
              </div>

              <div className="overflow-x-auto">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Caricamento voti...</p>
                  </div>
                ) : grades.length === 0 ? (
                  <div className="p-8 text-center">
                    <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Nessun voto disponibile</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Data
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Materia
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Voto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Descrizione
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Azioni
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {grades.map((grade) => (
                        <tr key={grade.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                              {format(grade.date, 'dd MMM yyyy', { locale: it })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {grade.subject}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {getTypeIcon(grade.type)}
                              <span className="ml-2 text-sm text-gray-600">
                                {getTypeLabel(grade.type)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getGradeBadgeColor(grade.grade, grade.maxGrade)}`}>
                              {grade.grade}/{grade.maxGrade}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {grade.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => {
                                setSelectedGrade(grade);
                                setShowGradeModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-900 flex items-center"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Visualizza
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* Grade Details Modal */}
      {showGradeModal && selectedGrade && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Dettagli Voto</h3>
                <button
                  onClick={() => setShowGradeModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Materia
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                    {selectedGrade.subject}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo di Valutazione
                  </label>
                  <div className="flex items-center bg-gray-50 p-3 rounded-lg">
                    {getTypeIcon(selectedGrade.type)}
                    <span className="ml-2 text-sm text-gray-900">
                      {getTypeLabel(selectedGrade.type)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Voto
                  </label>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className={`text-2xl font-bold ${getGradeColor(selectedGrade.grade, selectedGrade.maxGrade)}`}>
                      {selectedGrade.grade}/{selectedGrade.maxGrade}
                    </span>
                    <span className="ml-2 text-sm text-gray-600">
                      ({Math.round((selectedGrade.grade / selectedGrade.maxGrade) * 100)}%)
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                    {format(selectedGrade.date, 'dd MMMM yyyy', { locale: it })}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Insegnante
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                    {selectedGrade.teacherName}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Semestre
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                    {selectedGrade.semester === 'first' ? 'Primo Semestre' : 'Secondo Semestre'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrizione
                </label>
                <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                  {selectedGrade.description || 'Nessuna descrizione disponibile'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ParentGrades;
