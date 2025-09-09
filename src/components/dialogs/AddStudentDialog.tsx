import React, { useState, useEffect } from 'react';
import { Search, X, UserPlus, Filter, Check, Users, Phone, MapPin, Calendar, School, ChevronLeft, ChevronRight, Mail } from 'lucide-react';
import { Button } from '../ui/Button';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { isValid } from 'date-fns';
import { StudentWithParent } from '../../types';

interface Class {
  id: string;
  name: string;
}

interface AddStudentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStudents: (studentIds: string[]) => void;
  excludeStudentIds?: string[];
}

export const AddStudentDialog: React.FC<AddStudentDialogProps> = ({
  isOpen,
  onClose,
  onAddStudents,
  excludeStudentIds = []
}) => {
  const [availableStudents, setAvailableStudents] = useState<StudentWithParent[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const STUDENTS_PER_PAGE = 4;
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    gender: '',
    currentClass: '',
    age: '',
    city: '',
    italianSchoolClass: '',
    attendanceMode: '',
    enrollmentType: '',
    enrollmentStatus: 'all'
  });

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when dialog is open
      document.body.style.overflow = 'hidden';
      fetchData();
    } else {
      // Restore body scroll when dialog closes
      document.body.style.overflow = 'unset';
      // Reset state when dialog closes
      setSelectedStudentIds(new Set());
      setSearchQuery('');
      setFilters({
        gender: '',
        currentClass: '',
        age: '',
        city: '',
        italianSchoolClass: '',
        attendanceMode: '',
        enrollmentType: '',
        enrollmentStatus: 'all'
      });
      setShowFilters(false);
      setCurrentPage(1);
    }

    // Cleanup function to restore scroll on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch students from students collection
      const studentsQuery = query(collection(db, 'students'));
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
        } as any;
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
          role: 'student' as const,
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

      // Filter out excluded students
      const available = studentsWithParents.filter(student => 
        !excludeStudentIds.includes(student.id)
      );
      setAvailableStudents(available);

      // Fetch classes for filter dropdown
      const classesQuery = query(collection(db, 'classes'));
      const classesDocs = await getDocs(classesQuery);
      const allClasses = classesDocs.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as Class));
      setClasses(allClasses);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudentToggle = (studentId: string) => {
    const newSelected = new Set(selectedStudentIds);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudentIds(newSelected);
  };

  const handleSelectAll = () => {
    const filteredStudents = getFilteredStudents();
    const allIds = new Set(filteredStudents.map(s => s.id));
    setSelectedStudentIds(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedStudentIds(new Set());
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      gender: '',
      currentClass: '',
      age: '',
      city: '',
      italianSchoolClass: '',
      attendanceMode: '',
      enrollmentType: '',
      enrollmentStatus: 'all'
    });
    setCurrentPage(1);
  };

  const getFilteredStudents = () => {
    return availableStudents.filter(student => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = student.displayName?.toLowerCase().includes(query) ||
                           student.firstName?.toLowerCase().includes(query) ||
                           student.lastName?.toLowerCase().includes(query);
        const matchesEmail = student.email?.toLowerCase().includes(query) ||
                            student.parentEmail?.toLowerCase().includes(query);
        const matchesParent = student.parentName?.toLowerCase().includes(query);
        const matchesPhone = student.phoneNumber?.includes(searchQuery) || student.parentContact?.includes(searchQuery);
        
        if (!matchesName && !matchesEmail && !matchesParent && !matchesPhone) {
          return false;
        }
      }

      // Gender filter
      if (filters.gender && student.gender !== filters.gender) {
        return false;
      }

      // Age filter
      if (filters.age) {
        const studentAge = student.birthDate ? parseInt(calculateAge(student.birthDate)) : null;
        const filterAge = parseInt(filters.age);
        if (!studentAge || studentAge !== filterAge) {
          return false;
        }
      }

      // Current class filter
      if (filters.currentClass && student.currentClass !== filters.currentClass) {
        return false;
      }


      // City filter
      if (filters.city) {
        const query = filters.city.toLowerCase();
        if (!student.city?.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Italian school class filter
      if (filters.italianSchoolClass) {
        const query = filters.italianSchoolClass.toLowerCase();
        if (!student.italianSchoolClass?.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Attendance mode filter
      if (filters.attendanceMode && student.attendanceMode !== filters.attendanceMode) {
        return false;
      }

      // Enrollment type filter
      if (filters.enrollmentType && student.enrollmentType !== filters.enrollmentType) {
        return false;
      }

      // Enrollment status filter
      if (filters.enrollmentStatus !== 'all') {
        const isEnrolled = student.isEnrolled === true;
        if (filters.enrollmentStatus === 'enrolled' && !isEnrolled) {
          return false;
        }
        if (filters.enrollmentStatus === 'not_enrolled' && isEnrolled) {
          return false;
        }
      }

      return true;
    });
  };

  const handleAddSelected = () => {
    if (selectedStudentIds.size > 0) {
      onAddStudents(Array.from(selectedStudentIds));
      onClose();
    }
  };

  const calculateAge = (birthDate: Date | undefined | null): string => {
    if (!birthDate) return 'N/A';
    const date = new Date(birthDate);
    if (!isValid(date)) return 'N/A';
    const age = new Date().getFullYear() - date.getFullYear();
    return age.toString();
  };

  const filteredStudents = getFilteredStudents();
  const hasActiveFilters = Object.values(filters).some(value => value && value !== 'all') || searchQuery;
  
  // Pagination logic
  const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
  const startIndex = (currentPage - 1) * STUDENTS_PER_PAGE;
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + STUDENTS_PER_PAGE);
  
  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-hidden">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <UserPlus className="h-6 w-6 text-blue-600" />
                Aggiungi Studenti
              </h3>
              <p className="text-gray-600 mt-1">
                Seleziona uno o più studenti da aggiungere alla classe
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b border-gray-200 space-y-4 flex-shrink-0">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per nome, email, genitore o telefono..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter Toggle and Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtri {hasActiveFilters && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Attivi</span>}
              </Button>
              
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="text-gray-600"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancella Filtri
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {selectedStudentIds.size} di {filteredStudents.length} selezionati
                {totalPages > 1 && (
                  <span className="ml-2">• Pagina {currentPage} di {totalPages}</span>
                )}
              </span>
              
              {filteredStudents.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={selectedStudentIds.size === filteredStudents.length}
                  >
                    Seleziona Tutti
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAll}
                    disabled={selectedStudentIds.size === 0}
                  >
                    Deseleziona Tutti
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Genere</label>
                <select
                  value={filters.gender}
                  onChange={(e) => handleFilterChange('gender', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tutti</option>
                  <option value="M">Maschio</option>
                  <option value="F">Femmina</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Classe Attuale</label>
                <select
                  value={filters.currentClass}
                  onChange={(e) => handleFilterChange('currentClass', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tutte le classi</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stato Iscrizione</label>
                <select
                  value={filters.enrollmentStatus}
                  onChange={(e) => handleFilterChange('enrollmentStatus', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Tutti</option>
                  <option value="enrolled">Solo Iscritti</option>
                  <option value="not_enrolled">Solo Non Iscritti</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Età</label>
                <input
                  type="number"
                  value={filters.age}
                  onChange={(e) => handleFilterChange('age', e.target.value)}
                  placeholder="Inserisci età..."
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Città</label>
                <input
                  type="text"
                  value={filters.city}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                  placeholder="Cerca per città..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modalità Frequenza</label>
                <select
                  value={filters.attendanceMode}
                  onChange={(e) => handleFilterChange('attendanceMode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Tutte</option>
                  <option value="in_presenza">In Presenza</option>
                  <option value="online">Online</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Students List */}
        <div className="flex-1 min-h-0 flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Caricamento studenti...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Users className="h-16 w-16 text-gray-300 mb-4" />
              <p className="text-lg font-medium mb-2">
                {availableStudents.length === 0 ? 'Nessuno studente disponibile' : 'Nessun risultato trovato'}
              </p>
              <p className="text-sm">
                {availableStudents.length === 0 
                  ? 'Tutti gli studenti sono già assegnati a questa classe'
                  : 'Prova a modificare i criteri di ricerca o i filtri'
                }
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paginatedStudents.map(student => {
                  const isSelected = selectedStudentIds.has(student.id);
                  const currentClass = classes.find(c => c.id === student.currentClass);
                  
                  return (
                    <div
                      key={student.id}
                      onClick={() => handleStudentToggle(student.id)}
                      className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Selection Indicator */}
                      <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-gray-300'
                      }`}>
                        {isSelected && <Check className="h-4 w-4 text-white" />}
                      </div>

                      {/* Student Info */}
                      <div className="flex items-start gap-3 pr-8">
                        <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-medium flex-shrink-0">
                          {student.displayName?.charAt(0).toUpperCase() || '?'}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate">
                            {student.displayName}
                          </h4>
                          
                          <div className="space-y-1 mt-2">
                            {/* Account Status Badge */}
                            {student.accountStatus === 'pending_approval' && (
                              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mb-2">
                                In attesa di approvazione
                              </div>
                            )}
                            
                            {student.phoneNumber && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="h-3 w-3" />
                                <span>{student.phoneNumber}</span>
                              </div>
                            )}
                            
                            {student.parentName && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Users className="h-3 w-3" />
                                <span className="truncate">{student.parentName}</span>
                              </div>
                            )}
                            
                            {student.city && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <MapPin className="h-3 w-3" />
                                <span>{student.city}</span>
                              </div>
                            )}
                            
                            {student.birthDate && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Calendar className="h-3 w-3" />
                                <span>{calculateAge(student.birthDate)} anni</span>
                              </div>
                            )}
                            
                            {currentClass && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <School className="h-3 w-3" />
                                <span className="truncate">{currentClass.name}</span>
                              </div>
                            )}
                          </div>

                          {/* Status Badges */}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {student.isEnrolled && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                Iscritto
                              </span>
                            )}
                            {student.gender && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                                {student.gender === 'M' ? 'Maschio' : 'Femmina'}
                              </span>
                            )}
                            {student.attendanceMode && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                {student.attendanceMode === 'in_presenza' ? 'In Presenza' : 'Online'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Precedente
                  </button>
                  
                  <div className="flex items-center gap-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-10 h-10 text-sm font-medium rounded-lg ${
                            pageNum === currentPage
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Successiva
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedStudentIds.size > 0 && (
                <span className="font-medium">
                  {selectedStudentIds.size} {selectedStudentIds.size === 1 ? 'studente selezionato' : 'studenti selezionati'}
                </span>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
              >
                Annulla
              </Button>
              <Button
                onClick={handleAddSelected}
                disabled={selectedStudentIds.size === 0}
                className="flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Aggiungi {selectedStudentIds.size > 0 && `(${selectedStudentIds.size})`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
