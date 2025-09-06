import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { 
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserIcon,
  Phone,
  AlertCircle,
  User,
  Monitor,
  Users,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface StudentData {
  firstName: string;
  lastName: string;
  codiceFiscale: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  birthDate?: string;
  gender?: string;
  hasDisability?: string;
  emergencyContact?: string;
}

interface ParentFormValues {
  parentName: string;
  parentCodiceFiscale: string;
  parentContact: string;
  parentEmail: string;
  parentPassword: string;
}

export const RegisterStudent: React.FC = () => {
  const [step, setStep] = useState<'attendance-mode' | 'children-count' | 'student-names' | 'parent-form' | 'enrollment-type' | 'students-form'>('attendance-mode');
  const [selectedAttendanceMode, setSelectedAttendanceMode] = useState<'in_presenza' | 'online' | null>(null);
  const [numberOfChildren, setNumberOfChildren] = useState<number>(1);
  const [studentNames, setStudentNames] = useState<string[]>([]);
  const [studentNamesInput, setStudentNamesInput] = useState<string[]>([]);
  const [studentNamesErrors, setStudentNamesErrors] = useState<string[]>([]);
  const [enrollmentTypes, setEnrollmentTypes] = useState<('rinnovo' | 'nuova_iscrizione' | null)[]>([]);
  const [currentEnrollmentIndex, setCurrentEnrollmentIndex] = useState<number>(0);
  const [currentStudentIndex, setCurrentStudentIndex] = useState<number>(0);
  const [studentsData, setStudentsData] = useState<StudentData[]>([]);
  const [parentData, setParentData] = useState<ParentFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { registerWithEmail } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const parentForm = useForm<ParentFormValues>();
  
  // Fixed array of forms to avoid hooks order violation
  const studentForm1 = useForm<StudentData>();
  const studentForm2 = useForm<StudentData>();
  const studentForm3 = useForm<StudentData>();
  const studentForm4 = useForm<StudentData>();
  const studentForm5 = useForm<StudentData>();
  
  const studentForms = [studentForm1, studentForm2, studentForm3, studentForm4, studentForm5];

  const checkCodiceFiscaleExists = async (value: string) => {
    if (!value || value.length < 16) return true;
    
    // Also check against already entered students in current registration
    for (let i = 0; i < currentStudentIndex; i++) {
      const existingStudentData = studentForms[i].getValues();
      if (existingStudentData.codiceFiscale && 
          existingStudentData.codiceFiscale.toUpperCase() === value.toUpperCase()) {
        return 'Questo Codice Fiscale è già stato inserito per un altro studente in questa registrazione.';
      }
    }
    
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('codiceFiscale', '==', value.toUpperCase()));
      const querySnapshot = await getDocs(q);
      return querySnapshot.empty || 'Questo Codice Fiscale è già registrato. Se lo studente è già iscritto, contatta la scuola per assistenza.';
    } catch (error) {
      console.error('Error checking Codice Fiscale:', error);
      return true; // Allow validation to pass if there's a network error
    }
  };

  const handleAttendanceModeSelection = (mode: 'in_presenza' | 'online') => {
    setSelectedAttendanceMode(mode);
    setStep('children-count');
  };

  const handleChildrenCountSelection = (count: number) => {
    setNumberOfChildren(count);
    setStudentNamesInput(Array(count).fill(''));
    setStudentNamesErrors(Array(count).fill(''));
    setStep('student-names');
  };


  const handleStudentNamesSubmit = (names: string[]) => {
    setStudentNames(names);
    setStep('parent-form');
  };

  const handleEnrollmentTypeSelection = (type: 'rinnovo' | 'nuova_iscrizione') => {
    const newEnrollmentTypes = [...enrollmentTypes];
    newEnrollmentTypes[currentEnrollmentIndex] = type;
    setEnrollmentTypes(newEnrollmentTypes);
    
    setCurrentStudentIndex(currentEnrollmentIndex);
    setStep('students-form');
  };

  const handleParentFormSubmit = (data: ParentFormValues) => {
    setParentData(data);
    // Initialize enrollment types array
    setEnrollmentTypes(new Array(numberOfChildren).fill(null));
    setCurrentEnrollmentIndex(0);
    setStep('enrollment-type');
  };

  const handleStudentFormSubmit = (data: StudentData) => {
    const updatedStudentsData = [...studentsData];
    updatedStudentsData[currentStudentIndex] = data;
    setStudentsData(updatedStudentsData);
    
    if (currentStudentIndex < numberOfChildren - 1) {
      setCurrentEnrollmentIndex(currentEnrollmentIndex + 1);
      setStep('enrollment-type');
    } else {
      // All students completed, proceed with registration
      handleStudentsFormSubmit();
    }
  };

  const handlePreviousStudent = () => {
    setStep('enrollment-type');
  };


  const handleStudentsFormSubmit = async () => {
    if (!parentData || !selectedAttendanceMode || enrollmentTypes.some(type => type === null)) return;

    try {
      setError(null);
      setIsLoading(true);

      // Validate all student Codice Fiscale values
      for (let i = 0; i < numberOfChildren; i++) {
        const studentData = studentForms[i].getValues();
        const cfCheck = await checkCodiceFiscaleExists(studentData.codiceFiscale);
        if (cfCheck !== true) {
          setError(`Studente ${i + 1}: ${cfCheck}`);
          setIsLoading(false);
          return;
        }
      }

      // Register parent account first
      const parentAdditionalData = {
        codiceFiscale: parentData.parentCodiceFiscale.toUpperCase(),
        phoneNumber: parentData.parentContact,
        isEnrolled: false,
        enrollmentDate: null,
        role: 'parent',
        children: [],
      };

      await registerWithEmail(
        parentData.parentEmail,
        parentData.parentPassword,
        parentData.parentName,
        'parent',
        parentAdditionalData
      );

      // Register each student
      for (let i = 0; i < numberOfChildren; i++) {
        const studentData = studentForms[i].getValues();
        
        const studentAdditionalData = {
          codiceFiscale: studentData.codiceFiscale.toUpperCase(),
          parentName: parentData.parentName,
          parentCodiceFiscale: parentData.parentCodiceFiscale.toUpperCase(),
          parentContact: parentData.parentContact,
          isEnrolled: false,
          enrollmentDate: null,
          phoneNumber: studentData.phoneNumber,
          address: studentData.address,
          city: studentData.city,
          postalCode: studentData.postalCode,
          birthDate: studentData.birthDate ? new Date(studentData.birthDate) : null,
          gender: studentData.gender,
          hasDisability: !!studentData.hasDisability && studentData.hasDisability !== 'no',
          disabilityType: studentData.hasDisability === 'no' || !studentData.hasDisability ? null : studentData.hasDisability,
          emergencyContact: studentData.emergencyContact,
          attendanceMode: selectedAttendanceMode,
          enrollmentType: enrollmentTypes[i],
        };

        const displayName = `${studentData.firstName.trim()} ${studentData.lastName.trim()}`.trim();
        // Create unique email using Codice Fiscale to avoid conflicts
        const studentEmail = `${studentData.codiceFiscale.toLowerCase()}@student.muallim.it`;
        const tempPassword = Math.random().toString(36).slice(-8);

        await registerWithEmail(
          studentEmail,
          tempPassword,
          displayName,
          'student',
          studentAdditionalData
        );
      }

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Errore di registrazione:', error);
      setError(error.message || 'Errore durante la registrazione');
    } finally {
      setIsLoading(false);
    }
  };

  const renderAttendanceModeSelection = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Modalità di Frequenza
          <motion.span 
            className="inline-block ml-2"
            animate={shouldReduceMotion ? undefined : { rotate: [0, 14, -8, 14, -4, 10, 0] }}
            transition={shouldReduceMotion ? undefined : { duration: 1.2, delay: 0.5, repeat: 0 }}
          >
            🎓
          </motion.span>
        </h2>
        <p className="text-gray-600">
          Scegli come vuoi che i tuoi figli frequentino i corsi
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.button
          onClick={() => handleAttendanceModeSelection('in_presenza')}
          className="group relative p-6 bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">In Presenza</h3>
              <p className="text-gray-600 text-sm">
                I tuoi figli frequenteranno le lezioni in aula
              </p>
            </div>
            <CheckCircle className="h-6 w-6 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        </motion.button>

        <motion.button
          onClick={() => handleAttendanceModeSelection('online')}
          className="group relative p-6 bg-white rounded-2xl border-2 border-gray-200 hover:border-purple-500 hover:shadow-lg transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Monitor className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Online</h3>
              <p className="text-gray-600 text-sm">
                I tuoi figli seguiranno le lezioni da remoto
              </p>
            </div>
            <CheckCircle className="h-6 w-6 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        </motion.button>
      </div>

      <div className="text-center">
        <Link
          to="/login"
          className="text-blue-600 hover:text-blue-500 font-medium transition-colors duration-200"
        >
          Hai già un account? Accedi
        </Link>
      </div>
    </div>
  );

  const renderChildrenCountSelection = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Quanti figli vuoi iscrivere?
          <motion.span 
            className="inline-block ml-2"
            animate={shouldReduceMotion ? undefined : { rotate: [0, 14, -8, 14, -4, 10, 0] }}
            transition={shouldReduceMotion ? undefined : { duration: 1.2, delay: 0.5, repeat: 0 }}
          >
            👨‍👩‍👧‍👦
          </motion.span>
        </h2>
        <p className="text-gray-600">
          Seleziona il numero di studenti da registrare
        </p>
        <button
          onClick={() => setStep('attendance-mode')}
          className="mt-2 text-sm text-blue-600 hover:text-blue-500 transition-colors"
        >
          ← Cambia modalità di frequenza
        </button>
      </div>

      <div className="max-w-md mx-auto">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200">
          <div className="flex items-center justify-center space-x-6">
            <motion.button
              onClick={() => setNumberOfChildren(Math.max(1, numberOfChildren - 1))}
              disabled={numberOfChildren <= 1}
              whileHover={{ scale: numberOfChildren > 1 ? 1.1 : 1 }}
              whileTap={{ scale: numberOfChildren > 1 ? 0.9 : 1 }}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold transition-all duration-200 ${
                numberOfChildren > 1 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              −
            </motion.button>
            
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {numberOfChildren}
              </div>
              <div className="text-lg text-gray-600">
                {numberOfChildren === 1 ? 'figlio' : 'figli'}
              </div>
            </div>
            
            <motion.button
              onClick={() => setNumberOfChildren(Math.min(5, numberOfChildren + 1))}
              disabled={numberOfChildren >= 5}
              whileHover={{ scale: numberOfChildren < 5 ? 1.1 : 1 }}
              whileTap={{ scale: numberOfChildren < 5 ? 0.9 : 1 }}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold transition-all duration-200 ${
                numberOfChildren < 5 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              +
            </motion.button>
          </div>
          
          <motion.button
            onClick={() => handleChildrenCountSelection(numberOfChildren)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Continua con {numberOfChildren} {numberOfChildren === 1 ? 'figlio' : 'figli'}
          </motion.button>
        </div>
        
        {numberOfChildren === 5 && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 bg-blue-50 rounded-lg p-3 border border-blue-200">
              <strong>Hai più di 5 figli?</strong><br />
              Per registrare più di 5 studenti, contatta direttamente la scuola all'indirizzo{' '}
              <a href="mailto:istitutoverroepc@gmail.com" className="text-blue-600 hover:text-blue-700 font-medium">
                istitutoverroepc@gmail.com
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const handleStudentNameChange = (index: number, value: string) => {
    const newNames = [...studentNamesInput];
    newNames[index] = value;
    setStudentNamesInput(newNames);
    
    // Clear error for this field
    const newErrors = [...studentNamesErrors];
    newErrors[index] = '';
    setStudentNamesErrors(newErrors);
  };

  const handleStudentNamesFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate names
    const newErrors = studentNamesInput.map((name) => 
      name.trim() === '' ? 'Nome è obbligatorio' : ''
    );
    
    if (newErrors.some(error => error !== '')) {
      setStudentNamesErrors(newErrors);
      return;
    }
    
    handleStudentNamesSubmit(studentNamesInput);
  };

  const renderStudentNamesForm = () => {

    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Nomi degli Studenti
            <motion.span 
              className="inline-block ml-2"
              animate={shouldReduceMotion ? undefined : { rotate: [0, 14, -8, 14, -4, 10, 0] }}
              transition={shouldReduceMotion ? undefined : { duration: 1.2, delay: 0.5, repeat: 0 }}
            >
              📝
            </motion.span>
          </h2>
          <p className="text-gray-600">
            Inserisci i nomi dei tuoi {numberOfChildren} {numberOfChildren === 1 ? 'figlio' : 'figli'}
          </p>
          <button
            onClick={() => setStep('children-count')}
            className="mt-2 text-sm text-blue-600 hover:text-blue-500 transition-colors"
          >
            ← Cambia numero figli
          </button>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8">
          <form onSubmit={handleStudentNamesFormSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: numberOfChildren }, (_, index) => (
                <div key={index}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome {numberOfChildren === 1 ? 'del figlio' : `del ${index + 1}° figlio`}
                  </label>
                  <input
                    type="text"
                    value={studentNamesInput[index] || ''}
                    onChange={(e) => handleStudentNameChange(index, e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder={`Es. ${index === 0 ? 'Marco' : index === 1 ? 'Sofia' : index === 2 ? 'Luca' : index === 3 ? 'Giulia' : 'Alessandro'}`}
                  />
                  {studentNamesErrors[index] && (
                    <p className="text-red-500 text-sm mt-1">{studentNamesErrors[index]}</p>
                  )}
                </div>
              ))}
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-8 rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Continua con i dati del genitore
            </motion.button>
          </form>
        </div>
      </div>
    );
  };

  const renderEnrollmentTypeSelection = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Tipo di Iscrizione
          <motion.span 
            className="inline-block ml-2"
            animate={shouldReduceMotion ? undefined : { rotate: [0, 14, -8, 14, -4, 10, 0] }}
            transition={shouldReduceMotion ? undefined : { duration: 1.2, delay: 0.5, repeat: 0 }}
          >
            📋
          </motion.span>
        </h2>
        <p className="text-gray-600">
          Seleziona il tipo di iscrizione per <span className="font-semibold text-blue-600">{studentNames[currentEnrollmentIndex]}</span>
        </p>
        <div className="text-sm text-gray-500 mt-2">
          Studente {currentEnrollmentIndex + 1} di {numberOfChildren}
        </div>
        <div className="flex gap-4 justify-center mt-2">
          {currentEnrollmentIndex > 0 && (
            <button
              onClick={() => setCurrentEnrollmentIndex(currentEnrollmentIndex - 1)}
              className="text-sm text-blue-600 hover:text-blue-500 transition-colors"
            >
              ← Studente precedente
            </button>
          )}
          <button
            onClick={() => setStep('parent-form')}
            className="text-sm text-blue-600 hover:text-blue-500 transition-colors"
          >
            ← Modifica dati genitore
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.button
          onClick={() => handleEnrollmentTypeSelection('nuova_iscrizione')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 hover:border-blue-400 rounded-2xl p-8 text-center transition-all duration-300 hover:shadow-lg group"
        >
          <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">
            🆕
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Nuova Iscrizione
          </h3>
          <p className="text-gray-600 text-sm">
            Per studenti che si iscrivono per la prima volta alla scuola
          </p>
        </motion.button>

        <motion.button
          onClick={() => handleEnrollmentTypeSelection('rinnovo')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 hover:border-green-400 rounded-2xl p-8 text-center transition-all duration-300 hover:shadow-lg group"
        >
          <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">
            🔄
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Rinnovo
          </h3>
          <p className="text-gray-600 text-sm">
            Per studenti già iscritti che rinnovano l'iscrizione
          </p>
        </motion.button>
      </div>
    </div>
  );

  const renderParentForm = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            Dati del Genitore
            <motion.span 
              className="inline-block ml-2"
              animate={shouldReduceMotion ? undefined : { rotate: [0, 14, -8, 14, -4, 10, 0] }}
              transition={shouldReduceMotion ? undefined : { duration: 1.2, delay: 0.5, repeat: 0 }}
            >
              👨‍💼
            </motion.span>
          </h2>
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-3 mb-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                    {numberOfChildren}
                  </div>
                  <span className="text-gray-800 font-medium text-sm">
                    {numberOfChildren === 1 ? 'Figlio' : 'Figli'}
                  </span>
                </div>
                <div className="h-3 w-px bg-gray-200"></div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${selectedAttendanceMode === 'in_presenza' ? 'bg-emerald-500' : 'bg-violet-500'} shadow-sm`}></div>
                  <span className="text-gray-800 font-medium text-sm">
                    {selectedAttendanceMode === 'in_presenza' ? 'In Presenza' : 'Online'}
                  </span>
                </div>
              </div>
              <motion.button
                onClick={() => setStep('children-count')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="text-blue-600 hover:text-blue-700 text-xs font-medium hover:bg-blue-50/80 px-2.5 py-1 rounded-md transition-all duration-200 border border-transparent hover:border-blue-200"
              >
                Modifica
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 rounded-3xl" />
        
        <form onSubmit={parentForm.handleSubmit(handleParentFormSubmit)} className="relative space-y-6">
          <div className="space-y-6">
            {/* Nome e Cognome - Full width on mobile */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome e Cognome
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...parentForm.register('parentName', { required: 'Nome e cognome sono obbligatori' })}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                  placeholder="Inserisci nome e cognome"
                />
              </div>
              {parentForm.formState.errors.parentName && (
                <p className="text-sm text-red-600 flex items-center mt-1">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {parentForm.formState.errors.parentName.message}
                </p>
              )}
            </div>

            {/* Codice Fiscale */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Codice Fiscale
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...parentForm.register('parentCodiceFiscale', { 
                    required: 'Codice Fiscale è obbligatorio',
                    pattern: {
                      value: /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/,
                      message: 'Formato Codice Fiscale non valido'
                    }
                  })}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70 uppercase"
                  placeholder="RSSMRA80A01H501Z"
                />
              </div>
              {parentForm.formState.errors.parentCodiceFiscale && (
                <p className="text-sm text-red-600 flex items-center mt-1">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {parentForm.formState.errors.parentCodiceFiscale.message}
                </p>
              )}
            </div>

            {/* Email and Phone - Side by side on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    {...parentForm.register('parentEmail', { 
                      required: 'Email è obbligatoria',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Email non valida'
                      }
                    })}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                    placeholder="email@esempio.com"
                  />
                </div>
                {parentForm.formState.errors.parentEmail && (
                  <p className="text-sm text-red-600 flex items-center mt-1">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {parentForm.formState.errors.parentEmail.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefono
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...parentForm.register('parentContact', { required: 'Telefono è obbligatorio' })}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                    placeholder="+39 123 456 7890"
                  />
                </div>
                {parentForm.formState.errors.parentContact && (
                  <p className="text-sm text-red-600 flex items-center mt-1">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {parentForm.formState.errors.parentContact.message}
                  </p>
                )}
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...parentForm.register('parentPassword', { 
                    required: 'Password è obbligatoria',
                    minLength: {
                      value: 6,
                      message: 'Password deve essere di almeno 6 caratteri'
                    }
                  })}
                  className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                  placeholder="Inserisci password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {parentForm.formState.errors.parentPassword && (
                <p className="text-sm text-red-600 flex items-center mt-1">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {parentForm.formState.errors.parentPassword.message}
                </p>
              )}
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3"
            >
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </motion.div>
          )}

          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            Continua con i dati degli studenti
          </motion.button>
        </form>
      </motion.div>
    </div>
  );

  const renderStudentsForm = () => {
    const currentForm = studentForms[currentStudentIndex];
    
    return (
      <div className="space-y-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Dati dello Studente
            <motion.span 
              className="inline-block ml-2"
              animate={shouldReduceMotion ? undefined : { rotate: [0, 14, -8, 14, -4, 10, 0] }}
              transition={shouldReduceMotion ? undefined : { duration: 1.2, delay: 0.5, repeat: 0 }}
            >
              🎒
            </motion.span>
          </h2>
          
          {/* Progress indicator */}
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-3 mb-4 border border-gray-100 shadow-sm inline-block">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                    {currentStudentIndex + 1}
                  </div>
                  <span className="text-gray-800 font-medium text-sm">
                    {studentNames[currentStudentIndex] ? studentNames[currentStudentIndex] : `Studente ${currentStudentIndex + 1}`}
                  </span>
                </div>
                <div className="h-3 w-px bg-gray-200"></div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600 text-xs">
                    {currentStudentIndex + 1} di {numberOfChildren}
                  </span>
                </div>
              </div>
          </div>
          
          <p className="text-gray-600">
            Inserisci i dati per {studentNames[currentStudentIndex] || `lo studente ${currentStudentIndex + 1}`}
          </p>
          <button
            onClick={() => setStep('parent-form')}
            className="mt-2 text-sm text-blue-600 hover:text-blue-500 transition-colors"
          >
            ← Modifica dati genitore
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">
            {studentNames[currentStudentIndex] || `Studente ${currentStudentIndex + 1}`}
          </h3>

          <form onSubmit={currentForm.handleSubmit(handleStudentFormSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Inserisci nome"
                  {...currentForm.register('firstName', { required: 'Nome è obbligatorio' })}
                />
                {currentForm.formState.errors.firstName && (
                  <p className="text-red-500 text-sm mt-1">{currentForm.formState.errors.firstName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cognome</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Inserisci cognome"
                  {...currentForm.register('lastName', { required: 'Cognome è obbligatorio' })}
                />
                {currentForm.formState.errors.lastName && (
                  <p className="text-red-500 text-sm mt-1">{currentForm.formState.errors.lastName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Codice Fiscale</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors uppercase"
                  placeholder="RSSMRA80A01H501Z"
                  {...currentForm.register('codiceFiscale', {
                    required: 'Codice Fiscale è obbligatorio',
                    pattern: {
                      value: /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/,
                      message: 'Formato Codice Fiscale non valido',
                    },
                    validate: {
                      checkExists: async (value) => {
                        if (!value || value.length < 16) return true;
                        return await checkCodiceFiscaleExists(value);
                      }
                    },
                  })}
                  onBlur={() => {
                    // Trigger validation on blur
                    currentForm.trigger('codiceFiscale');
                  }}
                />
                {currentForm.formState.errors.codiceFiscale && (
                  <p className="text-red-500 text-sm mt-1">{currentForm.formState.errors.codiceFiscale.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data di Nascita</label>
                <input
                  type="date"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  {...currentForm.register('birthDate', { required: 'Data di nascita è obbligatoria' })}
                />
                {currentForm.formState.errors.birthDate && (
                  <p className="text-red-500 text-sm mt-1">{currentForm.formState.errors.birthDate.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Genere</label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  {...currentForm.register('gender', { required: 'Genere è obbligatorio' })}
                >
                  <option value="">Seleziona genere</option>
                  <option value="M">Maschio</option>
                  <option value="F">Femmina</option>
                </select>
                {currentForm.formState.errors.gender && (
                  <p className="text-red-500 text-sm mt-1">{currentForm.formState.errors.gender.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Telefono (opzionale)</label>
                <input
                  type="tel"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="+39 123 456 7890"
                  {...currentForm.register('phoneNumber')}
                />
                {currentForm.formState.errors.phoneNumber && (
                  <p className="text-red-500 text-sm mt-1">{currentForm.formState.errors.phoneNumber.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Ha disabilità o necessita supporto?</label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  {...currentForm.register('hasDisability')}
                >
                  <option value="">Seleziona un'opzione</option>
                  <option value="no">No</option>
                  <option value="fisica">Disabilità fisica</option>
                  <option value="cognitiva">Disabilità cognitiva</option>
                  <option value="sensoriale">Disabilità sensoriale</option>
                  <option value="dsa">Disturbi Specifici dell'Apprendimento (DSA)</option>
                  <option value="adhd">ADHD</option>
                  <option value="altro">Altro</option>
                </select>
                {currentForm.formState.errors.hasDisability && (
                  <p className="text-red-500 text-sm mt-1">{currentForm.formState.errors.hasDisability.message}</p>
                )}
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between items-center pt-6">
              <motion.button
                type="button"
                onClick={handlePreviousStudent}
                disabled={currentStudentIndex === 0}
                whileHover={{ scale: currentStudentIndex === 0 ? 1 : 1.02 }}
                whileTap={{ scale: currentStudentIndex === 0 ? 1 : 0.98 }}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  currentStudentIndex === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ← Precedente
              </motion.button>

              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-8 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Caricamento...</span>
                  </div>
                ) : currentStudentIndex === numberOfChildren - 1 ? (
                  'Completa Registrazione'
                ) : (
                  'Prossimo →'
                )}
              </motion.button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-2xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-pink-400/20 to-orange-600/20 rounded-full blur-2xl" />
      </div>

      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24 relative">
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mx-auto w-full max-w-4xl"
        >
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center justify-center group">
              <motion.div 
                className="w-14 h-14 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center mr-3 shadow-xl"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <GraduationCap className="h-7 w-7 text-white" />
              </motion.div>
              <span className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Muallim
              </span>
            </Link>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {step === 'attendance-mode' && renderAttendanceModeSelection()}
              {step === 'children-count' && renderChildrenCountSelection()}
              {step === 'student-names' && renderStudentNamesForm()}
              {step === 'enrollment-type' && renderEnrollmentTypeSelection()}
              {step === 'parent-form' && renderParentForm()}
              {step === 'students-form' && renderStudentsForm()}
            </motion.div>
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="mt-8 text-center"
          >
            <p className="text-xs text-gray-500 mb-2">
              Accedendo accetti i nostri{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700 transition-colors">
                Termini di Servizio
              </a>
              {' '}e la{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700 transition-colors">
                Privacy Policy
              </a>
            </p>
            <p className="text-xs text-gray-400">
              In caso di problemi contattare: istitutoaverroepc@gmail.com
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};
