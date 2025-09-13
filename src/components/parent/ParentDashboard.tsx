import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, getDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Users, BookOpen, Calendar, GraduationCap } from 'lucide-react';

interface Lesson {
  id: string;
  date: Date | string | number;
  topics: string[];
  title: string;
  teacherName?: string;
}

interface Homework {
  id: string;
  title: string;
  dueDate: Date | string | number;
  description: string;
  status: 'completed' | 'pending' | 'late' | 'active'; // Added 'active' from DB
  subject?: string;
  classId?: string;
  createdBy?: string;
  createdAt?: Date | string | number;
  attachmentUrls?: string[]; // Firebase structure
  teacherName?: string;
}

interface ChildData {
  id: string;
  firstName: string;
  lastName: string;
  classId?: string;
  classData?: {
    id: string;
    name: string;
    turno?: string;
    teacherName?: string;
    description: string;
  };
  recentLessons: Lesson[];
  recentHomework: Homework[];
}

const ParentDashboard: React.FC = () => {
  // State hooks at the top level
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'lessons' | 'homework' | 'grades'>('overview');
  const { userProfile } = useAuth();
  const [children, setChildren] = useState<ChildData[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [showHomeworkModal, setShowHomeworkModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Format date helper function
  // Handler functions for modals
  const handleLessonDetails = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setShowLessonModal(true);
  };

  const handleHomeworkDetails = (homework: Homework) => {
    setSelectedHomework(homework);
    setShowHomeworkModal(true);
  };

  const handleHomeworkSubmission = (homework: Homework) => {
    setSelectedHomework(homework);
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
    if (!selectedHomework || !selectedChild) return;
    
    setIsSubmitting(true);
    try {
      // Create submission data
      const submissionData = {
        homeworkId: selectedHomework.id,
        studentId: selectedChild.id,
        submissionText: submissionText.trim(),
        submittedAt: new Date(),
        status: 'submitted',
        fileName: submissionFile?.name || null,
        fileSize: submissionFile?.size || null,
        fileType: submissionFile?.type || null
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Close modal and reset form
      setShowSubmissionModal(false);
      setSubmissionText('');
      setSubmissionFile(null);
      
      // Show success message (you could add a toast notification here)
      alert('Compito consegnato con successo!');
      
    } catch (error) {
      console.error('Error submitting homework:', error);
      alert('Errore durante la consegna del compito. Riprova.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadAttachment = async (attachmentUrl: string) => {
    try {
      
      // Extract filename from Firebase Storage URL
      const fileName = getFileNameFromUrl(attachmentUrl);
      
      // Create a temporary link element and trigger download
      const link = document.createElement('a');
      link.href = attachmentUrl;
      link.download = fileName;
      link.target = '_blank';
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error downloading attachment:', error);
      alert('Errore durante il download del file. Riprova.');
    }
  };

  const getFileNameFromUrl = (url: string): string => {
    try {
      // Extract filename from Firebase Storage URL
      const urlParts = url.split('/');
      const filenamePart = urlParts[urlParts.length - 1];
      
      // Remove query parameters and decode
      const filename = decodeURIComponent(filenamePart.split('?')[0]);
      
      // Extract actual filename after the path
      const actualFilename = filename.split('%2F').pop() || filename;
      
      return actualFilename || 'allegato';
    } catch (error) {
      console.error('Error extracting filename:', error);
      return 'allegato';
    }
  };

  const getFileTypeFromUrl = (url: string): string => {
    const filename = getFileNameFromUrl(url);
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      return 'image';
    } else if (extension === 'pdf') {
      return 'pdf';
    } else {
      return 'document';
    }
  };

  const formatDate = useCallback((date: any): string => {
    try {
      if (!date) return 'Data non specificata';
      
      // Handle Firestore Timestamp
      if (date.toDate) {
        date = date.toDate();
      }
      
      // Handle string or number dates
      if (typeof date === 'string' || typeof date === 'number') {
        date = new Date(date);
      }
      
      // Validate the date
      if (!(date instanceof Date) || isNaN(date.getTime())) {
        console.warn('Data non valida:', date);
        return 'Data non valida';
      }
      
      return format(date, 'd MMMM yyyy', { locale: it });
    } catch (error) {
      console.error('Errore nella formattazione della data:', error, 'Valore:', date);
      return 'Data non valida';
    }
  }, []);
  
  // Initialize selected child when children change
  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  useEffect(() => {
    const fetchChildrenData = async () => {
      if (!userProfile?.id) return;
      
      try {
        setLoading(true);
        const parentId = userProfile.id.trim(); // Rimuovi eventuali spazi
        
        // Cerca nella collection 'students' invece di 'users'
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
        
        // Process each child
        for (const childDoc of childrenSnapshot.docs) {
          const childData = childDoc.data();
          const childId = childDoc.id;
          
          try {
            // Check for classId in different possible fields
            const studentClassId = childData.classId || childData.currentClass;
            
            // Fetch recent lessons and homework for each child
            const [lessons, homework] = await Promise.all([
              fetchChildLessons(childId, studentClassId),
              fetchChildHomework(childId, studentClassId)
            ]);
            
            // Fetch class data if classId exists
            let classDataInfo = undefined;
            if (studentClassId) {
              try {
                const classDocRef = doc(db, 'classes', studentClassId);
                
                // Add timeout to the getDoc call
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000);
                });
                
                const classDoc = await Promise.race([
                  getDoc(classDocRef),
                  timeoutPromise
                ]) as any;
                
                if (classDoc.exists()) {
                  const classInfo = classDoc.data() as any;
                  
                  classDataInfo = {
                    id: classDoc.id,
                    name: classInfo.name || classInfo.className || 'Classe Senza Nome',
                    turno: classInfo.turno || classInfo.shift || 'Non specificato',
                    teacherName: classInfo.teacherName || classInfo.teacher || 'Insegnante non specificato',
                    description: classInfo.description || ''
                  };
                } else {
                  console.warn(`Class document ${studentClassId} does not exist`);
                }
              } catch (classError: any) {
                console.error('Error fetching class data:', classError);
                console.error('Error details:', {
                  message: classError?.message || 'Unknown error',
                  code: classError?.code || 'No code',
                  stack: classError?.stack || 'No stack trace'
                });
              }
            } else {
              console.log('No studentClassId available, skipping class data fetch');
            }

            childrenData.push({
              id: childId,
              firstName: childData.firstName || 'Figlio',
              lastName: childData.lastName || 'Senza Nome',
              classId: studentClassId,
              classData: classDataInfo,
              recentLessons: lessons,
              recentHomework: homework
            });
          } catch (err) {
            console.error(`Error processing child ${childId}:`, err);
            // Continue with other children even if one fails
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

  // Set initial selected child
  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

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
          ...data,
          date: data.date?.toDate?.() || data.date,
          title: data.title || 'Lezione senza titolo',
          topics: data.topics || []
        } as Lesson;
      });
    } catch (err) {
      console.error('Error fetching lessons:', err);
      return [];
    }
  }, []);

  // Fetch homework for a specific child's class
  const fetchChildHomework = useCallback(async (childId: string, classId?: string): Promise<Homework[]> => {
    
    if (!classId) {
      return [];
    }
    
    try {
      // First, fetch homework for the class
      const homeworkQuery = query(
        collection(db, 'homework'),
        where('classId', '==', classId),
        orderBy('dueDate', 'asc'),
        limit(10) // Increased limit to get more homework
      );
      
      const homeworkSnapshot = await getDocs(homeworkQuery);
      
      if (homeworkSnapshot.empty) {
        return [];
      }
      
      // Try to fetch submissions for this student (may fail due to permissions)
      let submissionsMap = new Map();
      try {
        const submissionsQuery = query(
          collection(db, 'homeworkSubmissions'),
          where('studentId', '==', childId)
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);
        
        // Create a map of homework submissions by homeworkId
        submissionsSnapshot.docs.forEach(doc => {
          const submission = doc.data();
          submissionsMap.set(submission.homeworkId, submission);
        });
      } catch (submissionError) {
        console.warn('Could not fetch submissions (permissions issue):', submissionError);
      }
      
      const homeworkData = homeworkSnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Check if student has submitted this homework
        const submission = submissionsMap.get(doc.id);
        let homeworkStatus = 'pending';
        
        if (submission) {
          homeworkStatus = submission.status === 'graded' ? 'completed' : 'completed';
        } else {
          // Check if homework is overdue
          const dueDate = data.dueDate?.toDate?.() || new Date(data.dueDate);
          if (dueDate < new Date()) {
            homeworkStatus = 'late';
          }
        }
        
        
        return {
          id: doc.id,
          ...data,
          dueDate: data.dueDate?.toDate?.() || data.dueDate,
          status: homeworkStatus,
          title: data.title || 'Compito senza titolo',
          description: data.description || '',
          subject: data.className || 'Materia non specificata'
        } as Homework;
      });
      
      // Filter to show only active homework (not completed by admin) and sort by due date
      const activeHomework = homeworkData
        .filter(hw => hw.status !== 'completed') // Only show active homework from teacher perspective
        .sort((a, b) => {
          const dateA = new Date(a.dueDate);
          const dateB = new Date(b.dueDate);
          return dateA.getTime() - dateB.getTime();
        })
        .slice(0, 3); // Take only the 3 most recent
      
      return activeHomework;
    } catch (err) {
      console.error('Error fetching homework:', err);
      return [];
    }
  }, []);

  // Handle child selection change
  const handleChildChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedChildId(e.target.value);
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No children found
  if (children.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Nessun figlio trovato</p>
      </div>
    );
  }

  const selectedChild = children.find(child => child.id === selectedChildId) || children[0];
  if (!selectedChild) return null;

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="p-6">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Panoramica di {selectedChild.firstName} {selectedChild.lastName}
              </h2>
              <p className="text-slate-600">Monitora il progresso scolastico e le attività</p>
            </div>
            
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* Upcoming Lessons Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-600">Lezioni Recenti</h3>
                    <div className="text-2xl font-bold text-slate-900">
                      {selectedChild.recentLessons.length}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('lessons')}
                  className="w-full text-left text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Visualizza tutte le lezioni →
                </button>
              </motion.div>

              {/* Pending Homework Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 bg-amber-100 rounded-xl flex items-center justify-center">
                    <GraduationCap className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-600">Compiti in Sospeso</h3>
                    <div className="text-2xl font-bold text-slate-900">
                      {selectedChild.recentHomework.filter(hw => hw.status !== 'completed').length}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('homework')}
                  className="w-full text-left text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors"
                >
                  Visualizza tutti i compiti →
                </button>
              </motion.div>

              {/* Class Info Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-600">Classe</h3>
                    <div className="text-lg font-bold text-slate-900">
                    {(selectedChild.classData?.name && selectedChild.classData?.turno)
                      ? `${selectedChild.classData.name} ${selectedChild.classData.turno}`
                      : 'Non assegnato'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('grades')}
                  className="w-full text-left text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                >
                  Visualizza voti →
                </button>
              </motion.div>
            </div>

            {/* Recent Lessons Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Lezioni Recenti</h3>
                <button
                  onClick={() => setActiveTab('lessons')}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Visualizza tutto →
                </button>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-slate-900">Data</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Materia</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Argomento</th>
                        <th scope="col" className="relative py-3.5 pl-3 pr-6">
                          <span className="sr-only">Dettagli</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {selectedChild.recentLessons.length > 0 ? (
                        selectedChild.recentLessons.map((lesson: Lesson) => (
                          <tr key={lesson.id} className="hover:bg-slate-50 transition-colors">
                            <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-slate-900">
                              {formatDate(lesson.date)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                              {lesson.title || 'Nessuna materia'}
                            </td>
                            <td className="px-3 py-4 text-sm text-slate-600">
                              <div className="max-w-xs truncate">
                                {lesson.topics?.join(', ') || 'Nessun argomento'}
                              </div>
                            </td>
                            <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                              <button 
                                onClick={() => handleLessonDetails(lesson)}
                                className="text-blue-600 hover:text-blue-700 transition-colors"
                              >
                                Dettagli
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                            <div className="flex flex-col items-center">
                              <BookOpen className="h-8 w-8 text-slate-300 mb-2" />
                              <span>Nessuna lezione recente</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Recent Homework Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Compiti Recenti</h3>
                <button
                  onClick={() => setActiveTab('homework')}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Visualizza tutto →
                </button>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-slate-900">Scadenza</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Materia</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Titolo</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Stato</th>
                        <th scope="col" className="relative py-3.5 pl-3 pr-6">
                          <span className="sr-only">Azioni</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {selectedChild.recentHomework.length > 0 ? (
                        selectedChild.recentHomework.map((hw: Homework) => (
                          <tr key={hw.id} className="hover:bg-slate-50 transition-colors">
                            <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-slate-900">
                              <div className="flex items-center gap-2">
                                {formatDate(hw.dueDate)}
                                {new Date(hw.dueDate) < new Date() && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                    Scaduto
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                              {hw.subject || 'Nessuna materia'}
                            </td>
                            <td className="px-3 py-4 text-sm text-slate-600">
                              <div className="flex items-center space-x-2">
                                <div className="max-w-xs truncate font-medium">
                                  {hw.title}
                                </div>
                                {hw.attachmentUrls && hw.attachmentUrls.length > 0 && (
                                  <div className="flex items-center">
                                    <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    <span className="text-xs text-blue-600 ml-1">
                                      {hw.attachmentUrls.length}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                hw.status === 'completed' 
                                  ? 'bg-emerald-100 text-emerald-700' 
                                  : hw.status === 'late' 
                                    ? 'bg-red-100 text-red-700' 
                                    : 'bg-amber-100 text-amber-700'
                              }`}>
                                {hw.status === 'completed' ? 'Completato' : hw.status === 'late' ? 'In ritardo' : 'In sospeso'}
                              </span>
                            </td>
                            <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                              <button 
                                onClick={() => handleHomeworkDetails(hw)}
                                className="text-blue-600 hover:text-blue-700 transition-colors"
                              >
                                Dettagli
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                            <div className="flex flex-col items-center">
                              <GraduationCap className="h-8 w-8 text-slate-300 mb-2" />
                              <span>Nessun compito recente</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'lessons':
        return (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Tutte le Lezioni</h2>
              <p className="text-slate-600">Cronologia completa delle lezioni di {selectedChild.firstName}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-slate-900">Data</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Materia</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Argomento</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Insegnante</th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-6">
                        <span className="sr-only">Dettagli</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {selectedChild.recentLessons.length > 0 ? (
                      selectedChild.recentLessons.map((lesson: Lesson) => (
                        <tr key={lesson.id} className="hover:bg-slate-50 transition-colors">
                          <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-slate-900">
                            {formatDate(lesson.date)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                            {lesson.title || 'Nessuna materia'}
                          </td>
                          <td className="px-3 py-4 text-sm text-slate-600">
                            <div className="max-w-xs">
                              {lesson.topics && lesson.topics.length > 0 
                                ? lesson.topics.join(', ') 
                                : 'Nessun argomento specificato'
                              }
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                            {lesson.teacherName || 'Non specificato'}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                            <button 
                              onClick={() => handleLessonDetails(lesson)}
                              className="text-blue-600 hover:text-blue-700 transition-colors"
                            >
                              Dettagli
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                          <div className="flex flex-col items-center">
                            <BookOpen className="h-8 w-8 text-slate-300 mb-2" />
                            <span>Nessuna lezione disponibile</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      
      case 'homework':
        return (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Tutti i Compiti</h2>
              <p className="text-slate-600">Gestisci e monitora tutti i compiti di {selectedChild.firstName}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-slate-900">Scadenza</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Materia</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Titolo</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Descrizione</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">Stato</th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-6">
                        <span className="sr-only">Azioni</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {selectedChild.recentHomework.length > 0 ? (
                      selectedChild.recentHomework.map((hw: Homework) => (
                        <tr key={hw.id} className="hover:bg-slate-50 transition-colors">
                          <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                              {formatDate(hw.dueDate)}
                              {new Date(hw.dueDate) < new Date() && hw.status !== 'completed' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                  Scaduto
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                            {hw.subject || 'Nessuna materia'}
                          </td>
                          <td className="px-3 py-4 text-sm font-medium text-slate-900">
                            <div className="flex items-center space-x-2">
                              <span>{hw.title}</span>
                              {hw.attachmentUrls && hw.attachmentUrls.length > 0 && (
                                <div className="flex items-center">
                                  <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                  </svg>
                                  <span className="text-xs text-blue-600 ml-1">
                                    {hw.attachmentUrls.length}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-4 text-sm text-slate-600">
                            <div className="max-w-xs truncate">
                              {hw.description || 'Nessuna descrizione'}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              hw.status === 'completed' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : hw.status === 'late' 
                                  ? 'bg-red-100 text-red-700' 
                                  : 'bg-amber-100 text-amber-700'
                            }`}>
                              {hw.status === 'completed' ? 'Completato' : hw.status === 'late' ? 'In ritardo' : 'In sospeso'}
                            </span>
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                            <button 
                              onClick={() => handleHomeworkDetails(hw)}
                              className="text-blue-600 hover:text-blue-700 transition-colors mr-3"
                            >
                              Visualizza
                            </button>
                            {hw.status !== 'completed' && (
                              <button 
                                onClick={() => handleHomeworkSubmission(hw)}
                                className="text-emerald-600 hover:text-emerald-700 transition-colors"
                              >
                                Consegna
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                          <div className="flex flex-col items-center">
                            <GraduationCap className="h-8 w-8 text-slate-300 mb-2" />
                            <span>Nessun compito disponibile</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      
      case 'grades':
        return (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Voti e Valutazioni</h2>
              <p className="text-slate-600">Monitora i progressi e le valutazioni di {selectedChild.firstName}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
              <div className="text-center">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">Sezione in Sviluppo</h3>
                <p className="text-slate-500">Il sistema di voti e valutazioni sarà disponibile presto.</p>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-white/5" />
        
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
                  <Users className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold">Dashboard Genitore</h1>
                  <p className="text-blue-100 mt-1">Monitora il progresso dei tuoi figli</p>
                </div>
              </div>
              
              {/* Child selector in header */}
              {children.length > 0 && (
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-[280px]">
                  <label className="block text-sm font-medium text-blue-100 mb-2">
                    Seleziona Figlio
                  </label>
                  <select
                    value={selectedChildId}
                    onChange={handleChildChange}
                    className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent"
                  >
                    {children.map((child) => (
                      <option key={child.id} value={child.id} className="text-gray-900">
                        {child.firstName} {child.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/20 shadow-sm p-2">
            <nav className="flex space-x-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                  activeTab === 'overview'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Calendar className="h-4 w-4 inline mr-2" />
                Panoramica
              </button>
              <button
                onClick={() => setActiveTab('lessons')}
                className={`flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                  activeTab === 'lessons'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <BookOpen className="h-4 w-4 inline mr-2" />
                Lezioni
              </button>
              <button
                onClick={() => setActiveTab('homework')}
                className={`flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                  activeTab === 'homework'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <GraduationCap className="h-4 w-4 inline mr-2" />
                Compiti
              </button>
              <button
                onClick={() => setActiveTab('grades')}
                className={`flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                  activeTab === 'grades'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Users className="h-4 w-4 inline mr-2" />
                Voti
              </button>
            </nav>
          </div>
        </div>

        {/* Tab content */}
        <motion.div 
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/20 shadow-sm"
        >
          {renderTabContent()}
        </motion.div>

        {/* Lesson Details Modal */}
        {showLessonModal && selectedLesson && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900">Dettagli Lezione</h2>
                  <button
                    onClick={() => setShowLessonModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                    <p className="text-gray-900">{formatDate(selectedLesson.date)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Materia</label>
                    <p className="text-gray-900">{selectedLesson.title || 'Non specificata'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Insegnante</label>
                    <p className="text-gray-900">{selectedLesson.teacherName || 'Non specificato'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Argomenti</label>
                    <div className="text-gray-900">
                      {selectedLesson.topics && selectedLesson.topics.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1">
                          {selectedLesson.topics.map((topic, index) => (
                            <li key={index}>{topic}</li>
                          ))}
                        </ul>
                      ) : (
                        'Nessun argomento specificato'
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Homework Details Modal */}
        {showHomeworkModal && selectedHomework && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900">Dettagli Compito</h2>
                  <button
                    onClick={() => setShowHomeworkModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Titolo</label>
                    <p className="text-gray-900 font-medium">{selectedHomework.title}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Materia</label>
                    <p className="text-gray-900">{selectedHomework.subject || 'Non specificata'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza</label>
                    <p className="text-gray-900">{formatDate(selectedHomework.dueDate)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      selectedHomework.status === 'completed' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : selectedHomework.status === 'late' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-amber-100 text-amber-700'
                    }`}>
                      {selectedHomework.status === 'completed' ? 'Completato' : selectedHomework.status === 'late' ? 'In ritardo' : 'In sospeso'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                    <p className="text-gray-900 whitespace-pre-wrap">{selectedHomework.description || 'Nessuna descrizione disponibile'}</p>
                  </div>
                  
                  {/* Attachments Section */}
                  {selectedHomework.attachmentUrls && selectedHomework.attachmentUrls.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Allegati</label>
                      <div className="space-y-2">
                        {selectedHomework.attachmentUrls.map((attachmentUrl: string, index: number) => {
                          const fileName = getFileNameFromUrl(attachmentUrl);
                          const fileType = getFileTypeFromUrl(attachmentUrl);
                          
                          return (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                  {fileType === 'image' ? (
                                    <div className="relative">
                                      <img 
                                        src={attachmentUrl} 
                                        alt={fileName}
                                        className="h-12 w-12 object-cover rounded-md border border-gray-300"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          target.nextElementSibling?.classList.remove('hidden');
                                        }}
                                      />
                                      <svg className="h-8 w-8 text-blue-500 hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                  ) : fileType === 'pdf' ? (
                                    <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                  ) : (
                                    <svg className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {fileName}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {fileType === 'image' ? 'Immagine' : fileType === 'pdf' ? 'Documento PDF' : 'Documento'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {fileType === 'image' && (
                                  <button
                                    onClick={() => window.open(attachmentUrl, '_blank')}
                                    className="flex items-center px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 hover:border-green-300 transition-colors"
                                  >
                                    <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    Visualizza
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDownloadAttachment(attachmentUrl)}
                                  className="flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-colors"
                                >
                                  <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Scarica
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Homework Submission Modal */}
        {showSubmissionModal && selectedHomework && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900">Consegna Compito</h2>
                  <button
                    onClick={() => setShowSubmissionModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-6">
                <form onSubmit={(e) => { e.preventDefault(); handleSubmitHomework(); }} className="space-y-6">
                  {/* Homework Details */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-2">{selectedHomework.title}</h3>
                    <p className="text-blue-800 text-sm mb-2">
                      <strong>Scadenza:</strong> {formatDate(selectedHomework.dueDate)}
                    </p>
                    <p className="text-blue-800 text-sm mb-2">
                      <strong>Materia:</strong> {selectedHomework.subject || 'Non specificata'}
                    </p>
                    {selectedHomework.description && (
                      <div className="mt-3">
                        <strong className="text-blue-900">Descrizione:</strong>
                        <p className="text-blue-800 mt-1">{selectedHomework.description}</p>
                      </div>
                    )}
                  </div>

                  {/* Submission Form */}
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="submissionTitle" className="block text-sm font-medium text-gray-700 mb-1">
                        Titolo della consegna
                      </label>
                      <input
                        type="text"
                        id="submissionTitle"
                        value={selectedHomework.title}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="submissionDescription" className="block text-sm font-medium text-gray-700 mb-1">
                        Descrizione della tua consegna
                      </label>
                      <textarea
                        id="submissionDescription"
                        rows={4}
                        value={submissionText}
                        onChange={(e) => setSubmissionText(e.target.value)}
                        placeholder="Descrivi il tuo lavoro, aggiungi note o commenti..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="submissionClass" className="block text-sm font-medium text-gray-700 mb-1">
                        Classe
                      </label>
                      <input
                        type="text"
                        id="submissionClass"
                        value={selectedChild?.classData?.name || 'Classe non specificata'}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="submissionDueDate" className="block text-sm font-medium text-gray-700 mb-1">
                        Data di scadenza
                      </label>
                      <input
                        type="text"
                        id="submissionDueDate"
                        value={formatDate(selectedHomework.dueDate)}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="submissionFile" className="block text-sm font-medium text-gray-700 mb-1">
                        File (opzionale)
                      </label>
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
                        <div className="space-y-1 text-center">
                          <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                          >
                            <path
                              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <div className="flex text-sm text-gray-600">
                            <label
                              htmlFor="submissionFile"
                              className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                            >
                              <span>Trascina qui il file o clicca per selezionarlo</span>
                              <input
                                id="submissionFile"
                                name="submissionFile"
                                type="file"
                                className="sr-only"
                                onChange={handleFileUpload}
                                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                              />
                            </label>
                          </div>
                          <p className="text-xs text-gray-500">PDF, DOCX, TXT, immagini</p>
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
                  </div>

                  {/* Action Buttons */}
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
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Invio in corso...
                        </div>
                      ) : (
                        'Consegna Compito'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { ParentDashboard as default };
