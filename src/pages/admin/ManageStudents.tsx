import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { 
  Users, Edit, CheckCircle, X, AlertCircle, Phone, Calendar, 
  MapPin, Search, Filter, Shield, Save,
  LucideMessageSquareWarning
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { User as UserType, Class } from '../../types';
import { isValid, format } from 'date-fns';

interface StudentFormValues {
  displayName: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  birthDate?: string;
  gender?: string;
  emergencyContact?: string;
  parentName?: string;
  parentContact?: string;
  classId?: string;
}

export const ManageStudents: React.FC = () => {
  const { userProfile } = useAuth();
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<StudentFormValues>();
  const [students, setStudents] = useState<UserType[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<UserType[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [processingStudent, setProcessingStudent] = useState<string | null>(null);
  const [showEnrollConfirm, setShowEnrollConfirm] = useState(false);
  const [enrollTarget, setEnrollTarget] = useState<{ id: string; name: string; classId?: string; currentStatus?: boolean } | null>(null);
  const [targetEnrollStatus, setTargetEnrollStatus] = useState<boolean | null>(null);
  const [showEnrollError, setShowEnrollError] = useState<{ open: boolean; name: string; className: string } | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [enrolledPage, setEnrolledPage] = useState(1);
  const [notEnrolledPage, setNotEnrolledPage] = useState(1);
  const STUDENTS_PER_PAGE = 10;

  // Filters
  const [filters, setFilters] = useState({
    name: '',
    class: '',
    age: '',
    parentName: '',
    parentPhone: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile) return;
      
      try {
        // Fetch classes
        const classesQuery = query(collection(db, 'classes'));
        const classesDocs = await getDocs(classesQuery);
        const fetchedClasses = classesDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));
        setClasses(fetchedClasses);

        // Fetch students with proper date conversion
        const studentsQuery = query(
          collection(db, 'users'),
          where('role', '==', 'student')
        );
        const studentsDocs = await getDocs(studentsQuery);
        const fetchedStudents = studentsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            birthDate: data.birthDate?.toDate() || null,
            createdAt: data.createdAt?.toDate() || new Date(),
            enrollmentDate: data.enrollmentDate?.toDate() || null,
          } as UserType;
        });
        setStudents(fetchedStudents);
        setFilteredStudents(fetchedStudents);
      } catch (error) {
        console.error('Error fetching data:', error);
        setMessage({ type: 'error', text: 'Error fetching data' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userProfile]);

  useEffect(() => {
    let filtered = [...students];
    
    // Apply filters
    if (filters.name) {
      filtered = filtered.filter(student => 
        student.displayName.toLowerCase().includes(filters.name.toLowerCase())
      );
    }
    
    if (filters.class) {
      filtered = filtered.filter(student => student.classId === filters.class);
    }
    
    if (filters.age) {
      filtered = filtered.filter(student => 
        calculateAge(student.birthDate) === filters.age
      );
    }
    
    if (filters.parentName) {
      filtered = filtered.filter(student => 
        student.parentName && student.parentName.toLowerCase().includes(filters.parentName.toLowerCase())
      );
    }
    
    if (filters.parentPhone) {
      filtered = filtered.filter(student => 
        student.parentContact && student.parentContact.includes(filters.parentPhone)
      );
    }

    setFilteredStudents(filtered);
  }, [students, filters]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateAge = (birthDate: Date | undefined | null): string => {
    if (!birthDate) return 'N/A';
    const date = new Date(birthDate);
    if (!isValid(date)) return 'N/A';
    const age = new Date().getFullYear() - date.getFullYear();
    return age.toString();
  };

  // Student Card Component
  const StudentCard = ({ student }: { student: UserType }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group"
    >
      <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 rounded-xl overflow-hidden">
        <CardContent className="p-4">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setExpandedCard(expandedCard === student.id ? null : student.id)}
          >
            {/* Left: Avatar and Student Info */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-medium text-sm">
                  {student.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 text-base">
                  {student.displayName}
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <Phone className="h-3 w-3 mr-1" />
                    {student.phoneNumber || student.parentContact || 'N/A'}
                  </span>
                  <span className="flex items-center">
                    <Users className="h-3 w-3 mr-1" />
                    {(() => {
                      const cls = classes.find(c => c.id === student.classId);
                      return cls ? `${cls.name}` : 'Non assegnato';
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Status and Actions */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-lg font-semibold text-gray-900">
                  {calculateAge(student.birthDate)} anni
                </div>
                <div className="text-sm text-gray-500">
                  {student.parentName || 'Genitore N/A'}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEnrollmentDialog(student);
                  }}
                  disabled={processingStudent === student.id}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                    student.isEnrolled 
                      ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  } ${processingStudent === student.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {processingStudent === student.id ? (
                    <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent" />
                  ) : student.isEnrolled ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedCard(expandedCard === student.id ? null : student.id);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg 
                    className={`h-4 w-4 transition-transform duration-200 ${
                      expandedCard === student.id ? 'rotate-180' : ''
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>

          {/* Expanded Content */}
          <AnimatePresence>
            {expandedCard === student.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-4 mt-4 border-t border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Informazioni Studente</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Email:</span>
                          <span className="text-gray-900">{student.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Data di nascita:</span>
                          <span className="text-gray-900">{formatDate(student.birthDate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Indirizzo:</span>
                          <span className="text-gray-900">{student.address || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Genere:</span>
                          <span className="text-gray-900">{student.gender || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Contatti di Emergenza</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Genitore:</span>
                          <span className="text-gray-900">{student.parentName || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Telefono genitore:</span>
                          <span className="text-gray-900">{student.parentContact || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Emergenza:</span>
                          <span className="text-gray-900">{student.emergencyContact || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditStudent(student);
                      }}
                      className="rounded-xl"
                      leftIcon={<Edit className="h-4 w-4" />}
                    >
                      Modifica Studente
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );

  // Separate students by enrollment status
  const enrolledStudents = filteredStudents.filter(student => student.isEnrolled);
  const notEnrolledStudents = filteredStudents.filter(student => !student.isEnrolled);

  // Pagination logic
  const totalEnrolledPages = Math.ceil(enrolledStudents.length / STUDENTS_PER_PAGE);
  const totalNotEnrolledPages = Math.ceil(notEnrolledStudents.length / STUDENTS_PER_PAGE);

  const paginatedEnrolledStudents = enrolledStudents.slice(
    (enrolledPage - 1) * STUDENTS_PER_PAGE,
    enrolledPage * STUDENTS_PER_PAGE
  );

  const paginatedNotEnrolledStudents = notEnrolledStudents.slice(
    (notEnrolledPage - 1) * STUDENTS_PER_PAGE,
    notEnrolledPage * STUDENTS_PER_PAGE
  );

  const formatDate = (date: Date | undefined | null): string => {
    if (!date) return '';
    const dateObj = new Date(date);
    if (!isValid(dateObj)) return '';
    return format(dateObj, 'dd/MM/yyyy');
  };

  const handleEditStudent = (student: UserType) => {
    setEditingStudent(student.id);
    setValue('displayName', student.displayName);
    setValue('email', student.email);
    setValue('phoneNumber', student.phoneNumber || '');
    setValue('address', student.address || '');
    
    if (student.birthDate && isValid(new Date(student.birthDate))) {
      setValue('birthDate', format(new Date(student.birthDate), 'yyyy-MM-dd'));
    } else {
      setValue('birthDate', '');
    }
    
    setValue('gender', student.gender || '');
    setValue('emergencyContact', student.emergencyContact || '');
    setValue('parentName', student.parentName || '');
    setValue('parentContact', student.parentContact || '');
    setValue('classId', student.classId || '');
  };

  const handleCancelEdit = () => {
    setEditingStudent(null);
    reset();
  };

  const updateClassStudentCount = async (classId: string, increment: boolean) => {
    try {
      const classDoc = classes.find(c => c.id === classId);
      if (!classDoc) return;

      const currentStudents = classDoc.students || [];
      
      // Update the class document with the new student count
      await updateDoc(doc(db, 'classes', classId), {
        students: increment 
          ? [...currentStudents, editingStudent!] 
          : currentStudents.filter(id => id !== editingStudent),
        updatedAt: new Date()
      });

      // Update local state
      setClasses(prev => prev.map(c => 
        c.id === classId 
          ? { 
              ...c, 
              students: increment 
                ? [...currentStudents, editingStudent!] 
                : currentStudents.filter(id => id !== editingStudent)
            }
          : c
      ));
    } catch (error) {
      console.error('Error updating class student count:', error);
    }
  };

  const openEnrollmentDialog = (student: UserType) => {
    const isCurrentlyEnrolled = !!student.isEnrolled;
    if (isCurrentlyEnrolled && student.classId) {
      const studentClass = classes.find(c => c.id === student.classId);
      setShowEnrollError({ open: true, name: student.displayName, className: studentClass?.name || 'una classe' });
      return;
    }
    setEnrollTarget({ id: student.id, name: student.displayName, classId: student.classId, currentStatus: student.isEnrolled });
    setTargetEnrollStatus(!isCurrentlyEnrolled);
    setShowEnrollConfirm(true);
  };

  const confirmEnrollmentChange = async () => {
    if (!enrollTarget || targetEnrollStatus === null) return;
    const studentId = enrollTarget.id;
    const newStatus = targetEnrollStatus;

    setProcessingStudent(studentId);

    try {
      const studentRef = doc(db, 'users', studentId);
      await updateDoc(studentRef, {
        isEnrolled: newStatus,
        enrollmentDate: newStatus ? new Date() : null
      });

      setStudents(prev => prev.map(student =>
        student.id === studentId
          ? {
              ...student,
              isEnrolled: newStatus,
              enrollmentDate: newStatus ? new Date() : undefined
            }
          : student
      ));

      setMessage({
        type: 'success',
        text: `Studente ${newStatus ? 'iscritto' : 'disiscritto'} con successo`
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error updating enrollment status:', error);
      setMessage({
        type: 'error',
        text: 'Errore durante l\'aggiornamento dello stato di iscrizione'
      });
    } finally {
      setProcessingStudent(null);
      setShowEnrollConfirm(false);
      setEnrollTarget(null);
      setTargetEnrollStatus(null);
    }
  };

  const onSubmit = async (data: StudentFormValues) => {
    if (!editingStudent) return;
    
    setIsSubmitting(true);
    setMessage(null);
    
    try {
      const studentRef = doc(db, 'users', editingStudent);
      const currentStudent = students.find(s => s.id === editingStudent);
      const oldClassId = currentStudent?.classId;
      const newClassIdDb = data.classId ?? null; // value sent to Firestore (nullable)
      const newClassIdState = data.classId ?? undefined; // value kept in local state (undefined preferred over null)
      
      await updateDoc(studentRef, {
        displayName: data.displayName,
        phoneNumber: data.phoneNumber || null,
        address: data.address || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        gender: data.gender || null,
        emergencyContact: data.emergencyContact || null,
        parentName: data.parentName || null,
        parentContact: data.parentContact || null,
        classId: newClassIdDb,
        updatedAt: new Date()
      });

      // Update class student counts if class changed
      if (oldClassId !== newClassIdDb) {
        if (oldClassId) {
          await updateClassStudentCount(oldClassId, false);
        }
        if (newClassIdDb) {
          await updateClassStudentCount(newClassIdDb, true);
        }
      }

      setStudents(prev => prev.map(student => 
        student.id === editingStudent
          ? {
              ...student,
              ...data,
              gender: data.gender === 'male' || data.gender === 'female' ? data.gender : undefined,
              classId: newClassIdState,
              birthDate: data.birthDate ? new Date(data.birthDate) : undefined
            }
          : student
      ));

      setMessage({ type: 'success', text: 'Studente aggiornato con successo' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
      
      handleCancelEdit();
    } catch (error) {
      console.error('Error updating student:', error);
      setMessage({ type: 'error', text: 'Errore nell\'aggiornamento dello studente' });
    } finally {
      setIsSubmitting(false);
    }
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
                <Users className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Gestione Studenti</h1>
                <p className="text-blue-100 mt-1">Visualizza e gestisci le informazioni degli studenti</p>
              </div>
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

        {/* Enrollment Restriction Dialog */}
        {showEnrollError?.open && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl"
            >
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Impossibile Disiscrivere</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Lo studente <span className="font-medium text-gray-900">{showEnrollError.name}</span> è attualmente assegnato alla classe <span className="font-medium text-gray-900">{showEnrollError.className}</span>.
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Per disiscrivere questo studente, è necessario prima rimuoverlo dalla classe.
                </p>
              </div>
              <div className="flex justify-center space-x-3">
                <Button
                  onClick={() => { window.location.href = '/admin/classes'; }}
                >
                  Gestisci Classi
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowEnrollError(null)}
                  leftIcon={<X className="h-4 w-4" />}
                >
                  Chiudi
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Enrollment Confirm Dialog */}
        {showEnrollConfirm && enrollTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl"
            >
              <div className="text-center">
                <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${targetEnrollStatus ? 'bg-green-100' : 'bg-red-100'} mb-4`}>
                  {targetEnrollStatus ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <X className="h-6 w-6 text-red-600" />
                  )}
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Conferma {targetEnrollStatus ? 'iscrizione' : 'disiscrizione'}</h3>
                <p className="text-sm text-gray-500">
                  Sei sicuro di voler {targetEnrollStatus ? 'iscrivere' : 'disiscrivere'} lo studente <span className="font-medium text-gray-900">{enrollTarget.name}</span>?
                </p>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => { setShowEnrollConfirm(false); setEnrollTarget(null); setTargetEnrollStatus(null); }}
                >
                  Annulla
                </Button>
                <Button
                  onClick={confirmEnrollmentChange}
                  isLoading={processingStudent === enrollTarget.id}
                  disabled={processingStudent === enrollTarget.id}
                >
                  Conferma
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {editingStudent ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
              <CardTitle className="flex items-center text-gray-900">
                <Edit className="h-5 w-5 mr-2 text-blue-600" />
                Modifica Studente
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                      label="Nome completo"
                      error={errors.displayName?.message}
                      className="anime-input"
                      {...register('displayName', { required: 'Il nome è obbligatorio' })}
                    />
                    
                    <Input
                      label="Email"
                      type="email"
                      disabled
                      className="anime-input bg-gray-50"
                      {...register('email')}
                    />

                    <Input
                      label="Telefono"
                      leftIcon={<Phone className="h-5 w-5 text-gray-400" />}
                      className="anime-input"
                      {...register('phoneNumber')}
                    />

                    <Input
                      label="Indirizzo"
                      leftIcon={<MapPin className="h-5 w-5 text-gray-400" />}
                      className="anime-input"
                      {...register('address')}
                    />

                    <Input
                      label="Data di nascita"
                      type="date"
                      leftIcon={<Calendar className="h-5 w-5 text-gray-400" />}
                      className="anime-input"
                      {...register('birthDate')}
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Genere
                      </label>
                      <select
                        className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-3 px-4 transition-colors"
                        {...register('gender')}
                      >
                        <option value="">Seleziona genere</option>
                        <option value="male">Maschio</option>
                        <option value="female">Femmina</option>
                      </select>
                    </div>

                    <Input
                      label="Contatto di emergenza"
                      className="anime-input"
                      {...register('emergencyContact')}
                    />

                    <Input
                      label="Nome del genitore"
                      className="anime-input"
                      {...register('parentName')}
                    />

                    <Input
                      label="Contatto del genitore"
                      className="anime-input"
                      {...register('parentContact')}
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Classe
                      </label>
                      <select
                        className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-3 px-4 transition-colors"
                        {...register('classId')}
                      >
                        <option value="">Nessuna classe</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}{c.turno ? ` – ${c.turno}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end space-x-4 bg-gray-50 border-t border-gray-200 p-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
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
                    leftIcon={<Save className="h-4 w-4" />}
                    className="anime-button"
                  >
                    Salva
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </motion.div>
        ) : (
          <>
            <Card className="bg-white/90 backdrop-blur-md border border-white/30 shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 border-b border-white/20 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-gray-800">
                    <div className="p-2 bg-blue-100 rounded-xl mr-3">
                      <Filter className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Filtri Avanzati</h3>
                      <p className="text-sm text-gray-600 font-normal">Cerca e filtra gli studenti</p>
                    </div>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters({
                        name: '',
                        class: '',
                        age: '',
                        parentName: '',
                        parentPhone: ''
                      })}
                      className="text-gray-600 hover:text-gray-800 rounded-xl"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reset Filtri
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Primary Filters Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center">
                        <Search className="h-4 w-4 mr-1 text-gray-500" />
                        Nome Studente
                      </label>
                      <Input
                        type="text"
                        placeholder="Cerca per nome..."
                        value={filters.name}
                        onChange={(e) => handleFilterChange('name', e.target.value)}
                        className="w-full rounded-xl border-gray-200 focus:border-blue-400 focus:ring-blue-400/20"
                      />
                    </div>
                    
                    
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                        Età
                      </label>
                      <Input
                        type="number"
                        placeholder="Età studente..."
                        value={filters.age}
                        onChange={(e) => handleFilterChange('age', e.target.value)}
                        className="w-full rounded-xl border-gray-200 focus:border-blue-400 focus:ring-blue-400/20"
                        min="0"
                        max="100"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center">
                        <Users className="h-4 w-4 mr-1 text-gray-500" />
                        Classe
                      </label>
                      <select
                        value={filters.class}
                        onChange={(e) => handleFilterChange('class', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 bg-white"
                      >
                        <option value="">Tutte le classi</option>
                        {classes.map(cls => (
                          <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Secondary Filters Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center">
                        <Users className="h-4 w-4 mr-1 text-gray-500" />
                        Nome Genitore
                      </label>
                      <Input
                        type="text"
                        placeholder="Nome del genitore..."
                        value={filters.parentName}
                        onChange={(e) => handleFilterChange('parentName', e.target.value)}
                        className="w-full rounded-xl border-gray-200 focus:border-blue-400 focus:ring-blue-400/20"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center">
                        <Phone className="h-4 w-4 mr-1 text-gray-500" />
                        Telefono Genitore
                      </label>
                      <Input
                        type="tel"
                        placeholder="Numero di telefono..."
                        value={filters.parentPhone}
                        onChange={(e) => handleFilterChange('parentPhone', e.target.value)}
                        className="w-full rounded-xl border-gray-200 focus:border-blue-400 focus:ring-blue-400/20"
                      />
                    </div>
                  </div>

                  {/* Filter Summary */}
                  {(filters.name || filters.class || filters.age || filters.parentName || filters.parentPhone) && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-sm text-blue-700">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          <span className="font-medium">
                            {filteredStudents.length} studenti trovati
                          </span>
                          {filteredStudents.length !== students.length && (
                            <span className="ml-1">
                              su {students.length} totali
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {filters.name && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                              Nome: {filters.name}
                              <button
                                onClick={() => handleFilterChange('name', '')}
                                className="ml-1 hover:text-blue-900"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                          {filters.class && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-700">
                              Classe: {classes.find(c => c.id === filters.class)?.name}
                              <button
                                onClick={() => handleFilterChange('class', '')}
                                className="ml-1 hover:text-purple-900"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                          {filters.age && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
                              Età: {filters.age}
                              <button
                                onClick={() => handleFilterChange('age', '')}
                                className="ml-1 hover:text-green-900"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                          {filters.parentName && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-700">
                              Genitore: {filters.parentName}
                              <button
                                onClick={() => handleFilterChange('parentName', '')}
                                className="ml-1 hover:text-orange-900"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                          {filters.parentPhone && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-pink-100 text-pink-700">
                              Tel: {filters.parentPhone}
                              <button
                                onClick={() => handleFilterChange('parentPhone', '')}
                                className="ml-1 hover:text-pink-900"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 font-light">Caricamento degli studenti...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Section Header */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold text-green-700">
                          {enrolledStudents.length}
                        </div>
                        <div className="text-sm text-gray-600">Iscritti</div>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold text-red-700">
                          {notEnrolledStudents.length}
                        </div>
                        <div className="text-sm text-gray-600">Lista D'Attesa</div>
                      </div>
                      <X className="h-5 w-5 text-red-600" />
                    </div>
                  </div>
                </div>
              </div>
              
              {filteredStudents.length === 0 ? (
                <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
                  <CardContent className="p-12 text-center">
                    <Users className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                    <h3 className="text-xl font-medium text-gray-900 mb-2">Nessuno studente trovato</h3>
                    <p className="text-gray-600 max-w-md mx-auto mb-8">
                      Non ci sono studenti che corrispondono ai filtri selezionati.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Enrolled Students Column */}
                  <div className="space-y-4">
                                     
                    <div className="space-y-3">
                      {paginatedEnrolledStudents.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>Nessuno Studente Iscritto</p>
                        </div>
                      ) : (
                        paginatedEnrolledStudents.map(student => (
                          <StudentCard key={student.id} student={student} />
                        ))
                      )}
                    </div>

                    {/* Enrolled Pagination */}
                    {totalEnrolledPages > 1 && (
                      <div className="flex justify-center items-center gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEnrolledPage(Math.max(1, enrolledPage - 1))}
                          disabled={enrolledPage === 1}
                          className="px-3 py-1"
                        >
                          Precedente
                        </Button>
                        <span className="text-sm text-gray-600">
                          Pagina {enrolledPage} di {totalEnrolledPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEnrolledPage(Math.min(totalEnrolledPages, enrolledPage + 1))}
                          disabled={enrolledPage === totalEnrolledPages}
                          className="px-3 py-1"
                        >
                          Successiva
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Not Enrolled Students Column */}
                  <div className="space-y-4">
                    
                    
                    <div className="space-y-3">
                      {paginatedNotEnrolledStudents.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>Nessuno Studente In Lista D'Attesa</p>
                        </div>
                      ) : (
                        paginatedNotEnrolledStudents.map(student => (
                          <StudentCard key={student.id} student={student} />
                        ))
                      )}
                    </div>

                    {/* Not Enrolled Pagination */}
                    {totalNotEnrolledPages > 1 && (
                      <div className="flex justify-center items-center gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setNotEnrolledPage(Math.max(1, notEnrolledPage - 1))}
                          disabled={notEnrolledPage === 1}
                          className="px-3 py-1"
                        >
                          Precedente
                        </Button>
                        <span className="text-sm text-gray-600">
                          Pagina {notEnrolledPage} di {totalNotEnrolledPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setNotEnrolledPage(Math.min(totalNotEnrolledPages, notEnrolledPage + 1))}
                          disabled={notEnrolledPage === totalNotEnrolledPages}
                          className="px-3 py-1"
                        >
                          Successiva
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
};