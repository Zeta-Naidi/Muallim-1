import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, Timestamp } from 'firebase/firestore';
import { Calendar, Plus, Edit, Trash2, Users, BookOpen, AlertCircle, CheckCircle, Filter, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { User, Class, ScheduledLesson } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

export const ManageScheduledLessons: React.FC = () => {
  const { userProfile } = useAuth();
  const [lessons, setLessons] = useState<ScheduledLesson[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState<ScheduledLesson | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    return startOfWeek.toISOString().split('T')[0];
  });

  // Form state
  const [formData, setFormData] = useState({
    teacherId: '',
    classId: '',
    date: '',
    startTime: '',
    endTime: '',
    subject: '',
    isRecurring: false,
    recurringPattern: 'weekly' as 'weekly' | 'biweekly' | 'monthly',
  });

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchData();
    }
  }, [userProfile]);

  useEffect(() => {
    if (selectedWeek) {
      fetchLessonsForWeek();
    }
  }, [selectedWeek, teachers, classes]);

  const fetchData = async () => {
    try {
      // Fetch teachers
      const teachersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'teacher')
      );
      const teachersSnapshot = await getDocs(teachersQuery);
      const teachersData = teachersSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as User[];

      // Fetch classes
      const classesQuery = collection(db, 'classes');
      const classesSnapshot = await getDocs(classesQuery);
      const classesData = classesSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Class[];

      setTeachers(teachersData);
      setClasses(classesData);
    } catch (error) {
      console.error('Errore nel recupero dei dati:', error);
      setMessage({ type: 'error', text: 'Errore nel recupero dei dati' });
    }
  };

  const fetchLessonsForWeek = async () => {
    if (!selectedWeek) return;

    setIsLoading(true);
    try {
      const weekStart = new Date(selectedWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59);

      const lessonsQuery = query(
        collection(db, 'scheduledLessons'),
        where('date', '>=', Timestamp.fromDate(weekStart)),
        where('date', '<=', Timestamp.fromDate(weekEnd)),
        orderBy('date'),
        orderBy('startTime')
      );

      const lessonsSnapshot = await getDocs(lessonsQuery);
      const lessonsData = lessonsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          date: data.date.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      }) as ScheduledLesson[];

      setLessons(lessonsData);
    } catch (error) {
      console.error('Errore nel recupero delle lezioni:', error);
      setMessage({ type: 'error', text: 'Errore nel recupero delle lezioni' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.teacherId || !formData.classId || !formData.date || !formData.startTime || !formData.endTime) {
      setMessage({ type: 'error', text: 'Compila tutti i campi obbligatori' });
      return;
    }

    const teacher = teachers.find(t => t.id === formData.teacherId);
    const classData = classes.find(c => c.id === formData.classId);

    if (!teacher || !classData) {
      setMessage({ type: 'error', text: 'Insegnante o classe non validi' });
      return;
    }

    try {
      const lessonData: Omit<ScheduledLesson, 'id'> = {
        teacherId: formData.teacherId,
        teacherName: teacher.displayName,
        classId: formData.classId,
        className: classData.name,
        date: new Date(formData.date),
        startTime: formData.startTime,
        endTime: formData.endTime,
        subject: formData.subject || undefined,
        isRecurring: formData.isRecurring,
        recurringPattern: formData.isRecurring ? formData.recurringPattern : undefined,
        status: 'scheduled',
        createdBy: userProfile!.id,
        createdAt: new Date(),
      };

      if (editingLesson) {
        await updateDoc(doc(db, 'scheduledLessons', editingLesson.id), {
          ...lessonData,
          date: Timestamp.fromDate(lessonData.date),
          createdAt: Timestamp.fromDate(lessonData.createdAt),
          updatedAt: Timestamp.fromDate(new Date()),
        });
        setMessage({ type: 'success', text: 'Lezione aggiornata con successo' });
      } else {
        await addDoc(collection(db, 'scheduledLessons'), {
          ...lessonData,
          date: Timestamp.fromDate(lessonData.date),
          createdAt: Timestamp.fromDate(lessonData.createdAt),
        });
        setMessage({ type: 'success', text: 'Lezione programmata con successo' });
      }

      resetForm();
      fetchLessonsForWeek();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Errore nel salvataggio:', error);
      setMessage({ type: 'error', text: 'Errore nel salvataggio della lezione' });
    }
  };

  const handleEdit = (lesson: ScheduledLesson) => {
    setEditingLesson(lesson);
    setFormData({
      teacherId: lesson.teacherId,
      classId: lesson.classId,
      date: lesson.date.toISOString().split('T')[0],
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      subject: lesson.subject || '',
      isRecurring: lesson.isRecurring || false,
      recurringPattern: lesson.recurringPattern || 'weekly',
    });
    setShowAddForm(true);
  };

  const handleDelete = async (lessonId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa lezione?')) return;

    try {
      await deleteDoc(doc(db, 'scheduledLessons', lessonId));
      setMessage({ type: 'success', text: 'Lezione eliminata con successo' });
      fetchLessonsForWeek();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Errore nell\'eliminazione:', error);
      setMessage({ type: 'error', text: 'Errore nell\'eliminazione della lezione' });
    }
  };

  const resetForm = () => {
    setFormData({
      teacherId: '',
      classId: '',
      date: '',
      startTime: '',
      endTime: '',
      subject: '',
      isRecurring: false,
      recurringPattern: 'weekly',
    });
    setEditingLesson(null);
    setShowAddForm(false);
  };

  const filteredLessons = lessons.filter(lesson => {
    const matchesSearch = lesson.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         lesson.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (lesson.subject && lesson.subject.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTeacher = !filterTeacher || lesson.teacherId === filterTeacher;
    const matchesClass = !filterClass || lesson.classId === filterClass;
    
    return matchesSearch && matchesTeacher && matchesClass;
  });

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-8 text-center max-w-md mx-auto">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-2xl font-light text-gray-900 mb-2">Accesso non autorizzato</h3>
          <p className="text-gray-600">Solo gli amministratori possono accedere a questa pagina.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-700 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-white/5" />
        
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
                  <Calendar className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Gestione Lezioni Programmate</h1>
                  <p className="text-indigo-100 mt-1">Programma e gestisci le lezioni per il sistema di check-in</p>
                </div>
              </div>
              <Button
                onClick={() => setShowAddForm(true)}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Nuova Lezione
              </Button>
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

        {/* Filters */}
        <Card className="mb-6 bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtri e Controlli
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Settimana</label>
                <input
                  type="date"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <Input
                  label="Cerca"
                  placeholder="Insegnante, classe, materia..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                  fullWidth
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filtra per Insegnante</label>
                <select
                  value={filterTeacher}
                  onChange={(e) => setFilterTeacher(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tutti gli insegnanti</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>{teacher.displayName}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filtra per Classe</label>
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tutte le classi</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add/Edit Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="mb-6 bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl">
                <CardHeader>
                  <CardTitle>
                    {editingLesson ? 'Modifica Lezione' : 'Nuova Lezione Programmata'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Insegnante *</label>
                        <select
                          value={formData.teacherId}
                          onChange={(e) => setFormData(prev => ({ ...prev, teacherId: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Seleziona insegnante</option>
                          {teachers.map(teacher => (
                            <option key={teacher.id} value={teacher.id}>{teacher.displayName}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Classe *</label>
                        <select
                          value={formData.classId}
                          onChange={(e) => setFormData(prev => ({ ...prev, classId: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Seleziona classe</option>
                          {classes.map(cls => (
                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                        <input
                          type="date"
                          value={formData.date}
                          onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Materia</label>
                        <input
                          type="text"
                          value={formData.subject}
                          onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                          placeholder="Es. Matematica, Italiano..."
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ora Inizio *</label>
                        <input
                          type="time"
                          value={formData.startTime}
                          onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ora Fine *</label>
                        <input
                          type="time"
                          value={formData.endTime}
                          onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isRecurring}
                          onChange={(e) => setFormData(prev => ({ ...prev, isRecurring: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Lezione ricorrente</span>
                      </label>
                      
                      {formData.isRecurring && (
                        <select
                          value={formData.recurringPattern}
                          onChange={(e) => setFormData(prev => ({ ...prev, recurringPattern: e.target.value as any }))}
                          className="px-3 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="weekly">Settimanale</option>
                          <option value="biweekly">Bisettimanale</option>
                          <option value="monthly">Mensile</option>
                        </select>
                      )}
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                        {editingLesson ? 'Aggiorna Lezione' : 'Programma Lezione'}
                      </Button>
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Annulla
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lessons List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-light">Caricamento lezioni...</p>
          </div>
        ) : filteredLessons.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl">
            <CardContent className="p-12 text-center">
              <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessuna lezione programmata</h3>
              <p className="text-gray-600">Non ci sono lezioni programmate per questa settimana.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Lezioni Programmate ({filteredLessons.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Data e Ora</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Insegnante</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Classe</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Materia</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Stato</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredLessons.map((lesson) => (
                      <motion.tr
                        key={lesson.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-blue-50/30 transition-all duration-200"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="font-medium text-gray-900">
                                {lesson.date.toLocaleDateString('it-IT')}
                              </div>
                              <div className="text-sm text-gray-500">
                                {lesson.startTime} - {lesson.endTime}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-900">{lesson.teacherName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">{lesson.className}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">{lesson.subject || '-'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            lesson.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                            lesson.status === 'completed' ? 'bg-green-100 text-green-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {lesson.status === 'scheduled' ? 'Programmata' :
                             lesson.status === 'completed' ? 'Completata' : 'Cancellata'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(lesson)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              leftIcon={<Edit className="h-4 w-4" />}
                            >
                              Modifica
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(lesson.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              leftIcon={<Trash2 className="h-4 w-4" />}
                            >
                              Elimina
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
