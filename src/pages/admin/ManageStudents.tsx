import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { Search, Phone, Mail, Calendar, MapPin, AlertCircle, CheckCircle, Filter, Edit, Users, Shield, Save, X } from 'lucide-react';
import { format, isValid } from 'date-fns';
// import { it } from 'date-fns/locale';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
// import { Select } from '../../components/ui/Select';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { User as UserType, Class } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

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
      filtered = filtered.filter(student => {
        if (!student.birthDate) return false;
        const birthDate = new Date(student.birthDate);
        if (isNaN(birthDate.getTime())) return false;
        const age = new Date().getFullYear() - birthDate.getFullYear();
        return age.toString() === filters.age;
      });
    }

    if (filters.parentName) {
      filtered = filtered.filter(student => 
        student.parentName?.toLowerCase().includes(filters.parentName.toLowerCase())
      );
    }

    if (filters.parentPhone) {
      filtered = filtered.filter(student => 
        student.parentContact?.includes(filters.parentPhone)
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
      <PageContainer title="Accesso non autorizzato">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-8 text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-2xl font-light text-gray-900 mb-2">Accesso non autorizzato</h3>
          <p className="text-gray-600">Non hai i permessi per accedere a questa pagina.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Gestione Studenti"
      description="Visualizza e gestisci le informazioni degli studenti"
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
            <CardContent className="p-12 text-center">
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
            </CardContent>
          </Card>
          </motion.div>
        ) : (
          <>
            <Card variant="elevated" className="mb-6 bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
                <CardTitle className="flex items-center text-gray-900">
                  <Filter className="h-5 w-5 mr-2 text-blue-600" />
                  Filtri
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-wrap gap-6 items-end">
                <Input
                  label="Nome"
                  placeholder="Filtra per nome..."
                  value={filters.name}
                  onChange={(e) => handleFilterChange('name', e.target.value)}
                  className="flex-1 min-w-[200px] anime-input"
                  leftIcon={<Search className="h-5 w-5 text-gray-400" />}
                />
                
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Classe
                  </label>
                  <select
                    className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-3 px-4 transition-colors"
                    value={filters.class}
                    onChange={(e) => handleFilterChange('class', e.target.value)}
                  >
                    <option value="">Tutte le classi</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.turno ? ` – ${c.turno}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Età"
                  type="number"
                  placeholder="Età..."
                  value={filters.age}
                  onChange={(e) => handleFilterChange('age', e.target.value)}
                  className="w-[120px] anime-input"
                />

                <Input
                  label="Nome Genitore"
                  placeholder="Nome genitore..."
                  value={filters.parentName}
                  onChange={(e) => handleFilterChange('parentName', e.target.value)}
                  className="flex-1 min-w-[200px] anime-input"
                />

                <Input
                  label="Telefono Genitore"
                  placeholder="Telefono genitore..."
                  value={filters.parentPhone}
                  onChange={(e) => handleFilterChange('parentPhone', e.target.value)}
                  className="flex-1 min-w-[200px] anime-input"
                />
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 font-light">Caricamento degli studenti...</p>
            </div>
          ) : (
            <Card variant="elevated" className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
                <CardTitle className="flex items-center text-gray-900">
                  <Users className="h-5 w-5 mr-2 text-blue-600" />
                  Studenti ({filteredStudents.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Studente
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Classe
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Età
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Info Genitore
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Contatto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stato
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Azioni
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredStudents.map(student => (
                        <motion.tr 
                          key={student.id} 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                                <span className="text-blue-700 font-medium text-sm">
                                  {student.displayName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {student.displayName}
                                </div>
                                <div className="text-sm text-gray-500 flex items-center">
                                  <Mail className="h-3 w-3 mr-1" />
                                  {student.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900 flex items-center">
                              <Users className="h-4 w-4 mr-2 text-gray-400" />
                              {(() => {
                                const cls = classes.find(c => c.id === student.classId);
                                return cls ? `${cls.name}${cls.turno ? ' – ' + cls.turno : ''}` : 'Non assegnato';
                              })()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900 flex items-center">
                              <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                              {calculateAge(student.birthDate)} anni
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{student.parentName || 'N/A'}</div>
                            <div className="text-sm text-gray-500">{student.parentContact || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 flex items-center">
                              <Phone className="h-4 w-4 mr-1 text-gray-400" />
                              {student.phoneNumber || 'N/A'}
                            </div>
                            <div className="text-sm text-gray-500">{student.emergencyContact || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => openEnrollmentDialog(student)}
                              disabled={processingStudent === student.id}
                              className={`
                                inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium
                                transition-all duration-200 transform hover:scale-105
                                focus:outline-none focus:ring-2 focus:ring-offset-2
                                ${
                                  student.isEnrolled
                                    ? 'bg-green-100 text-green-800 hover:bg-green-200 focus:ring-green-500'
                                    : 'bg-red-100 text-red-800 hover:bg-red-200 focus:ring-red-500'
                                }
                                shadow-sm hover:shadow-md
                                ${processingStudent === student.id ? 'opacity-50 cursor-not-allowed' : ''}
                              `}
                            >
                              <span className="relative flex items-center">
                                {processingStudent === student.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                                ) : student.isEnrolled ? (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    <span>Iscritto</span>
                                    {student.enrollmentDate && (
                                      <span className="ml-2 text-xs opacity-75">
                                        ({formatDate(student.enrollmentDate)})
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="h-4 w-4 mr-2" />
                                    <span>Non Iscritto</span>
                                  </>
                                )}
                              </span>
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditStudent(student)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </PageContainer>
  );
};