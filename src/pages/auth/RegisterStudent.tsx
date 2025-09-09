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
  CheckCircle,
  MapPin,
  Building,
  Hash,
  X
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';

interface StudentData {
  firstName: string;
  lastName: string;
  codiceFiscale: string;
  birthDate?: string;
  gender?: string;
  hasDisability?: string;
  previousYearClass?: string;
  currentClass?: string;
  italianSchoolClass?: string;
}

interface ParentFormValues {
  parentFirstName: string;
  parentLastName: string;
  parentCodiceFiscale?: string;
  parentContact: string;
  parentEmail: string;
  parentPassword: string;
  parentPasswordConfirm: string;
  parentAddress: string;
  parentCity: string;
  parentPostalCode: string;
}

type TurnoOption = 'sabato_pomeriggio' | 'sabato_sera' | 'domenica_mattina' | 'domenica_pomeriggio';

export const RegisterStudent: React.FC = () => {
  const [step, setStep] = useState<'attendance-mode' | 'info' | 'terms' | 'children-count' | 'student-names' | 'parent-form' | 'enrollment-type' | 'students-form' | 'turno-selection' | 'review'>('attendance-mode');
  const [selectedAttendanceMode, setSelectedAttendanceMode] = useState<'in_presenza' | 'online' | null>(null);
  const [selectedTurni, setSelectedTurni] = useState<TurnoOption[]>([]);
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
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const navigate = useNavigate();
  const { registerWithEmail, currentUser } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const parentForm = useForm<ParentFormValues>();
  
  // Fixed array of forms to avoid hooks order violation
  const studentForm1 = useForm<StudentData>();
  const studentForm2 = useForm<StudentData>();
  const studentForm3 = useForm<StudentData>();
  const studentForm4 = useForm<StudentData>();
  const studentForm5 = useForm<StudentData>();
  
  const studentForms = [studentForm1, studentForm2, studentForm3, studentForm4, studentForm5];

  const checkEmailExists = async (email: string) => {
    if (!email) return true;
    
    try {
      // Check in users collection
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email.toLowerCase()));
      const querySnapshot = await getDocs(q);
      return querySnapshot.empty || 'Questa email è già registrata. Usa un\'altra email o accedi con le tue credenziali esistenti.';
    } catch (error) {
      console.error('Error checking email:', error);
      return true; // Allow validation to pass if there's a network error
    }
  };

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
      // Check in both users and students collections
      const usersRef = collection(db, 'users');
      const studentsRef = collection(db, 'students');
      
      const [usersQuery, studentsQuery] = await Promise.all([
        getDocs(query(usersRef, where('codiceFiscale', '==', value.toUpperCase()))),
        getDocs(query(studentsRef, where('codiceFiscale', '==', value.toUpperCase())))
      ]);
      
      if (!usersQuery.empty || !studentsQuery.empty) {
        return 'Questo Codice Fiscale è già registrato. Se lo studente è già iscritto, contatta la scuola per assistenza.';
      }
      
      return true;
    } catch (error) {
      console.error('Error checking Codice Fiscale:', error);
      return true; // Allow validation to pass if there's a network error
    }
  };

  const handleAttendanceModeSelection = (mode: 'in_presenza' | 'online') => {
    setSelectedAttendanceMode(mode);
    setTermsAccepted(false);
    setStep('info');
  };

  const handleTurnoToggle = (turno: TurnoOption) => {
    setSelectedTurni(prev => 
      prev.includes(turno) 
        ? prev.filter(t => t !== turno)
        : [...prev, turno]
    );
  };

  const handleTurnoNext = () => {
    if (selectedTurni.length === 0) {
      setError('Seleziona almeno un turno');
      return;
    }
    setError(null);
    setStep('review');
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

  const handleStudentFormSubmit = async (data: StudentData) => {
    // Check if codice fiscale already exists in database
    try {
      const studentsRef = collection(db, 'students');
      const q = query(studentsRef, where('codiceFiscale', '==', data.codiceFiscale));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setError(`Uno studente con codice fiscale ${data.codiceFiscale} è già registrato nel sistema.`);
        return;
      }
    } catch (error) {
      console.error('Error checking duplicate codice fiscale:', error);
      setError('Errore durante la verifica del codice fiscale. Riprova.');
      return;
    }

    const updatedStudentsData = [...studentsData];
    updatedStudentsData[currentStudentIndex] = data;
    setStudentsData(updatedStudentsData);
    
    if (currentStudentIndex < numberOfChildren - 1) {
      setCurrentEnrollmentIndex(currentEnrollmentIndex + 1);
      setStep('enrollment-type');
    } else {
      // All students completed, check if we need turno selection before review
      const allNewEnrollments = enrollmentTypes.every(type => type === 'nuova_iscrizione');
      const needsTurnoSelection = selectedAttendanceMode === 'in_presenza' && allNewEnrollments;

      if (needsTurnoSelection) {
        setStep('turno-selection');
      } else {
        setStep('review');
      }
    }
  };

  const handlePreviousStudent = () => {
    if (currentStudentIndex > 0) {
      // Go to previous student's enrollment type selection
      setCurrentStudentIndex(currentStudentIndex - 1);
      setCurrentEnrollmentIndex(currentStudentIndex - 1);
      setStep('enrollment-type');
    } else {
      // Go back to enrollment type selection for current student
      setStep('enrollment-type');
    }
  };


  const handleStudentsFormSubmit = async () => {
    if (!parentData || !selectedAttendanceMode || enrollmentTypes.some(type => type === null)) return;
    
    // This function is no longer used as the logic has been moved to handleStudentFormSubmit
    // Keeping for backward compatibility but should not be called
    setStep('review');
  };

  const handleFinalRegistration = async () => {
    console.log('handleFinalRegistration called');
    console.log('parentData:', parentData);
    console.log('selectedAttendanceMode:', selectedAttendanceMode);
    console.log('enrollmentTypes:', enrollmentTypes);
    
    if (!parentData || !selectedAttendanceMode || enrollmentTypes.some(type => type === null)) {
      console.log('Early return - missing required data');
      return;
    }

    try {
      console.log('Starting registration process...');
      setError(null);
      setIsLoading(true);

      // Validate all student Codice Fiscale values
      const allCodiciFiscali: string[] = [];
      for (let i = 0; i < numberOfChildren; i++) {
        const studentData = studentForms[i].getValues();
        console.log(`Student ${i + 1} data:`, studentData);
        
        if (!studentData.codiceFiscale) {
          console.log(`Student ${i + 1} missing Codice Fiscale`);
          setError(`Studente ${i + 1}: Codice Fiscale mancante`);
          setIsLoading(false);
          return;
        }
        
        // Check for duplicates within current registration
        const cfUpper = studentData.codiceFiscale.toUpperCase();
        if (allCodiciFiscali.includes(cfUpper)) {
          setError(`Studente ${i + 1}: Questo Codice Fiscale è già stato inserito per un altro studente in questa registrazione.`);
          setIsLoading(false);
          return;
        }
        allCodiciFiscali.push(cfUpper);
        
        // Check if CF exists in database
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('codiceFiscale', '==', cfUpper));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            setError(`Studente ${i + 1}: Questo Codice Fiscale è già registrato. Se lo studente è già iscritto, contatta la scuola per assistenza.`);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error('Error checking Codice Fiscale:', error);
          // Continue with registration if there's a network error
        }
      }

      // Register parent account first
      const parentAdditionalData = {
        codiceFiscale: parentData.parentCodiceFiscale ? parentData.parentCodiceFiscale.toUpperCase() : null,
        phoneNumber: parentData.parentContact,
        address: parentData.parentAddress,
        city: parentData.parentCity,
        postalCode: parentData.parentPostalCode,
        isEnrolled: false,
        enrollmentDate: null,
        role: 'parent',
        children: [],
        registrationDate: new Date(),
      };

      // Register parent and capture their user ID before they get signed out
      await registerWithEmail(
        parentData.parentEmail,
        parentData.parentPassword,
        `${parentData.parentFirstName} ${parentData.parentLastName}`.trim(),
        'parent',
        parentAdditionalData
      );

      // Get parent's user ID by querying the database with their email
      const parentQuery = query(collection(db, 'users'), where('email', '==', parentData.parentEmail));
      const parentSnapshot = await getDocs(parentQuery);
      let parentUserId = null;
      if (!parentSnapshot.empty) {
        const parentDoc = parentSnapshot.docs[0];
        parentUserId = parentDoc.id; // Use Firestore document ID
        console.log('Parent ID found:', parentUserId);
        console.log('Parent data:', parentDoc.data());
      } else {
        console.error('Parent not found in database!');
        throw new Error('Errore: genitore non trovato nel database');
      }

      // Register each student in the students collection and collect their IDs
      const childrenIds = [];
      for (let i = 0; i < numberOfChildren; i++) {
        const studentData = studentForms[i].getValues();
        
        const displayName = `${studentData.firstName.trim()} ${studentData.lastName.trim()}`.trim();
        // Create unique email using Codice Fiscale to avoid conflicts
        const studentEmail = `${studentData.codiceFiscale.toLowerCase()}@student.muallim.it`;
        const tempPassword = Math.random().toString(36).slice(-8);

        // Create student Firebase authentication account only (no Firestore document in users)
        await createUserWithEmailAndPassword(auth, studentEmail, tempPassword);
        // Sign out immediately to prevent auto-login
        await signOut(auth);

        // Create complete student record in students collection
        const studentRecord = {
          parentId: parentUserId,
          // Personal information
          firstName: studentData.firstName.trim(),
          lastName: studentData.lastName.trim(),
          displayName: displayName,
          codiceFiscale: studentData.codiceFiscale.toUpperCase(),
          birthDate: studentData.birthDate ? (() => {
            const [day, month, year] = studentData.birthDate.split('/');
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          })() : new Date(),
          gender: studentData.gender as 'M' | 'F',
          // Contact information (inherited from parent)
          phoneNumber: parentData.parentContact || '',
          address: parentData.parentAddress || '',
          city: parentData.parentCity || '',
          postalCode: parentData.parentPostalCode || '',
          // Academic information
          attendanceMode: selectedAttendanceMode,
          enrollmentType: enrollmentTypes[i],
          previousYearClass: enrollmentTypes[i] === 'rinnovo' ? studentData.previousYearClass || '' : '',
          currentClass: enrollmentTypes[i] === 'nuova_iscrizione' ? 'NA' : (studentData.previousYearClass || 'NA'),
          italianSchoolClass: studentData.italianSchoolClass || '',
          selectedTurni: selectedAttendanceMode === 'in_presenza' ? selectedTurni : [],
          // Special needs
          hasDisability: !!studentData.hasDisability && studentData.hasDisability !== 'no',
          // Parent reference only - no duplicated data
          // Registration metadata
          registrationDate: new Date(),
          isEnrolled: false,
          enrollmentDate: null,
          // Account status
          accountStatus: 'pending_approval' as const,
          // Authentication
          email: studentEmail,
          createdAt: new Date(),
        };

        // Save student to students collection
        console.log('Saving student to students collection:', studentRecord);
        try {
          const studentDocRef = await addDoc(collection(db, 'students'), studentRecord);
          console.log('Student saved successfully with ID:', studentDocRef.id);
        } catch (error) {
          console.error('Error saving student:', error);
          throw error;
        }
        
        // Collect student info for parent's children array
        childrenIds.push({
          name: displayName,
          codiceFiscale: studentData.codiceFiscale.toUpperCase(),
          email: studentEmail
        });
      }

      // Update parent record with children information after all students are registered
      if (childrenIds.length > 0 && parentUserId) {
        await updateDoc(doc(db, 'users', parentUserId), {
          children: childrenIds
        });
      }

      // Navigate to approval pending page instead of showing success popup
      console.log('Registration completed successfully, navigating to approval pending...');
      navigate('/approval-pending');
    } catch (error: any) {
      console.error('Errore di registrazione:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        name: error.name
      });
      
      // Provide user-friendly error messages for common Firebase auth errors
      let userFriendlyMessage = error.message || 'Errore durante la registrazione';
      
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            userFriendlyMessage = 'L\'indirizzo email è già in uso. Utilizza un\'altra email o accedi con le credenziali esistenti.';
            break;
          case 'auth/weak-password':
            userFriendlyMessage = 'La password è troppo debole. Utilizza almeno 6 caratteri.';
            break;
          case 'auth/invalid-email':
            userFriendlyMessage = 'L\'indirizzo email non è valido.';
            break;
          case 'auth/operation-not-allowed':
            userFriendlyMessage = 'La registrazione con email/password non è abilitata. Contatta l\'amministratore.';
            break;
          case 'auth/network-request-failed':
            userFriendlyMessage = 'Errore di connessione. Verifica la tua connessione internet e riprova.';
            break;
          case 'auth/too-many-requests':
            userFriendlyMessage = 'Troppi tentativi di registrazione. Riprova più tardi.';
            break;
          case 'permission-denied':
            userFriendlyMessage = 'Accesso negato al database. Verifica le tue autorizzazioni o contatta l\'amministratore.';
            break;
          case 'unavailable':
            userFriendlyMessage = 'Il servizio è temporaneamente non disponibile. Riprova più tardi.';
            break;
          default:
            // Keep the original message for unknown errors but make it more user-friendly
            if (error.message && error.message.includes('Firebase')) {
              userFriendlyMessage = 'Errore del sistema di autenticazione. Riprova o contatta l\'assistenza.';
            }
            break;
        }
      }
      
      setError(userFriendlyMessage);
      // Don't navigate on error, stay on the form to show the error
    } finally {
      console.log('Registration process finished, setting loading to false');
      setIsLoading(false);
    }
  };

  const renderReviewForm = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Riepilogo Registrazione
          <motion.span 
            className="inline-block ml-2"
            animate={shouldReduceMotion ? undefined : { rotate: [0, 14, -8, 14, -4, 10, 0] }}
            transition={shouldReduceMotion ? undefined : { duration: 1.2, delay: 0.5, repeat: 0 }}
          >
            📋
          </motion.span>
        </h2>
        <p className="text-gray-600">
          Controlla tutti i dati inseriti prima di completare la registrazione
        </p>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 space-y-8">
        
        {/* Attendance Mode */}
        <div className="border-b border-gray-200 pb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Modalità di Frequenza</h3>
            <button
              onClick={() => setStep('attendance-mode')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Modifica
            </button>
          </div>
          <p className="text-gray-700">
            {selectedAttendanceMode === 'in_presenza' ? 'In Presenza' : 'Online'}
          </p>
          {selectedAttendanceMode === 'in_presenza' && selectedTurni.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-gray-600">Turni selezionati:</p>
              <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                {selectedTurni.map(turno => (
                  <li key={turno}>
                    {turno === 'sabato_pomeriggio' && 'Sabato Pomeriggio'}
                    {turno === 'sabato_sera' && 'Sabato Sera'}
                    {turno === 'domenica_mattina' && 'Domenica Mattina'}
                    {turno === 'domenica_pomeriggio' && 'Domenica Pomeriggio'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Parent Information */}
        <div className="border-b border-gray-200 pb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Dati del Genitore</h3>
            <button
              onClick={() => setStep('parent-form')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Modifica
            </button>
          </div>
          {parentData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Nome:</span>
                <p className="text-gray-900">{parentData.parentFirstName} {parentData.parentLastName}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Email:</span>
                <p className="text-gray-900">{parentData.parentEmail}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Telefono:</span>
                <p className="text-gray-900">{parentData.parentContact}</p>
              </div>
              {parentData.parentCodiceFiscale && (
                <div>
                  <span className="font-medium text-gray-600">Codice Fiscale:</span>
                  <p className="text-gray-900">{parentData.parentCodiceFiscale}</p>
                </div>
              )}
              {parentData.parentAddress && (
                <div className="md:col-span-2">
                  <span className="font-medium text-gray-600">Indirizzo:</span>
                  <p className="text-gray-900">
                    {parentData.parentAddress}
                    {parentData.parentCity && `, ${parentData.parentCity}`}
                    {parentData.parentPostalCode && ` ${parentData.parentPostalCode}`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Students Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Studenti ({numberOfChildren})</h3>
          {studentsData.map((student, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4 last:mb-0">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium text-gray-900">
                  {studentNames[index]} - {enrollmentTypes[index] === 'rinnovo' ? 'Rinnovo' : 'Nuova Iscrizione'}
                </h4>
                <button
                  onClick={() => {
                    setCurrentStudentIndex(index);
                    setCurrentEnrollmentIndex(index);
                    setStep('enrollment-type');
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Modifica
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Nome completo:</span>
                  <p className="text-gray-900">{student.firstName} {student.lastName}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Codice Fiscale:</span>
                  <p className="text-gray-900">{student.codiceFiscale}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Data di nascita:</span>
                  <p className="text-gray-900">{student.birthDate}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Genere:</span>
                  <p className="text-gray-900">{student.gender === 'M' ? 'Maschio' : 'Femmina'}</p>
                </div>
                {student.italianSchoolClass && (
                  <div>
                    <span className="font-medium text-gray-600">Classe Scuola Italiana:</span>
                    <p className="text-gray-900">{student.italianSchoolClass}</p>
                  </div>
                )}
                {student.hasDisability && (
                  <div className="md:col-span-2">
                    <span className="font-medium text-gray-600">Disabilità:</span>
                    <p className="text-gray-900">{student.hasDisability}</p>
                  </div>
                )}
                {enrollmentTypes[index] === 'rinnovo' && student.previousYearClass && (
                  <div className="md:col-span-2">
                    <span className="font-medium text-gray-600">Classe precedente:</span>
                    <p className="text-gray-900">{student.previousYearClass}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3"
          >
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 text-sm font-medium mb-1">Errore durante la registrazione</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-center pt-6 gap-4">
          <motion.button
            type="button"
            onClick={() => setStep('students-form')}
            className="flex items-center px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
          >
            ← Modifica Studenti
          </motion.button>

          <motion.button
            type="button"
            onClick={handleFinalRegistration}
            disabled={isLoading}
            className="flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Registrazione in corso...
              </>
            ) : (
              'Completa Registrazione'
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );

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
          Vorresti iscrivere i tuoi figli in presenza oppure online?
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

  const renderTurnoSelection = () => {
    const turnoOptions = [
      {
        id: 'sabato_pomeriggio' as TurnoOption,
        title: 'Sabato pomeriggio',
        time: '14:00 - 17:00'
      },
      {
        id: 'sabato_sera' as TurnoOption,
        title: 'Sabato sera',
        time: '17:00 - 20:30'
      },
      {
        id: 'domenica_mattina' as TurnoOption,
        title: 'Domenica mattina',
        time: '9:30 - 13:00'
      },
      {
        id: 'domenica_pomeriggio' as TurnoOption,
        title: 'Domenica pomeriggio',
        time: '14:00 - 17:30'
      }
    ];

    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Scegli i Turni
          </h2>
          <p className="text-gray-600">
            Seleziona uno o più turni per i tuoi figli
          </p>
        </div>

        <div className="space-y-3">
          {turnoOptions.map((turno) => {
            const isSelected = selectedTurni.includes(turno.id);
            return (
              <button
                key={turno.id}
                onClick={() => handleTurnoToggle(turno.id)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{turno.title}</h3>
                    <p className="text-sm text-gray-600">{turno.time}</p>
                  </div>
                  <CheckCircle className={`h-5 w-5 ${
                    isSelected ? 'text-blue-500' : 'text-gray-300'
                  }`} />
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-3">
          <button
            onClick={() => {
              // Go back to the last student's form
              setCurrentStudentIndex(numberOfChildren - 1);
              setCurrentEnrollmentIndex(numberOfChildren - 1);
              setStep('students-form');
            }}
            className="w-full sm:w-auto px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← Precedente
          </button>
          
          <button
            onClick={handleTurnoNext}
            disabled={selectedTurni.length === 0}
            className={`w-full sm:w-auto px-6 py-3 rounded-lg font-medium transition-colors ${
              selectedTurni.length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Continua →
          </button>
        </div>
      </div>
    );
  };

  const renderChildrenCountSelection = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Quanti figli vuoi iscrivere?
        </h2>
        <p className="text-gray-600">
          Seleziona il numero di studenti da registrare
        </p>
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
                {numberOfChildren === 1 ? 'Figlio/a' : 'Figli'}
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
          
          <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-3">
            <button
              onClick={() => setStep('turno-selection')}
              className="w-full sm:w-auto px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50 order-2 sm:order-1"
            >
              ← Precedente
            </button>
            
            <motion.button
              onClick={() => handleChildrenCountSelection(numberOfChildren)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 order-1 sm:order-2"
            >
              Continua con {numberOfChildren} {numberOfChildren === 1 ? 'figlio/a' : 'figli'}
            </motion.button>
          </div>
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
          </h2>
          <p className="text-gray-600">
            Inserisci i nomi dei tuoi {numberOfChildren} {numberOfChildren === 1 ? 'Figlio/a' : 'figli'}
          </p>
        </div>

        <div className={`bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 ${numberOfChildren === 1 ? 'p-4 sm:p-6 max-w-lg mx-auto' : 'p-6 sm:p-8'}`}>
          <form onSubmit={handleStudentNamesFormSubmit} className="space-y-6">
            <div className={`grid gap-6 ${numberOfChildren === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-1 md:grid-cols-2'}`}>
              {Array.from({ length: numberOfChildren }, (_, index) => (
                <div key={index}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome {numberOfChildren === 1 ? 'del Figlio/a' : `del ${index + 1}° Figlio/a`}
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

            <div className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-3">
              <button
                type="button"
                onClick={() => setStep('children-count')}
                className="w-full sm:w-auto px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50 order-2 sm:order-1"
              >
                ← Precedente
              </button>
              
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-8 rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 order-1 sm:order-2"
              >
                Continua con i dati del genitore
              </motion.button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderEnrollmentTypeSelection = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-medium text-gray-900 mb-2">
          Scegli tipologia di iscrizione per <span className="font-bold text-6xl text-blue-600">{studentNames[currentEnrollmentIndex]}</span>.
          <motion.span 
            className="inline-block ml-2"
            animate={shouldReduceMotion ? undefined : { rotate: [0, 14, -8, 14, -4, 10, 0] }}
            transition={shouldReduceMotion ? undefined : { duration: 1.2, delay: 0.5, repeat: 0 }}
          >
            📋
          </motion.span>
        </h2>
        <div className="text-sm text-gray-500 mt-2">
          Studente {currentEnrollmentIndex + 1} di {numberOfChildren}
        </div>
        <div className="flex justify-center mt-4">
          <button
            onClick={() => {
              if (currentEnrollmentIndex > 0) {
                setCurrentEnrollmentIndex(currentEnrollmentIndex - 1);
              } else {
                setStep('parent-form');
              }
            }}
            className="w-full sm:w-auto px-6 py-3 text-blue-600 hover:text-blue-500 transition-colors border border-blue-300 rounded-lg hover:bg-blue-50"
          >
            ← Precedente
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
            Per studenti che si iscrivono per la prima volta all'istituto
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
            Per studenti già iscritti l'anno scorso e che rinnovano l'iscrizione per il nuovo anno scolastico.
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
                    {numberOfChildren === 1 ? 'Figlio/a' : 'Figli'}
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
            {/* Nome e Cognome - Side by side on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome del genitore
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...parentForm.register('parentFirstName', { required: 'Nome del genitore è obbligatorio' })}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                    placeholder="Inserisci nome"
                  />
                </div>
                {parentForm.formState.errors.parentFirstName && (
                  <p className="text-sm text-red-600 flex items-center mt-1">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {parentForm.formState.errors.parentFirstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cognome del genitore
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...parentForm.register('parentLastName', { required: 'Cognome del genitore è obbligatorio' })}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                    placeholder="Inserisci cognome"
                  />
                </div>
                {parentForm.formState.errors.parentLastName && (
                  <p className="text-sm text-red-600 flex items-center mt-1">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {parentForm.formState.errors.parentLastName.message}
                  </p>
                )}
              </div>
            </div>


            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email del genitore
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
                      message: 'Formato email non valido'
                    },
                    validate: checkEmailExists
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

            {/* Phone Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefono del genitore che riceverà le comunicazioni (compiti, eventi,ecc..)
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
              <p className="text-gray-700 text-xs mt-1 flex items-center">
                <span className="mr-1">📱</span>
                Questo numero deve avere accesso a WhatsApp per le comunicazioni di gruppo
              </p>
            </div>

            {/* Password Fields - Side by side on larger screens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password del genitore
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
                <p className="text-gray-700 text-xs mt-1 flex items-center">
                  <span className="mr-1">💡</span>
                  Si raccomanda di salvare la password in quanto sarà necessaria per effettuare l'accesso in futuro
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reinserisci la password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...parentForm.register('parentPasswordConfirm', { 
                      required: 'Conferma password è obbligatoria',
                      validate: (value) => {
                        const password = parentForm.getValues('parentPassword');
                        return value === password || 'Le password non corrispondono';
                      }
                    })}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                    placeholder="Conferma password"
                  />
                </div>
                {parentForm.formState.errors.parentPasswordConfirm && (
                  <p className="text-sm text-red-600 flex items-center mt-1">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {parentForm.formState.errors.parentPasswordConfirm.message}
                  </p>
                )}
              </div>
            </div>

            {/* Address Fields */}
            <div className="space-y-4">
              {/* Address */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Indirizzo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...parentForm.register('parentAddress', { 
                      required: 'Indirizzo è obbligatorio'
                    })}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                    placeholder="Via/Piazza, numero civico"
                  />
                </div>
                {parentForm.formState.errors.parentAddress && (
                  <p className="text-sm text-red-600 flex items-center mt-1">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {parentForm.formState.errors.parentAddress.message}
                  </p>
                )}
              </div>

              {/* City and Postal Code - Side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comune
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      {...parentForm.register('parentCity', { 
                        required: 'Comune è obbligatorio'
                      })}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                      placeholder="Nome del comune"
                    />
                  </div>
                  {parentForm.formState.errors.parentCity && (
                    <p className="text-sm text-red-600 flex items-center mt-1">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {parentForm.formState.errors.parentCity.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CAP
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Hash className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      {...parentForm.register('parentPostalCode', { 
                        required: 'CAP è obbligatorio',
                        pattern: {
                          value: /^\d{5}$/,
                          message: 'CAP deve essere di 5 cifre'
                        }
                      })}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
                      placeholder="12345"
                      maxLength={5}
                    />
                  </div>
                  {parentForm.formState.errors.parentPostalCode && (
                    <p className="text-sm text-red-600 flex items-center mt-1">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {parentForm.formState.errors.parentPostalCode.message}
                    </p>
                  )}
                </div>
              </div>
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

          <div className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-3">
            <button
              type="button"
              onClick={() => setStep('student-names')}
              className="w-full sm:w-auto px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50 order-2 sm:order-1"
            >
              ← Precedente
            </button>
            
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto py-4 px-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl order-1 sm:order-2"
            >
              Continua con i dati degli studenti
            </motion.button>
          </div>
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
            Inserisci i dati di <span className="font-semibold text-blue-600">{studentNames[currentStudentIndex] ? studentNames[currentStudentIndex] : `Studente ${currentStudentIndex + 1}`}</span>
          </h2>
          
          {/* Progress indicator */}
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-3 mb-4 border border-gray-100 shadow-sm inline-block">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                    {currentStudentIndex + 1}
                  </div>
                  <span className="text-gray-800 font-medium text-sm">
                  </span>
                </div>
                <div className="h-3 w-px bg-gray-200"></div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600 text-xs">
                    di {numberOfChildren}
                  </span>
                </div>
              </div>
          </div>

          <div>
          <button
            onClick={() => setStep('parent-form')}
            className="mt-2 text-sm text-blue-600 hover:text-blue-500 transition-colors"
          >
            ← Modifica dati genitore
          </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">
            {studentNames[currentStudentIndex] || `Studente ${currentStudentIndex + 1}`}
          </h3>

          <form onSubmit={currentForm.handleSubmit(handleStudentFormSubmit)} className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
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

              <div className="space-y-2">
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

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Codice Fiscale</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors uppercase"
                  placeholder="RSSMRA80A01H501Z"
                  {...currentForm.register('codiceFiscale', {
                    required: 'Codice Fiscale è obbligatorio',
                    pattern: {
                      value: /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i,
                      message: 'Formato Codice Fiscale non valido'
                    },
                    minLength: {
                      value: 16,
                      message: 'Il Codice Fiscale deve essere di 16 caratteri'
                    },
                    maxLength: {
                      value: 16,
                      message: 'Il Codice Fiscale deve essere di 16 caratteri'
                    },
                    validate: checkCodiceFiscaleExists
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

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Data di Nascita</label>
                <input
                  type="text"
                  placeholder="gg/mm/aaaa"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  {...currentForm.register('birthDate', { 
                    required: 'Data di nascita è obbligatoria',
                    pattern: {
                      value: /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/,
                      message: 'Formato data non valido (gg/mm/aaaa)'
                    },
                    validate: (value) => {
                      const [day, month, year] = value.split('/');
                      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                      const today = new Date();
                      if (date > today) {
                        return 'La data di nascita non può essere nel futuro';
                      }
                      if (date.getFullYear() < 1900) {
                        return 'Anno non valido';
                      }
                      return true;
                    }
                  })}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, '');
                    if (value.length >= 2) {
                      value = value.substring(0, 2) + '/' + value.substring(2);
                    }
                    if (value.length >= 5) {
                      value = value.substring(0, 5) + '/' + value.substring(5, 9);
                    }
                    e.target.value = value;
                    currentForm.setValue('birthDate', value);
                  }}
                  maxLength={10}
                />
                {currentForm.formState.errors.birthDate && (
                  <p className="text-red-500 text-sm mt-1">{currentForm.formState.errors.birthDate.message}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Inserisci la data nel formato gg/mm/aaaa
                </p>
              </div>

              <div className="space-y-2">
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


              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Ha disabilità o necessita supporto?</label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  {...currentForm.register('hasDisability')}
                >
                  <option value="">Seleziona un'opzione</option>
                  <option value="no">No</option>
                  <option value="no">Sì</option>
                </select>
                {currentForm.formState.errors.hasDisability && (
                  <p className="text-red-500 text-sm mt-1">{currentForm.formState.errors.hasDisability.message}</p>
                )}
              </div>

              {/* Italian School Class */}
              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Classe della Scuola Italiana <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  {...currentForm.register('italianSchoolClass', {
                    required: 'La classe della scuola italiana è obbligatoria'
                  })}
                >
                  <option value="">Seleziona la classe</option>
                  <option value="1A">1A - Prima Elementare</option>
                  <option value="2A">2A - Seconda Elementare</option>
                  <option value="3A">3A - Terza Elementare</option>
                  <option value="4A">4A - Quarta Elementare</option>
                  <option value="5A">5A - Quinta Elementare</option>
                  <option value="1M">1M - Prima Media</option>
                  <option value="2M">2M - Seconda Media</option>
                  <option value="3M">3M - Terza Media</option>
                  <option value="1S">1S - Prima Superiore</option>
                  <option value="2S">2S - Seconda Superiore</option>
                  <option value="3S">3S - Terza Superiore</option>
                  <option value="4S">4S - Quarta Superiore</option>
                  <option value="5S">5S - Quinta Superiore</option>
                </select>
                {currentForm.formState.errors.italianSchoolClass && (
                  <p className="text-red-500 text-sm mt-1">{currentForm.formState.errors.italianSchoolClass.message}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Seleziona la classe che {studentNames[currentStudentIndex] || 'lo studente'} frequenta nella scuola italiana
                </p>
              </div>

              {/* Previous Year Class - Only show for renewals */}
              {enrollmentTypes[currentStudentIndex] === 'rinnovo' && (
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Classe frequentata l'anno scorso (il nome del gruppo WhatsApp)
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder={selectedAttendanceMode === 'online' ? '' : 'Preparatoria Domenica Mattina, 5C Sabato Sera..'}
                    {...currentForm.register('previousYearClass', {
                      required: enrollmentTypes[currentStudentIndex] === 'rinnovo' ? 'Classe precedente è obbligatoria per i rinnovi' : false
                    })}
                  />
                  {currentForm.formState.errors.previousYearClass && (
                    <p className="text-red-500 text-sm mt-1">{currentForm.formState.errors.previousYearClass.message}</p>
                  )}
                  <p className="text-gray-500 text-xs mt-1">
                    Indica la classe che {studentNames[currentStudentIndex] || 'lo studente'} ha frequentato nell'anno scolastico precedente
                  </p>
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-center pt-4 sm:pt-6 gap-3 sm:gap-0">
              <motion.button
                type="button"
                onClick={handlePreviousStudent}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ← Precedente
              </motion.button>

              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 sm:px-8 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Caricamento...</span>
                  </div>
                ) : currentStudentIndex === numberOfChildren - 1 ? (
                  'Controlla i dati'
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

  const renderInfoStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Informazioni
          <motion.span
            className="inline-block ml-2"
            animate={shouldReduceMotion ? undefined : { rotate: [0, 14, -8, 14, -4, 10, 0] }}
            transition={shouldReduceMotion ? undefined : { duration: 1.2, delay: 0.5, repeat: 0 }}
          >
            ℹ️
          </motion.span>
        </h2>
        <p className="text-gray-600">Leggi con attenzione le informazioni prima di proseguire.</p>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 space-y-4">
        {selectedAttendanceMode === 'in_presenza' ? (
          <div className="space-y-3 text-gray-800">
            <p>Si possono iscrivere tutti gli alunni a partire da 6 anni <b>(solo chi ha già iniziato almeno la prima elementare)</b> e fino a 14 anni.</p>
            <p>Gli orari previsti per le lezioni sono; sabato pomeriggio, sabato sera, domenica mattina e domenica pomeriggio.</p>
            <p>Dopo la conferma dell'iscrizione l'orario sarà stabilito dall'amministrazione e vi sarà comunicato successivamente.</p>
            <p>I corsi sono in lingua Italiana e si studia le seguenti materie; Educazione Islamica (Fiqh, Hadith, Sira, Aqidah, Tarikh, Adab e Akhlaq) Corano e lingua araba.</p>
            <p><b>Il contributo scolastico annuale è di 120 euro per il primo figlio, 100 per il secondo e 80 per il terzo.</b></p>
            <p className="text-sm text-gray-700">per maggiori info <span className="font-medium">+39 329 6736454</span> mail: <span className="font-medium">istitutoaverroepc@gmail.com</span></p>
          </div>
        ) : (
          <div className="space-y-3 text-gray-800">
            <p>Si possono iscrivere tutti gli alunni a partire da 7 anni <b>(solo chi ha già iniziato almeno la seconda elementare)</b> e fino a 14 anni.</p>
            <p>Le classi saranno composte da circa 10 alunni.</p>
            <p>Dopo la conferma dell'iscrizione l'orario sarà stabilito tra il docente e i genitori.</p>
            <p>I corsi sono in lingua Italiana e si studiano le seguenti materie:  Fiqh, Hadith, Sira, Aqidah, Tarikh, Adab, Akhlaq e Corano.</p>
            <p><b>Il contributo scolastico annuale è di 100 euro.</b></p>
            <p className="text-sm text-gray-700">per maggiori info <span className="font-medium">+39 329 6736454</span> mail: <span className="font-medium">istitutoaverroepc@gmail.com</span></p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-center pt-6 gap-4">
          <motion.button
            type="button"
            onClick={() => setStep('attendance-mode')}
            className="flex items-center px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
          >
            ← Indietro
          </motion.button>
          <motion.button
            type="button"
            onClick={() => setStep('terms')}
            className="flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
          >
            Continua
          </motion.button>
        </div>
      </div>
    </div>
  );

  const renderTermsStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Termini e condizioni</h2>
        <p className="text-gray-600">Accetta i termini per proseguire con la registrazione.</p>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 space-y-4">
        <div className="prose prose-sm max-w-none text-gray-800">
          <p>Autorizzo il trattamento dei dati personali presenti ai sensi del D.Lgs. 2018/101 e del GDPR (Regolamento UE 2016/679).</p>
          <p>Autorizzo senza limiti di tempo, anche ai sensi degli artt. 10 e 320 cod.civ. e degli artt. 96 e 97 legge 22.4.1941, n. 633, Legge sul diritto d'autore, alla pubblicazione e/o diffusione in qualsiasi forma delle immagini sul sito internet dell'Istituto Averroè su qualsiasi altro mezzo di diffusione, nonché autorizza la conservazione delle foto e dei video stessi negli archivi informatici del Istituto e prendo atto che la finalità di tali pubblicazioni sono meramente di carattere informativo ed eventualmente promozionale.</p>
        </div>

        <label className="flex items-start gap-3 mt-4">
          <input type="checkbox" className="mt-1" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
          <span className="text-sm text-gray-800">Confermo di aver letto e accettato i termini e le condizioni</span>
        </label>

        <div className="flex flex-col sm:flex-row justify-between items-center pt-6 gap-4">
          <motion.button
            type="button"
            onClick={() => setStep('info')}
            className="flex items-center px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
          >
            ← Indietro
          </motion.button>
          <motion.button
            type="button"
            disabled={!termsAccepted}
            onClick={() => {
              setStep('children-count');
            }}
            className="flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
          >
            Continua
          </motion.button>
        </div>
      </div>
    </div>
  );

  const renderSuccessPopup = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Iscrizione Completata!
          </h2>
          
          <p className="text-gray-600 mb-6 leading-relaxed">
            La registrazione è stata inviata con successo. L'istituto ti contatterà il prima possibile per confermare l'iscrizione e fornirti tutte le informazioni necessarie.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">
              <strong>Prossimi passi:</strong><br />
              • Riceverai una email di conferma<br />
              • L'istituto ti contatterà per i dettagli<br />
              • Tieni a portata di mano i documenti richiesti
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/login')}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300"
            >
              Vai al Login
            </button>
            
            <button
              onClick={() => setShowSuccessPopup(false)}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Chiudi
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-2xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-pink-400/20 to-orange-600/20 rounded-full blur-2xl" />
      </div>

      <div className="flex-1 flex flex-col justify-center py-6 sm:py-12 px-4 sm:px-6 lg:px-20 xl:px-24 relative">
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mx-auto w-full max-w-4xl"
        >
          <div className="lg:hidden text-center mb-6 sm:mb-8">
            <Link to="/" className="inline-flex items-center justify-center group">
              <motion.div 
                className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center mr-3 shadow-xl"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <GraduationCap className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </motion.div>
              <span className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
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
              {step === 'info' && renderInfoStep()}
              {step === 'terms' && renderTermsStep()}
              {step === 'turno-selection' && renderTurnoSelection()}
              {step === 'children-count' && renderChildrenCountSelection()}
              {step === 'student-names' && renderStudentNamesForm()}
              {step === 'enrollment-type' && renderEnrollmentTypeSelection()}
              {step === 'parent-form' && renderParentForm()}
              {step === 'students-form' && renderStudentsForm()}
              {step === 'review' && renderReviewForm()}
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
      
      {showSuccessPopup && renderSuccessPopup()}
    </div>
  );
};
