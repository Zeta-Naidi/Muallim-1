import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, updateDoc, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ClipboardList, Users, Star, CheckCircle, Clock, MessageSquare, Download, 
  Filter, Edit, Save, X, Search, FileText, AlertCircle, ChevronDown, ChevronUp, 
  BookOpen, Calendar, ArrowUpDown, Plus, School } from 'lucide-react';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EditHomeworkDialog } from '../../components/dialogs/EditHomeworkDialog';
import { Class, Homework, HomeworkSubmission, User } from '../../types';

export const GradeManagement: React.FC = () => {
  const { userProfile } = useAuth();
  const [myClasses, setMyClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [homework, setHomework] = useState<Homework[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [students, setStudents] = useState<Record<string, User>>({});
  const [selectedHomework, setSelectedHomework] = useState<string>('');
  const [gradingSubmission, setGradingSubmission] = useState<string | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<Class[]>([]);
  const [gradeValue, setGradeValue] = useState('');
  const [feedback, setFeedback] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'studentName' | 'submittedAt' | 'status'>('submittedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    const fetchTeacherClasses = async () => {
      if (!userProfile || userProfile.role !== 'teacher') return;

      try {
        // Fetch classes where teacher is the main teacher
        const classesQuery = query(collection(db, 'classes'), where('teacherId', '==', userProfile.id));
        const classesDocs = await getDocs(classesQuery);
        const teacherClasses = classesDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));
        
        // Fetch temporary classes (substitutions)
        let temporaryClasses: Class[] = [];
        if (userProfile.temporaryClasses && userProfile.temporaryClasses.length > 0) {
          const tempClassesQuery = query(
            collection(db, 'classes'),
            where('__name__', 'in', userProfile.temporaryClasses)
          );
          const tempClassesDocs = await getDocs(tempClassesQuery);
          temporaryClasses = tempClassesDocs.docs.map(doc => ({ 
            ...doc.data(), 
            id: doc.id,
            isTemporary: true // Mark as temporary class
          } as Class));
        }
        
        // Combine regular and temporary classes
        const allClasses = [...teacherClasses, ...temporaryClasses];
        setMyClasses(allClasses);
        setTeacherClasses(allClasses);
        
        if (teacherClasses.length > 0 && !selectedClass) {
          setSelectedClass(teacherClasses[0].id);
        }
      } catch (error) {
        console.error('Error fetching teacher classes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeacherClasses();
  }, [userProfile]);

  useEffect(() => {
    const fetchClassData = async () => {
      if (!selectedClass) return;
      
      try {
        // Fetch homework for the class (only created by this teacher)
        const homeworkQuery = query(
          collection(db, 'homework'),
          where('classId', '==', selectedClass),
          where('createdBy', '==', userProfile?.id),
          orderBy('dueDate', 'desc')
        );
        const homeworkDocs = await getDocs(homeworkQuery);
        const homeworkList = homeworkDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            dueDate: data.dueDate?.toDate() || null
          } as Homework;
        });
        setHomework(homeworkList);
        
        // Auto-select the most recent homework if available
        if (homeworkList.length > 0) {
          setSelectedHomework(homeworkList[0].id);
        }

        // Fetch students for the class
        const studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('classId', '==', selectedClass)
        );
        const studentsDocs = await getDocs(studentsQuery);
        const studentsMap: Record<string, User> = {};
        studentsDocs.docs.forEach(doc => {
          const userData = { ...doc.data(), id: doc.id } as User;
          studentsMap[doc.id] = userData;
        });
        setStudents(studentsMap);

      } catch (error) {
        console.error('Error fetching class data:', error);
      }
    };

    fetchClassData();
  }, [selectedClass, userProfile]);

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!selectedHomework) {
        setSubmissions([]);
        return;
      }
      
      try {
        const submissionsQuery = query(
          collection(db, 'homeworkSubmissions'),
          where('homeworkId', '==', selectedHomework),
          orderBy('submittedAt', 'desc')
        );
        const submissionsDocs = await getDocs(submissionsQuery);
        const submissionsList = submissionsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            submittedAt: data.submittedAt?.toDate() || new Date(),
            gradedAt: data.gradedAt?.toDate() || null
          } as HomeworkSubmission;
        });
        setSubmissions(submissionsList);
      } catch (error) {
        console.error('Error fetching submissions:', error);
      }
    };

    fetchSubmissions();
  }, [selectedHomework]);

  const handleGradeSubmission = async (submissionId: string) => {
    if (!gradeValue || !userProfile) return;
    
    const grade = parseFloat(gradeValue);
    if (isNaN(grade) || grade < 0 || grade > 10) {
      alert('Il voto deve essere un numero tra 0 e 10');
      return;
    }

    try {
      await updateDoc(doc(db, 'homeworkSubmissions', submissionId), {
        grade,
        feedback: feedback.trim(),
        status: 'graded',
        gradedBy: userProfile.id,
        gradedAt: new Date()
      });

      // Update local state
      setSubmissions(prev => prev.map(sub => 
        sub.id === submissionId 
          ? { 
              ...sub, 
              grade, 
              feedback: feedback.trim(), 
              status: 'graded' as const,
              gradedBy: userProfile.id,
              gradedAt: new Date()
            }
          : sub
      ));

      setGradingSubmission(null);
      setGradeValue('');
      setFeedback('');
    } catch (error) {
      console.error('Error grading submission:', error);
      alert('Errore durante la valutazione');
    }
    setSubmissions([]);
  };

  const handleEditHomework = (homework: Homework) => {
    setEditingHomework(homework);
    setIsEditDialogOpen(true);
  };

  const handleHomeworkUpdate = (updatedHomework: Homework) => {
    setHomework(prev => prev.map(hw => 
      hw.id === updatedHomework.id ? updatedHomework : hw
    ));
  };

  const startGrading = (submission: HomeworkSubmission) => {
    setGradingSubmission(submission.id);
    setGradeValue(submission.grade?.toString() || '');
    setFeedback(submission.feedback || '');
  };

  const cancelGrading = () => {
    setGradingSubmission(null);
    setGradeValue('');
    setFeedback('');
  };

  const toggleSort = (field: 'studentName' | 'submittedAt' | 'status') => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedSubmissions = () => {
    let filtered = [...submissions];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(submission => {
        const studentName = students[submission.studentId]?.displayName || '';
        return studentName.toLowerCase().includes(query);
      });
    }
    
    // Apply sorting
    return filtered.sort((a, b) => {
      if (sortField === 'studentName') {
        const nameA = students[a.studentId]?.displayName || '';
        const nameB = students[b.studentId]?.displayName || '';
        return sortDirection === 'asc' 
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      } else if (sortField === 'submittedAt') {
        return sortDirection === 'asc'
          ? a.submittedAt.getTime() - b.submittedAt.getTime()
          : b.submittedAt.getTime() - a.submittedAt.getTime();
      } else if (sortField === 'status') {
        const statusA = a.status === 'graded' ? 1 : 0;
        const statusB = b.status === 'graded' ? 1 : 0;
        return sortDirection === 'asc'
          ? statusA - statusB
          : statusB - statusA;
      }
      return 0;
    });
  };

  const formatDate = (date: Date | null): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return 'Data non valida';
    }
    return format(date, 'd MMMM yyyy HH:mm', { locale: it });
  };

  if (!userProfile || userProfile.role !== 'teacher') {
    return (
      <PageContainer title="Accesso non autorizzato">
        <p>Non hai i permessi per accedere a questa pagina.</p>
      </PageContainer>
    );
  }

  const selectedHomeworkData = homework.find(hw => hw.id === selectedHomework);
  const gradedCount = submissions.filter(sub => sub.status === 'graded').length;
  const pendingCount = submissions.filter(sub => sub.status === 'submitted').length;
  const sortedSubmissions = getSortedSubmissions();

  return (
    <PageContainer
      title="Gestione Valutazioni"
      description="Valuta i compiti consegnati dagli studenti e monitora i progressi"
    >
      {/* Class and Homework Selectors */}
      <Card variant="elevated" className="mb-6 bg-white/80 backdrop-blur-md border border-white/20 shadow-md rounded-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <CardTitle className="flex items-center text-gray-900">
            <Filter className="h-5 w-5 mr-2 text-blue-600" />
            Filtri e Selezione
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seleziona Classe
              </label>
              <select
                className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-3 px-4 transition-colors"
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedHomework('');
                }}
              >
                <option value="">Seleziona una classe</option>
                {teacherClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.isTemporary ? '(Supplenza)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seleziona Compito
              </label>
              <select
                className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-3 px-4 transition-colors"
                value={selectedHomework}
                onChange={(e) => setSelectedHomework(e.target.value)}
                disabled={!selectedClass}
              >
                <option value="">Seleziona un compito</option>
                {homework.map(hw => (
                  <option key={hw.id} value={hw.id}>
                    {hw.title} - Scadenza: {formatDate(hw.dueDate)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedHomeworkData && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card variant="elevated" className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="p-5 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <ClipboardList className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-900">{submissions.length}</div>
                <div className="text-sm text-blue-700">Consegne Totali</div>
              </CardContent>
            </Card>

            <Card variant="elevated" className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="p-5 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-900">{gradedCount}</div>
                <div className="text-sm text-green-700">Valutate</div>
                {submissions.length > 0 && (
                  <div className="mt-2 w-full bg-white rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${(gradedCount / submissions.length) * 100}%` }}
                    ></div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card variant="elevated" className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 shadow-sm hover:shadow-md transition-all duration-300">
              <CardContent className="p-5 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
                <div className="text-2xl font-bold text-amber-900">{pendingCount}</div>
                <div className="text-sm text-amber-700">In Attesa</div>
                {submissions.length > 0 && (
                  <div className="mt-2 w-full bg-white rounded-full h-2">
                    <div 
                      className="bg-amber-500 h-2 rounded-full" 
                      style={{ width: `${(pendingCount / submissions.length) * 100}%` }}
                    ></div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Homework Details with Edit Button */}
          <Card variant="elevated" className="mb-8 bg-white/80 backdrop-blur-md border border-white/20 shadow-lg rounded-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <BookOpen className="h-5 w-5 mr-2 text-blue-600" />
                  {selectedHomeworkData.title}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditHomework(selectedHomeworkData)}
                  leftIcon={<Edit className="h-4 w-4" />}
                  className="bg-white hover:bg-gray-50"
                >
                  Modifica Compito
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-gray-700" />
                    Descrizione
                  </h3>
                  <p className="text-gray-700 leading-relaxed">{selectedHomeworkData.description}</p>
                </div>
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-gray-700" />
                    Dettagli
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                        <Calendar className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Scadenza</p>
                        <p className="font-medium text-gray-900">{formatDate(selectedHomeworkData.dueDate)}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                        <Users className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Classe</p>
                        <p className="font-medium text-gray-900">{selectedHomeworkData.className}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submissions List */}
          <Card variant="elevated" className="bg-white/80 backdrop-blur-md border border-white/20 shadow-lg rounded-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-blue-600" />
                  Consegne ({submissions.length})
                </div>
                <Input
                  placeholder="Cerca studente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                  className="max-w-xs"
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Table Header */}
              <div className="border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-12 gap-4 px-6 py-3">
                  <div className="col-span-4 flex items-center">
                    <button 
                      className="flex items-center text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                      onClick={() => toggleSort('studentName')}
                    >
                      Studente
                      {sortField === 'studentName' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </button>
                  </div>
                  <div className="col-span-3 flex items-center">
                    <button 
                      className="flex items-center text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                      onClick={() => toggleSort('submittedAt')}
                    >
                      Data Consegna
                      {sortField === 'submittedAt' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </button>
                  </div>
                  <div className="col-span-3 flex items-center">
                    <button 
                      className="flex items-center text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                      onClick={() => toggleSort('status')}
                    >
                      Stato
                      {sortField === 'status' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </button>
                  </div>
                  <div className="col-span-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Azioni
                  </div>
                </div>
              </div>

              {/* Submissions List */}
              {sortedSubmissions.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {sortedSubmissions.map((submission) => {
                    const student = students[submission.studentId];
                    const isExpanded = expandedSubmission === submission.id;
                    
                    return (
                      <div key={submission.id} className="hover:bg-gray-50 transition-colors">
                        <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                          <div className="col-span-4">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mr-3">
                                <span className="text-blue-700 font-medium text-sm">
                                  {student?.displayName.charAt(0).toUpperCase() || '?'}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{student?.displayName || 'Studente sconosciuto'}</div>
                                <div className="text-xs text-gray-500">{student?.email || ''}</div>
                              </div>
                            </div>
                          </div>
                          <div className="col-span-3">
                            <div className="text-sm text-gray-900">{formatDate(submission.submittedAt)}</div>
                          </div>
                          <div className="col-span-3">
                            {submission.status === 'graded' ? (
                              <div className="flex items-center">
                                <div className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 flex items-center">
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  <span>Valutato: {submission.grade}/10</span>
                                </div>
                              </div>
                            ) : (
                              <div className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800 flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                <span>In attesa</span>
                              </div>
                            )}
                          </div>
                          <div className="col-span-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedSubmission(isExpanded ? null : submission.id)}
                              className="mr-2"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startGrading(submission)}
                              leftIcon={<Edit className="h-4 w-4" />}
                              className="bg-white"
                            >
                              {submission.status === 'graded' ? 'Modifica' : 'Valuta'}
                            </Button>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="px-6 pb-4 bg-gray-50 border-t border-gray-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                              {/* Submission Files */}
                              <div>
                                {submission.submissionUrls && submission.submissionUrls.length > 0 ? (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                                      <FileText className="h-4 w-4 mr-2 text-gray-700" />
                                      File Consegnati
                                    </h4>
                                    <div className="space-y-2">
                                      {submission.submissionUrls.map((url, index) => (
                                        <a
                                          key={index}
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center p-3 bg-white rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                                        >
                                          <Download className="h-4 w-4 text-blue-600 mr-2" />
                                          <span className="text-sm text-gray-900">File {index + 1}</span>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-sm text-gray-500 italic">Nessun file allegato</div>
                                )}
                              </div>
                              
                              {/* Submission Notes & Feedback */}
                              <div>
                                {submission.submissionText && (
                                  <div className="mb-4">
                                    <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                                      <MessageSquare className="h-4 w-4 mr-2 text-gray-700" />
                                      Note dello Studente
                                    </h4>
                                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                                      <p className="text-sm text-gray-700">{submission.submissionText}</p>
                                    </div>
                                  </div>
                                )}
                                
                                {submission.feedback && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                                      <MessageSquare className="h-4 w-4 mr-2 text-blue-600" />
                                      Feedback dell'Insegnante
                                    </h4>
                                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                      <p className="text-sm text-blue-800">{submission.feedback}</p>
                                      {submission.gradedAt && (
                                        <p className="text-xs text-blue-600 mt-2">
                                          Valutato il {formatDate(submission.gradedAt)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Grading Interface */}
                        {gradingSubmission === submission.id && (
                          <div className="px-6 pb-6 pt-2 bg-white border-t border-gray-200">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                              <div className="flex items-center">
                                <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
                                <p className="text-sm text-blue-800">
                                  Stai valutando la consegna di <strong>{students[submission.studentId]?.displayName || 'Studente'}</strong>
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <Input
                                  label="Voto (0-10)"
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.5"
                                  value={gradeValue}
                                  onChange={(e) => setGradeValue(e.target.value)}
                                  placeholder="Es: 8.5"
                                  className="anime-input"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Feedback (opzionale)
                                </label>
                                <textarea
                                  className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3 min-h-[120px] transition-colors"
                                  value={feedback}
                                  onChange={(e) => setFeedback(e.target.value)}
                                  placeholder="Commenti sulla consegna..."
                                />
                              </div>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                              <Button 
                                variant="outline" 
                                onClick={cancelGrading}
                                leftIcon={<X className="h-4 w-4" />}
                                className="border-gray-300"
                              >
                                Annulla
                              </Button>
                              <Button 
                                onClick={() => handleGradeSubmission(submission.id)}
                                disabled={!gradeValue}
                                leftIcon={<Save className="h-4 w-4" />}
                                className="anime-button"
                              >
                                Salva Valutazione
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna consegna</h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    Non ci sono ancora consegne per questo compito. Gli studenti potrebbero non aver ancora inviato i loro lavori.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!selectedHomework && selectedClass && homework.length > 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardList className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Seleziona un compito</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Scegli un compito dall'elenco per visualizzare e valutare le consegne degli studenti.
            </p>
          </CardContent>
        </Card>
      )}

      {!selectedHomework && selectedClass && homework.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardList className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Nessun compito trovato</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Non hai ancora creato compiti per questa classe.
            </p>
            <Link to="/homework/new" className="mt-6 inline-block">
              <Button leftIcon={<Plus className="h-4 w-4" />}>
                Crea Nuovo Compito
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!selectedClass && (
        <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
          <CardContent className="p-12 text-center">
            <Users className="h-20 w-20 text-gray-300 mx-auto mb-6" />
            <h3 className="text-2xl font-medium text-gray-900 mb-3">Seleziona una classe</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Scegli una delle tue classi per iniziare a valutare i compiti degli studenti.
            </p>
            <Link to="/teacher/classes" className="mt-6 inline-block">
              <Button variant="outline" leftIcon={<School className="h-4 w-4" />}>
                Gestisci Classi
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Edit Homework Dialog */}
      <EditHomeworkDialog
        homework={editingHomework}
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingHomework(null);
        }}
        onUpdate={handleHomeworkUpdate}
      />
    </PageContainer>
  );
};