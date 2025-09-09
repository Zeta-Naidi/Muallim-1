import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { 
  Download, Edit, Filter, Search, Calendar, MapPin, Phone, CheckCircle, AlertCircle, X, Users, Shield, Save, ChevronLeft, ChevronRight, ArrowDown, ArrowUp, UserPlus, Mail,
  UserMinus
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
  where
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { User as UserType, Class, Student, StudentWithParent, UserRole } from '../../types';
import { isValid, format } from 'date-fns';

interface StudentFormValues {
  displayName: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  birthDate?: string;
  gender?: string;
  emergencyContact?: string;
  parentName?: string;
  parentContact?: string;
  parentEmail?: string;
  classId?: string;
  italianSchoolClass?: string;
  codiceFiscale?: string;
  enrollmentType?: string;
  hasDisability?: boolean;
  selectedTurni?: string[];
  attendanceMode?: string;
  accountStatus?: string;
}

export const ManageStudents: React.FC = () => {
  const { userProfile } = useAuth();
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<StudentFormValues>();
  const [students, setStudents] = useState<StudentWithParent[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentWithParent[]>([]);
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
  const [viewMode, setViewMode] = useState<'enrolled' | 'waiting'>('enrolled');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Advanced Filters
  const [filters, setFilters] = useState({
    name: '',
    surname: '',
    class: '',
    age: '',
    parentName: '',
    parentPhone: '',
    enrollmentType: '',
    attendanceMode: '',
    gender: '',
    italianSchoolClass: ''
  });

  // Advanced Sorting - each field has its own sort state
  const [sortStates, setSortStates] = useState<{
    createdAt: 'desc' | 'asc' | null;
    age: 'desc' | 'asc' | null;
    name: 'desc' | 'asc' | null;
    surname: 'desc' | 'asc' | null;
  }>({
    createdAt: 'desc', // Default active sort
    age: null,
    name: null,
    surname: null
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

        // Fetch students from students collection
        const studentsQuery = query(
          collection(db, 'students')
        );
        const studentsDocs = await getDocs(studentsQuery);
        const toJsDate = (val: any): Date | null => {
          if (!val) return null;
          // Firestore Timestamp has a toDate function
          if (typeof val.toDate === 'function') return val.toDate();
          // Already a JS Date
          if (val instanceof Date) return val;
          // ISO string or other parseable value
          const d = new Date(val);
          return isNaN(d.getTime()) ? null : d;
        };

        const fetchedStudents = studentsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            birthDate: toJsDate(data.birthDate),
            createdAt: toJsDate(data.createdAt) || new Date(),
            enrollmentDate: toJsDate(data.enrollmentDate),
          } as Student;
        });

        // Fetch all parents first to optimize queries
        const parentsQuery = query(collection(db, 'users'), where('role', '==', 'parent'));
        const parentsDocs = await getDocs(parentsQuery);
        const parentsMap = new Map();
        
        parentsDocs.docs.forEach(doc => {
          const parentData = doc.data();
          parentsMap.set(doc.id, parentData);
        });

        // Count siblings for each parent
        const siblingCounts = new Map();
        fetchedStudents.forEach(student => {
          if (student.parentId) {
            const currentCount = siblingCounts.get(student.parentId) || 0;
            siblingCounts.set(student.parentId, currentCount + 1);
          }
        });

        // Map students with parent data
        const studentsWithParents: StudentWithParent[] = fetchedStudents.map(student => {
          const parentData = parentsMap.get(student.parentId);
          const siblingCount = siblingCounts.get(student.parentId) || 0;
          
          return {
            ...student,
            role: 'student' as UserRole,
            gender: student.gender,
            parentName: parentData ? `${parentData.firstName || ''} ${parentData.lastName || ''}`.trim() || parentData.displayName : 'N/A',
            parentCodiceFiscale: parentData?.codiceFiscale,
            parentContact: parentData?.phoneNumber || parentData.contact,
            parentEmail: parentData?.email,
            parentAddress: parentData?.address,
            parentCity: parentData?.city,
            parentPostalCode: parentData?.postalCode,
            siblingCount: siblingCount,
          };
        });

        setStudents(studentsWithParents);
        setFilteredStudents(studentsWithParents);
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
    
    // Apply advanced filters
    if (filters.name) {
      const q = filters.name.toLowerCase();
      filtered = filtered.filter(student => 
        (student.displayName || '').toLowerCase().includes(q) ||
        (student.firstName || '').toLowerCase().includes(q)
      );
    }
    
    if (filters.surname) {
      const q = filters.surname.toLowerCase();
      filtered = filtered.filter(student => 
        (student.lastName || '').toLowerCase().includes(q)
      );
    }
    
    if (filters.class) {
      filtered = filtered.filter(student => student.currentClass === filters.class);
    }
    
    if (filters.age) {
      filtered = filtered.filter(student => 
        calculateAge(student.birthDate) === filters.age
      );
    }
    
    if (filters.parentName) {
      const q = filters.parentName.toLowerCase();
      filtered = filtered.filter(student => 
        (student.parentName || '').toLowerCase().includes(q)
      );
    }
    
    if (filters.parentPhone) {
      filtered = filtered.filter(student => 
        student.parentContact && student.parentContact.includes(filters.parentPhone)
      );
    }

    if (filters.enrollmentType) {
      filtered = filtered.filter(student => 
        (student as any).enrollmentType === filters.enrollmentType
      );
    }

    if (filters.attendanceMode) {
      filtered = filtered.filter(student => 
        (student as any).attendanceMode === filters.attendanceMode
      );
    }

    if (filters.gender) {
      filtered = filtered.filter(student => 
        student.gender === filters.gender
      );
    }

    if (filters.italianSchoolClass) {
      const q = filters.italianSchoolClass.toLowerCase();
      filtered = filtered.filter(student => 
        ((student as any).italianSchoolClass || '').toLowerCase().includes(q)
      );
    }

    // Apply advanced sorting - find the active sort field
    const activeSortField = Object.entries(sortStates).find(([_, order]) => order !== null)?.[0] as keyof typeof sortStates;
    const activeSortOrder = activeSortField ? sortStates[activeSortField] : 'desc';
    
    if (activeSortField && activeSortOrder) {
      filtered.sort((a, b) => {
        let valueA: any, valueB: any;
        
        switch (activeSortField) {
          case 'createdAt':
            valueA = a.createdAt || new Date(0);
            valueB = b.createdAt || new Date(0);
            break;
          case 'age':
            valueA = calculateAge(a.birthDate);
            valueB = calculateAge(b.birthDate);
            // Convert to numbers for proper sorting
            valueA = valueA === 'N/A' ? 0 : parseInt(valueA);
            valueB = valueB === 'N/A' ? 0 : parseInt(valueB);
            break;
          case 'name':
            valueA = (a.firstName || a.displayName || '').toLowerCase();
            valueB = (b.firstName || b.displayName || '').toLowerCase();
            break;
          case 'surname':
            valueA = (a.lastName || '').toLowerCase();
            valueB = (b.lastName || '').toLowerCase();
            break;
          default:
            valueA = a.createdAt || new Date(0);
            valueB = b.createdAt || new Date(0);
        }
        
        if (activeSortField === 'createdAt') {
          return activeSortOrder === 'desc' 
            ? valueB.getTime() - valueA.getTime()
            : valueA.getTime() - valueB.getTime();
        } else if (activeSortField === 'age') {
          return activeSortOrder === 'desc' ? valueB - valueA : valueA - valueB;
        } else {
          return activeSortOrder === 'desc' 
            ? valueB.localeCompare(valueA)
            : valueA.localeCompare(valueB);
        }
      });
    }

    setFilteredStudents(filtered);
    // Reset pagination when filters change to avoid empty pages
    setEnrolledPage(1);
    setNotEnrolledPage(1);
  }, [students, filters, sortStates]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSortToggle = (field: keyof typeof sortStates) => {
    setSortStates(prev => {
      // Reset all other fields to null
      const newState = {
        createdAt: null,
        age: null,
        name: null,
        surname: null
      } as typeof prev;
      
      // Toggle the clicked field
      if (prev[field] === null) {
        newState[field] = 'desc';
      } else if (prev[field] === 'desc') {
        newState[field] = 'asc';
      } else {
        newState[field] = 'desc';
      }
      
      return newState;
    });
  };

  const calculateAge = (birthDate: Date | undefined | null): string => {
    if (!birthDate) return 'N/A';
    const date = new Date(birthDate);
    if (!isValid(date)) return 'N/A';
    const age = new Date().getFullYear() - date.getFullYear();
    return age.toString();
  };

  // CSV Export function
  const exportToCSV = () => {
    try {
      // Define CSV headers
      const headers = [
        'Nome',
        'Cognome',
        'Codice Fiscale',
        'Data di Nascita',
        'Genere',
        'Telefono',
        'Indirizzo',
        'Città',
        'CAP',
        'Modalità di Frequenza',
        'Tipo di Iscrizione',
        'Classe Precedente',
        'Classe Scuola Italiana',
        'Ha Disabilità',
        'Nome Genitore',
        'Telefono Genitore',
        'Email Genitore',
        'Data Registrazione',
        'Turni',
        'Iscritto',
        'Data Iscrizione',
        'Stato Account'
      ];

      // Convert student data to CSV rows
      const csvData = students.map(student => {
        return [
          student.firstName || '',
          student.lastName || '',
          student.codiceFiscale || '',
          student.birthDate && isValid(new Date(student.birthDate)) ? format(new Date(student.birthDate), 'dd/MM/yyyy') : '',
          student.gender || '',
          student.phoneNumber || '',
          student.address || '',
          student.city || '',
          student.postalCode || '',
          student.attendanceMode || '',
          student.enrollmentType || '',
          student.previousYearClass || '',
          student.italianSchoolClass || '',
          student.hasDisability ? 'Sì' : 'No',
          student.parentName || '',
          student.parentContact || '',
          student.parentEmail || '',
          student.registrationDate && isValid(new Date(student.createdAt)) ? format(new Date(student.createdAt), 'dd/MM/yyyy HH:mm') : '',
          student.selectedTurni ? student.selectedTurni.join(', ') : '',
          student.isEnrolled ? 'Sì' : 'No',
          student.enrollmentDate && isValid(new Date(student.enrollmentDate)) ? format(new Date(student.enrollmentDate), 'dd/MM/yyyy') : '',
          student.accountStatus || ''
        ];
      });

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => 
          row.map(field => 
            // Escape commas and quotes in CSV fields
            typeof field === 'string' && (field.includes(',') || field.includes('"')) 
              ? `"${field.replace(/"/g, '""')}"` 
              : field
          ).join(',')
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `studenti_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage({ type: 'success', text: 'File CSV scaricato con successo!' });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      setMessage({ type: 'error', text: 'Errore durante l\'esportazione del CSV' });
    }
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
                  <span className="hidden sm:inline-flex items-center">
                    <Phone className="h-3 w-3 mr-1" />
                    {student.phoneNumber || student.parentContact || 'N/A'}
                  </span>
                  <span className="inline-flex items-center">
                    <Users className="h-3 w-3 mr-1" />
                    {(() => {
                      const cls = classes.find(c => c.id === (student as any).currentClass);
                      return cls ? `${cls.name}` : 'Non assegnato';
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Status and Actions */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
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
                      ?  'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  } ${processingStudent === student.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {processingStudent === student.id ? (
                    <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent" />
                  ) : student.isEnrolled ? (
                    <UserMinus className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
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
                          <span className="text-gray-500">Data di nascita:</span>
                          <span className="text-gray-900">{formatDate(student.birthDate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Codice Fiscale:</span>
                          <span className="text-gray-900">{(student as any).codiceFiscale || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Indirizzo:</span>
                          <span className="text-gray-900">{student.address || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Città:</span>
                          <span className="text-gray-900">{(student as any).city || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">CAP:</span>
                          <span className="text-gray-900">{(student as any).postalCode || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Genere:</span>
                          <span className="text-gray-900">{student.gender === 'M' ? 'Maschio' : student.gender === 'F' ? 'Femmina' : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Modalità frequenza:</span>
                          <span className="text-gray-900">{(student as any).attendanceMode === 'in_presenza' ? 'In presenza' : (student as any).attendanceMode === 'online' ? 'Online' : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Tipo iscrizione:</span>
                          <span className="text-gray-900">{(student as any).enrollmentType === 'nuova_iscrizione' ? 'Nuova Iscrizione' : (student as any).enrollmentType === 'rinnovo' ? 'Rinnovo' : 'N/A'}</span>
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
                          <span className="text-gray-500">Email genitore:</span>
                          <span className="text-gray-900">{(student as any).parentEmail || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Classe italiana:</span>
                          <span className="text-gray-900">{(student as any).italianSchoolClass || 'N/A'}</span>
                        </div>
                        {(student as any).selectedTurni && (student as any).selectedTurni.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Turni selezionati:</span>
                            <span className="text-gray-900">
                              {(student as any).selectedTurni.map((turno: string) => {
                                switch(turno) {
                                  case 'sabato_pomeriggio': return 'Sab. Pom.';
                                  case 'sabato_sera': return 'Sab. Sera';
                                  case 'domenica_mattina': return 'Dom. Matt.';
                                  case 'domenica_pomeriggio': return 'Dom. Pom.';
                                  default: return turno;
                                }
                              }).join(', ')}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-500">Fratelli/Sorelle:</span>
                          <span className="text-gray-900">
                            {(student as any).siblingCount > 1 
                              ? `${(student as any).siblingCount - 1} ${(student as any).siblingCount - 1 === 1 ? 'fratello/sorella' : 'fratelli/sorelle'}`
                              : 'Figlio unico'
                            }
                          </span>
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
    setValue('city', (student as any).city || '');
    setValue('postalCode', (student as any).postalCode || '');
    
    if (student.birthDate && isValid(new Date(student.birthDate))) {
      setValue('birthDate', format(new Date(student.birthDate), 'yyyy-MM-dd'));
    } else {
      setValue('birthDate', '');
    }
    
    setValue('gender', student.gender || '');
    setValue('emergencyContact', student.emergencyContact || '');
    setValue('parentName', student.parentName || '');
    setValue('parentContact', student.parentContact || '');
    setValue('parentEmail', (student as any).parentEmail || '');
    setValue('classId', (student as any).currentClass || '');
    setValue('italianSchoolClass', (student as any).italianSchoolClass || '');
    setValue('codiceFiscale', (student as any).codiceFiscale || '');
    setValue('enrollmentType', (student as any).enrollmentType || '');
    setValue('hasDisability', (student as any).hasDisability || false);
    setValue('selectedTurni', (student as any).selectedTurni || []);
    setValue('attendanceMode', (student as any).attendanceMode || '');
    setValue('accountStatus', (student as any).accountStatus || '');
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
    const studentCurrentClass = (student as any).currentClass;
    if (isCurrentlyEnrolled && studentCurrentClass) {
      const studentClass = classes.find(c => c.id === studentCurrentClass);
      setShowEnrollError({ open: true, name: student.displayName, className: studentClass?.name || 'una classe' });
      return;
    }
    setEnrollTarget({ id: student.id, name: student.displayName, classId: studentCurrentClass, currentStatus: student.isEnrolled });
    setTargetEnrollStatus(!isCurrentlyEnrolled);
    setShowEnrollConfirm(true);
  };

  const confirmEnrollmentChange = async () => {
    if (!enrollTarget || targetEnrollStatus === null) return;
    const studentId = enrollTarget.id;
    const newStatus = targetEnrollStatus;

    setProcessingStudent(studentId);

    try {
      const studentRef = doc(db, 'students', studentId);
      await updateDoc(studentRef, {
        isEnrolled: newStatus,
        enrollmentDate: newStatus ? new Date() : null,
        accountStatus: newStatus ? 'active' : 'pending_approval'
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
      const studentRef = doc(db, 'students', editingStudent);
      const currentStudent = students.find(s => s.id === editingStudent);
      const oldClassId = currentStudent?.currentClass;
      const newClassIdDb = data.classId ?? null; // value sent to Firestore (nullable)
      const newClassIdState = data.classId ?? undefined; // value kept in local state (undefined preferred over null)
      
      await updateDoc(studentRef, {
        displayName: data.displayName,
        phoneNumber: data.phoneNumber || null,
        address: data.address || null,
        city: data.city || null,
        postalCode: data.postalCode || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        gender: data.gender || null,
        emergencyContact: data.emergencyContact || null,
        parentName: data.parentName || null,
        parentContact: data.parentContact || null,
        currentClass: newClassIdDb,
        italianSchoolClass: data.italianSchoolClass || null,
        codiceFiscale: data.codiceFiscale || null,
        enrollmentType: data.enrollmentType || null,
        hasDisability: data.hasDisability || false,
        selectedTurni: data.selectedTurni || [],
        attendanceMode: data.attendanceMode || null,
        accountStatus: data.accountStatus || null,
        updatedAt: new Date()
      });

      // Update parent information if provided
      if (data.parentEmail) {
        const parentId = currentStudent?.parentId;
        if (parentId) {
          const parentRef = doc(db, 'users', parentId);
          const parentUpdates: Record<string, any> = {};
          
          if (data.parentEmail) parentUpdates.email = data.parentEmail;
          
          if (Object.keys(parentUpdates).length > 0) {
            parentUpdates.updatedAt = new Date();
            await updateDoc(parentRef, parentUpdates);
          }
        }
      }

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
              displayName: data.displayName,
              phoneNumber: data.phoneNumber || undefined,
              address: data.address || undefined,
              city: data.city || undefined,
              postalCode: data.postalCode || undefined,
              gender: data.gender === 'M' ? 'M' : data.gender === 'F' ? 'F' : student.gender,
              emergencyContact: data.emergencyContact || undefined,
              parentName: data.parentName || undefined,
              parentContact: data.parentContact || undefined,
              parentEmail: data.parentEmail || undefined,
              currentClass: newClassIdState || student.currentClass,
              italianSchoolClass: data.italianSchoolClass || undefined,
              codiceFiscale: data.codiceFiscale || undefined,
              enrollmentType: data.enrollmentType || undefined,
              hasDisability: data.hasDisability || false,
              selectedTurni: data.selectedTurni || [],
              attendanceMode: data.attendanceMode || undefined,
              accountStatus: data.accountStatus || undefined,
              birthDate: data.birthDate ? new Date(data.birthDate) : student.birthDate
            } as StudentWithParent
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
              <CardContent className="p-6 space-y-8">
                {/* Informazioni Personali */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Informazioni Personali</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Nome completo"
                      error={errors.displayName?.message}
                      className="anime-input"
                      {...register('displayName', { required: 'Il nome è obbligatorio' })}
                    />

                    <Input
                      label="Codice Fiscale"
                      className="anime-input"
                      {...register('codiceFiscale')}
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
                        <option value="M">Maschio</option>
                        <option value="F">Femmina</option>
                      </select>
                    </div>

                    <Input
                      label="Telefono"
                      leftIcon={<Phone className="h-5 w-5 text-gray-400" />}
                      className="anime-input"
                      {...register('phoneNumber')}
                    />
                  </div>
                </div>

                {/* Indirizzo */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Indirizzo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Indirizzo"
                      leftIcon={<MapPin className="h-5 w-5 text-gray-400" />}
                      className="anime-input md:col-span-2"
                      {...register('address')}
                    />

                    <Input
                      label="Città"
                      leftIcon={<MapPin className="h-5 w-5 text-gray-400" />}
                      className="anime-input md:col-span-2"
                      {...register('city')}
                    />

                    <Input
                      label="CAP"
                      leftIcon={<MapPin className="h-5 w-5 text-gray-400" />}
                      className="anime-input"
                      {...register('postalCode')}
                    />
                  </div>
                </div>

                {/* Informazioni Genitore */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Informazioni Genitore</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Nome del genitore"
                      className="anime-input"
                      {...register('parentName')}
                    />

                    <Input
                      label="Contatto del genitore"
                      leftIcon={<Phone className="h-5 w-5 text-gray-400" />}
                      className="anime-input"
                      {...register('parentContact')}
                    />

                    <Input
                      label="Email del genitore"
                      type="email"
                      leftIcon={<Mail className="h-5 w-5 text-gray-400" />}
                      className="anime-input md:col-span-2"
                      {...register('parentEmail')}
                    />
                  </div>
                </div>

                {/* Informazioni Scolastiche */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Informazioni Scolastiche</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Classe Scuola Italiana"
                      className="anime-input"
                      {...register('italianSchoolClass')}
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Classe Assegnata
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo Iscrizione
                      </label>
                      <select
                        className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-3 px-4 transition-colors"
                        {...register('enrollmentType')}
                      >
                        <option value="">Seleziona tipo</option>
                        <option value="nuova_iscrizione">Nuova Iscrizione</option>
                        <option value="rinnovo">Rinnovo</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Modalità Frequenza
                      </label>
                      <select
                        className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-3 px-4 transition-colors"
                        {...register('attendanceMode')}
                      >
                        <option value="">Seleziona modalità</option>
                        <option value="in_presenza">In Presenza</option>
                        <option value="online">Online</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stato Account
                      </label>
                      <select
                        className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-3 px-4 transition-colors"
                        {...register('accountStatus')}
                      >
                        <option value="">Seleziona stato</option>
                        <option value="pending_approval">In Attesa di Approvazione</option>
                        <option value="active">Attivo</option>
                        <option value="suspended">Sospeso</option>
                        <option value="inactive">Inattivo</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          {...register('hasDisability')}
                        />
                        <span className="text-sm font-medium text-gray-700">Ha disabilità</span>
                      </label>
                    </div>
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
                      onClick={exportToCSV}
                      className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
                      size="sm"
                      leftIcon={<Download className="h-4 w-4" />}
                    >
                      Esporta CSV
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFiltersOpen(o => !o)}
                      className="sm:hidden text-gray-600 hover:text-gray-800 rounded-xl"
                      aria-expanded={filtersOpen}
                      aria-controls="students-filters"
                    >
                      <Filter className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters({
                        name: '',
                        surname: '',
                        class: '',
                        age: '',
                        parentName: '',
                        parentPhone: '',
                        enrollmentType: '',
                        attendanceMode: '',
                        gender: '',
                        italianSchoolClass: ''
                      })}
                      className="hidden sm:inline-flex text-gray-600 hover:text-gray-800 rounded-xl"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reset Filtri
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div id="students-filters" className={`space-y-4 ${filtersOpen ? 'block' : 'hidden'} sm:block`}>
                  {/* Primary Filters Row */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center">
                        <Search className="h-4 w-4 mr-1 text-gray-500" />
                        Nome
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
                        <Search className="h-4 w-4 mr-1 text-gray-500" />
                        Cognome
                      </label>
                      <Input
                        type="text"
                        placeholder="Cerca per cognome..."
                        value={filters.surname}
                        onChange={(e) => handleFilterChange('surname', e.target.value)}
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
                        placeholder="Età..."
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Genere
                      </label>
                      <select
                        value={filters.gender}
                        onChange={(e) => handleFilterChange('gender', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 bg-white"
                      >
                        <option value="">Tutti i generi</option>
                        <option value="M">Maschio</option>
                        <option value="F">Femmina</option>
                      </select>
                    </div>
                  </div>

                  {/* Tertiary Filters Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Tipo Iscrizione
                      </label>
                      <select
                        value={filters.enrollmentType}
                        onChange={(e) => handleFilterChange('enrollmentType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 bg-white"
                      >
                        <option value="">Tutti i tipi</option>
                        <option value="nuova_iscrizione">Nuova Iscrizione</option>
                        <option value="rinnovo">Rinnovo</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Modalità Frequenza
                      </label>
                      <select
                        value={filters.attendanceMode}
                        onChange={(e) => handleFilterChange('attendanceMode', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 bg-white"
                      >
                        <option value="">Tutte le modalità</option>
                        <option value="in_presenza">In Presenza</option>
                        <option value="online">Online</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Classe Italiana
                      </label>
                      <Input
                        type="text"
                        placeholder="Es. 1A, 2B..."
                        value={filters.italianSchoolClass}
                        onChange={(e) => handleFilterChange('italianSchoolClass', e.target.value)}
                        className="w-full rounded-xl border-gray-200 focus:border-blue-400 focus:ring-blue-400/20"
                      />
                    </div>
                  </div>

                  {/* Filter Summary */}
                  {(filters.name || filters.surname || filters.class || filters.age || filters.parentName || filters.parentPhone || filters.enrollmentType || filters.attendanceMode || filters.gender || filters.italianSchoolClass) && (
                    <div className="hidden md:block mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
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
                          {filters.surname && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-700">
                              Cognome: {filters.surname}
                              <button
                                onClick={() => handleFilterChange('surname', '')}
                                className="ml-1 hover:text-indigo-900"
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
                          {filters.enrollmentType && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-teal-100 text-teal-700">
                              Tipo: {filters.enrollmentType === 'nuova_iscrizione' ? 'Nuova Iscrizione' : 'Rinnovo'}
                              <button
                                onClick={() => handleFilterChange('enrollmentType', '')}
                                className="ml-1 hover:text-teal-900"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                          {filters.attendanceMode && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-cyan-100 text-cyan-700">
                              Modalità: {filters.attendanceMode === 'in_presenza' ? 'In Presenza' : 'Online'}
                              <button
                                onClick={() => handleFilterChange('attendanceMode', '')}
                                className="ml-1 hover:text-cyan-900"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                          {filters.gender && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-rose-100 text-rose-700">
                              Genere: {filters.gender === 'M' ? 'Maschio' : 'Femmina'}
                              <button
                                onClick={() => handleFilterChange('gender', '')}
                                className="ml-1 hover:text-rose-900"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                          {filters.italianSchoolClass && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700">
                              Classe IT: {filters.italianSchoolClass}
                              <button
                                onClick={() => handleFilterChange('italianSchoolClass', '')}
                                className="ml-1 hover:text-amber-900"
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
              {/* Sorting Bar */}
              <Card className="bg-white/90 backdrop-blur-md border border-white/30 shadow-lg rounded-2xl overflow-hidden mb-4 mt-4">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <ArrowUp className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                    <h3 className="text-sm font-semibold text-gray-800">Ordinamento</h3>
                    <p className="text-xs text-gray-600">Clicca per ordinare</p>
                  </div>
                </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleSortToggle('createdAt')}
                        variant={sortStates.createdAt ? 'primary' : 'outline'}
                        size="sm"
                        className={`rounded-xl transition-all ${
                          sortStates.createdAt 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-gray-600 hover:text-gray-800 border-gray-200'
                        }`}
                        leftIcon={
                          sortStates.createdAt === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : sortStates.createdAt === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : null
                        }
                      >
                        Data Registrazione
                      </Button>
                      
                      <Button
                        onClick={() => handleSortToggle('age')}
                        variant={sortStates.age ? 'primary' : 'outline'}
                        size="sm"
                        className={`rounded-xl transition-all ${
                          sortStates.age 
                            ? 'bg-green-600 text-white shadow-md' 
                            : 'text-gray-600 hover:text-gray-800 border-gray-200'
                        }`}
                        leftIcon={
                          sortStates.age === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : sortStates.age === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : null
                        }
                      >
                        Età
                      </Button>
                      
                      <Button
                        onClick={() => handleSortToggle('name')}
                        variant={sortStates.name ? 'primary' : 'outline'}
                        size="sm"
                        className={`rounded-xl transition-all ${
                          sortStates.name 
                            ? 'bg-purple-600 text-white shadow-md' 
                            : 'text-gray-600 hover:text-gray-800 border-gray-200'
                        }`}
                        leftIcon={
                          sortStates.name === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : sortStates.name === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : null
                        }
                      >
                        Nome
                      </Button>
                      
                      <Button
                        onClick={() => handleSortToggle('surname')}
                        variant={sortStates.surname ? 'primary' : 'outline'}
                        size="sm"
                        className={`rounded-xl transition-all ${
                          sortStates.surname 
                            ? 'bg-orange-600 text-white shadow-md' 
                            : 'text-gray-600 hover:text-gray-800 border-gray-200'
                        }`}
                        leftIcon={
                          sortStates.surname === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : sortStates.surname === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : null
                        }
                      >
                        Cognome
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section Header */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div
                    role="button"
                    aria-pressed={viewMode === 'enrolled'}
                    tabIndex={0}
                    title="Mostra studenti iscritti"
                    onClick={() => setViewMode('enrolled')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setViewMode('enrolled'); }}
                    className={`rounded-xl p-4 border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300/60 
                      ${viewMode === 'enrolled' 
                        ? 'bg-blue-50/70 border-blue-400 shadow-md' 
                        : 'bg-white/60 backdrop-blur-sm border-white/40 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5'}
                    `}
                  >
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
                  <div
                    role="button"
                    aria-pressed={viewMode === 'waiting'}
                    tabIndex={0}
                    title="Mostra lista d'attesa"
                    onClick={() => setViewMode('waiting')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setViewMode('waiting'); }}
                    className={`rounded-xl p-4 border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-300/60 
                      ${viewMode === 'waiting' 
                        ? 'bg-red-50/70 border-red-400 shadow-md' 
                        : 'bg-white/60 backdrop-blur-sm border-white/40 hover:border-red-300 hover:shadow-md hover:-translate-y-0.5'}
                    `}
                  >
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
                <div className="space-y-6">
                  {viewMode === 'enrolled' ? (
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
                      {totalEnrolledPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEnrolledPage(Math.max(1, enrolledPage - 1))}
                            disabled={enrolledPage === 1}
                            className="px-3 py-1"
                          >
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <span className="text-sm text-gray-600">Pagina {enrolledPage} di {totalEnrolledPages}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEnrolledPage(Math.min(totalEnrolledPages, enrolledPage + 1))}
                            disabled={enrolledPage === totalEnrolledPages}
                            className="px-3 py-1"
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
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
                      {totalNotEnrolledPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setNotEnrolledPage(Math.max(1, notEnrolledPage - 1))}
                            disabled={notEnrolledPage === 1}
                            className="px-3 py-1"
                          >
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <span className="text-sm text-gray-600">Pagina {notEnrolledPage} di {totalNotEnrolledPages}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setNotEnrolledPage(Math.min(totalNotEnrolledPages, notEnrolledPage + 1))}
                            disabled={notEnrolledPage === totalNotEnrolledPages}
                            className="px-3 py-1"
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
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