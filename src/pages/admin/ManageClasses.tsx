import React, { useState, useEffect } from 'react';
import { Calendar, ArrowLeft, Plus, Accessibility, MapPin, Search, Users, X, School, BookOpen, FileText, UserCheck, Trash2, Shield, ClipboardList, Filter, ChevronLeft, ChevronRight, TrendingUp, UserPlus, UserMinus, Eye, Mail, Phone, Edit3, UserX, ArrowUp, ArrowDown, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { CreateClassDialog } from '../../components/dialogs/CreateClassDialog';
import { canDeleteResource } from '../../utils/permissions';
import { AddStudentDialog } from '../../components/dialogs/AddStudentDialog';
import { collection, getDocs, query, where, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Class, User } from '../../types';
import { useNavigate } from 'react-router-dom';

export const ManageClasses: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [teachers, setTeachers] = useState<Record<string, User>>({});
  const [students, setStudents] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTurno, setSelectedTurno] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const classesPerPage = 6;
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  // Advanced Filters
  const [filters, setFilters] = useState({
    name: '',
    description: '',
    turno: '',
    teacher: '',
    level: '',
    status: '',
    attendanceMode: ''
  });
  
  // View mode filter - starts with null to force selection
  const [viewMode, setViewMode] = useState<'in_presenza' | 'online' | null>(null);

  // Advanced Sorting - each field has its own sort state
  const [sortStates, setSortStates] = useState<{
    createdAt: 'desc' | 'asc' | null;
    name: 'desc' | 'asc' | null;
    studentCount: 'desc' | 'asc' | null;
    turno: 'desc' | 'asc' | null;
  }>({
    createdAt: 'desc', // Default active sort
    name: null,
    studentCount: null,
    turno: null
  });
  const [classStats, setClassStats] = useState<{
    totalStudents: number;
    attendancePercentage: number;
    averageGrade: number;
    activeAssignments: number;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false);
  const [isStudentDetailsOpen, setIsStudentDetailsOpen] = useState(false);
  const [isRemoveStudentDialogOpen, setIsRemoveStudentDialogOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<{ id: string; name: string } | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isDeletionWarningOpen, setIsDeletionWarningOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<{ id: string; name: string; studentCount: number } | null>(null);
  const [isChangeTeacherDialogOpen, setIsChangeTeacherDialogOpen] = useState(false);
  const [isAssignAssistantDialogOpen, setIsAssignAssistantDialogOpen] = useState(false);
  const [availableTeachers, setAvailableTeachers] = useState<User[]>([]);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');

  // Function to fetch class statistics
  const fetchClassStats = async () => {
    if (!userProfile) return;
    
    setLoadingStats(true);
    try {
      // Initialize default stats
      const defaultStats = {
        totalStudents: 0,
        attendancePercentage: 0,
        averageGrade: 0,
        activeAssignments: 0
      };
      
      // Get all classes for the current teacher (or all classes if admin)
      let classesQuery = query(collection(db, 'classes'));
      if (userProfile.role === 'teacher' && 'uid' in userProfile) {
        classesQuery = query(classesQuery, where('teacherId', '==', userProfile.uid));
      }
      
      const classesSnapshot = await getDocs(classesQuery);
      const classIds = classesSnapshot.docs.map(doc => doc.id);
      
      if (classIds.length === 0) {
        setClassStats(defaultStats);
        return;
      }
      
      // Get all students in these classes - handle Firebase's 30-item limit for 'in' queries
      let totalStudents = 0;
      const batchSize = 25; // Keep it under 30 for safety
      
      for (let i = 0; i < classIds.length; i += batchSize) {
        const batch = classIds.slice(i, i + batchSize);
        const studentsQuery = query(
          collection(db, 'students'), 
          where('currentClass', 'in', batch)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        totalStudents += studentsSnapshot.size;
      }
      
      // Get active assignments (due in the future)
      const now = new Date();
      const assignmentsQuery = query(
        collection(db, 'homework'),
        where('dueDate', '>=', now)
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      
      // For now, we'll use placeholder values for attendance and grades
      // In a real app, you would fetch and calculate these from your database
      const stats = {
        totalStudents,
        attendancePercentage: totalStudents > 0 ? 75 : 0, // Placeholder
        averageGrade: 8.5, // Placeholder
        activeAssignments: assignmentsSnapshot.size
      };
      
      setClassStats(stats);
      
    } catch (error) {
      console.error('Error fetching class statistics:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchClassStats();
  }, [userProfile]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'operatore')) return;
      
      setIsLoading(true);
      try {
        // Fetch all classes
        const classesQuery = query(collection(db, 'classes'));
        const classesDocs = await getDocs(classesQuery);
        const classesData = classesDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));
        setClasses(classesData);

        // Fetch all teachers
        const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const teachersDocs = await getDocs(teachersQuery);
        const teachersMap: Record<string, User> = {};
        teachersDocs.docs.forEach(doc => {
          const userData = { ...doc.data(), id: doc.id } as User;
          teachersMap[doc.id] = userData;
        });
        setTeachers(teachersMap);

        // Fetch all students from students collection
        const studentsQuery = query(collection(db, 'students'));
        const studentsDocs = await getDocs(studentsQuery);
        const studentsMap: Record<string, any> = {};
        studentsDocs.docs.forEach(doc => {
          const studentData = { ...doc.data(), id: doc.id };
          studentsMap[doc.id] = studentData;
        });
        setStudents(studentsMap);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userProfile, refreshKey]);

  // Advanced filtering and sorting logic
  useEffect(() => {
    let filtered = classes.filter(classItem => {
      // Basic search (legacy support)
      const matchesBasicSearch = !searchQuery || 
        classItem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        classItem.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesBasicTurno = !selectedTurno || classItem.turno === selectedTurno;

      // Advanced filters
      const matchesName = !filters.name || 
        classItem.name.toLowerCase().includes(filters.name.toLowerCase());
      
      const matchesDescription = !filters.description || 
        classItem.description.toLowerCase().includes(filters.description.toLowerCase());
      
      const matchesTurno = !filters.turno || classItem.turno === filters.turno;
      
      const matchesTeacher = !filters.teacher || 
        (classItem.teacherId && teachers[classItem.teacherId]?.displayName.toLowerCase().includes(filters.teacher.toLowerCase()));
      
      const matchesLevel = !filters.level || 
        (classItem.description && classItem.description.toLowerCase().includes(filters.level.toLowerCase()));
      
      const matchesStatus = !filters.status || true; // Simplified for now

      return matchesBasicSearch && matchesBasicTurno && 
             matchesName && matchesDescription && matchesTurno && 
             matchesTeacher && matchesLevel && matchesStatus;
    });

    // Apply advanced sorting - find the active sort field
    const activeSortField = Object.entries(sortStates).find(([_, order]) => order !== null)?.[0] as keyof typeof sortStates;
    const activeSortOrder = activeSortField ? sortStates[activeSortField] : 'desc';
    
    if (activeSortField && activeSortOrder) {
      filtered.sort((a, b) => {
        let comparison = 0;
        
        switch (activeSortField) {
          case 'createdAt':
            const aDate = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt : new Date((a.createdAt as any).seconds * 1000)) : new Date(0);
            const bDate = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt : new Date((b.createdAt as any).seconds * 1000)) : new Date(0);
            comparison = aDate.getTime() - bDate.getTime();
            break;
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'studentCount':
            const aCount = a.students?.length || 0;
            const bCount = b.students?.length || 0;
            comparison = aCount - bCount;
            break;
          case 'turno':
            comparison = (a.turno || '').localeCompare(b.turno || '');
            break;
        }
        
        return activeSortOrder === 'asc' ? comparison : -comparison;
      });
    }

    // Apply view mode filter
    if (viewMode) {
      filtered = filtered.filter(cls => {
        if (viewMode === 'online') {
          return (cls as any).attendanceMode === 'online' || (cls as any).isOnline === true;
        } else if (viewMode === 'in_presenza') {
          return (cls as any).attendanceMode !== 'online' && (cls as any).isOnline !== true;
        }
        return true;
      });
    }

    setFilteredClasses(filtered);
    setCurrentPage(1); // Reset pagination when filters change
  }, [classes, searchQuery, selectedTurno, filters, sortStates, teachers, viewMode]);

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
        name: null,
        studentCount: null,
        turno: null
      } as typeof prev;
      
      // Toggle the selected field
      if (prev[field] === null) {
        newState[field] = 'desc';
      } else if (prev[field] === 'desc') {
        newState[field] = 'asc';
      } else {
        newState[field] = null;
      }
      
      return newState;
    });
  };

  // Create filteredClasses state
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);

  // Get unique turnos for filter dropdown
  const uniqueTurnos = Array.from(new Set(classes.map(c => c.turno).filter(Boolean)));

  // Function to get turno color styling
  const getTurnoColorClass = (turno: string) => {
    const colors = {
      'Mattina': 'bg-gradient-to-r from-amber-100 to-yellow-200 text-amber-800 border-amber-300',
      'Pomeriggio': 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border-blue-300',
      'Sera': 'bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border-purple-300',
      'Serale': 'bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-800 border-indigo-300',
      'Weekend': 'bg-gradient-to-r from-green-100 to-emerald-200 text-green-800 border-green-300',
      'Intensivo': 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border-red-300',
      'Online': 'bg-gradient-to-r from-cyan-100 to-cyan-200 text-cyan-800 border-cyan-300',
    };
    return colors[turno as keyof typeof colors] || 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 border-gray-300';
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredClasses.length / classesPerPage);
  const startIndex = (currentPage - 1) * classesPerPage;
  const endIndex = startIndex + classesPerPage;
  const paginatedClasses = filteredClasses.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTurno]);

  // Fetch class statistics when a class is selected
  useEffect(() => {
    const fetchClassStats = async () => {
      if (!selectedClass) {
        setClassStats(null);
        return;
      }

      setLoadingStats(true);
      try {
        // Calculate total students
        const totalStudents = selectedClass.students?.length || 0;

        // Fetch attendance records for this class
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('classId', '==', selectedClass.id)
        );
        const attendanceDocs = await getDocs(attendanceQuery);
        
        // Calculate attendance percentage
        let attendancePercentage = 0;
        if (attendanceDocs.docs.length > 0 && totalStudents > 0) {
          const totalAttendanceRecords = attendanceDocs.docs.length;
          const presentCount = attendanceDocs.docs.reduce((count, doc) => {
            const data = doc.data();
            return count + (data.attendanceData?.filter((record: any) => record.status === 'present')?.length || 0);
          }, 0);
          
          attendancePercentage = Math.round((presentCount / (totalAttendanceRecords * totalStudents)) * 100);
        }

        // Fetch next lesson
        const lessonsQuery = query(
          collection(db, 'lessons'),
          where('classId', '==', selectedClass.id)
        );
        const lessonsDocs = await getDocs(lessonsQuery);
        
        let nextLesson = null;
        if (lessonsDocs.docs.length > 0) {
          const now = new Date();
          const futureLessons = lessonsDocs.docs
            .map(doc => ({ ...doc.data(), id: doc.id }))
            .filter((lesson: any) => new Date(lesson.date) > now)
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          if (futureLessons.length > 0) {
            const nextLessonData = futureLessons[0] as any;
            nextLesson = new Date(nextLessonData.date).toLocaleDateString('it-IT', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          }
        }

        setClassStats({
          totalStudents,
          attendancePercentage: isNaN(attendancePercentage) ? 0 : attendancePercentage,
          nextLesson
        });
      } catch (error) {
        console.error('Error fetching class stats:', error);
        setClassStats({
          totalStudents: selectedClass.students?.length || 0,
          attendancePercentage: 0,
          nextLesson: null
        });
      } finally {
        setLoadingStats(false);
      }
    };

    fetchClassStats();
  }, [selectedClass]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTurno('');
    setFilters({
      name: '',
      description: '',
      turno: '',
      teacher: '',
      level: '',
      status: '',
      attendanceMode: ''
    });
    setSortStates({
      createdAt: 'desc',
      name: null,
      studentCount: null,
      turno: null
    });
    setViewMode(null);
  };


  const handleAddStudents = async (studentIds: string[], previousClassId?: string) => {
    if (!selectedClass || studentIds.length === 0) return;

    try {
      const batch = writeBatch(db);
      const classRef = doc(db, 'classes', selectedClass.id);
      
      // Filter out students who are already in this class
      const studentsToAdd = studentIds.filter(id => !selectedClass.students?.includes(id));
      
      if (studentsToAdd.length === 0) {
        console.log('All selected students are already in this class');
        return;
      }
      
      // First, handle the case where we're transferring from another class
      if (previousClassId && previousClassId !== selectedClass.id) {
        // Remove student from previous class
        const previousClassRef = doc(db, 'classes', previousClassId);
        batch.update(previousClassRef, {
          students: arrayRemove(...studentsToAdd)
        });
      }
      
      // Add students to the new class if they're not already in it
      batch.update(classRef, {
        students: arrayUnion(...studentsToAdd)
      });

      // Update each student's record and approve parent if needed
      for (const studentId of studentsToAdd) {
        const studentRef = doc(db, 'students', studentId);
        
        // Get student data to access parentId
        const studentDoc = await getDoc(studentRef);
        const studentData = studentDoc.data();
        const parentId = studentData?.parentId;
        
        batch.update(studentRef, {
          accountStatus: 'active',
          isEnrolled: true,
          enrollmentDate: new Date(),
          currentClass: selectedClass.id,
          classHistory: arrayUnion({
            classId: selectedClass.id,
            className: selectedClass.name,
            joinedAt: new Date(),
            ...(previousClassId && { transferredFrom: previousClassId })
          })
        });
        
        // If student has a parent, also approve the parent if not already approved
        if (parentId) {
          const parentRef = doc(db, 'users', parentId);
          const parentDoc = await getDoc(parentRef);
          const parentData = parentDoc.data();
          
          // Only update parent if they're not already active
          if (parentData && parentData.accountStatus !== 'active') {
            batch.update(parentRef, {
              accountStatus: 'active',
              updatedAt: new Date()
            });
          }
        }
      }

      // Execute all updates in a batch
      await batch.commit();

      // Update local state
      setSelectedClass(prev => {
        if (!prev) return null;
        const currentStudents = new Set(prev.students || []);
        studentsToAdd.forEach(id => currentStudents.add(id));
        return {
          ...prev,
          students: Array.from(currentStudents)
        };
      });

      // If this was a transfer, we need to update the previous class's student list
      if (previousClassId && previousClassId !== selectedClass.id) {
        setClasses(prevClasses => 
          prevClasses.map(cls => {
            if (cls.id === previousClassId) {
              return {
                ...cls,
                students: (cls.students || []).filter(id => !studentsToAdd.includes(id))
              };
            }
            return cls;
          })
        );
      }

      setIsAddStudentDialogOpen(false);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error adding/transferring students:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
      throw error; // Re-throw to allow the dialog to handle the error
    }
  };

  const handleRemoveStudentClick = (studentId: string, studentName: string) => {
    setStudentToRemove({ id: studentId, name: studentName });
    setIsRemoveStudentDialogOpen(true);
  };

  const handleRemoveStudent = async () => {
    if (!selectedClass || !studentToRemove) return;

    try {
      const batch = writeBatch(db);
      
      // Remove student from class
      const classRef = doc(db, 'classes', selectedClass.id);
      batch.update(classRef, {
        students: arrayRemove(studentToRemove.id)
      });

      // Clear currentClass field from student record
      const studentRef = doc(db, 'students', studentToRemove.id);
      batch.update(studentRef, {
        currentClass: null,
        updatedAt: new Date()
      });

      // Execute batch operation
      await batch.commit();

      // Update local state
      setSelectedClass(prev => prev ? {
        ...prev,
        students: (prev.students || []).filter(id => id !== studentToRemove.id)
      } : null);

      setRefreshKey(prev => prev + 1);
      setIsRemoveStudentDialogOpen(false);
      setStudentToRemove(null);
    } catch (error) {
      console.error('Error removing student:', error);
    }
  };

  const handleViewStudentDetails = (student: any) => {
    setSelectedStudent(student);
    setIsStudentDetailsOpen(true);
  };

  // Fetch available teachers when dialogs open
  useEffect(() => {
    const fetchAvailableTeachers = async () => {
      if (!isChangeTeacherDialogOpen && !isAssignAssistantDialogOpen) return;
      
      try {
        const teachersQuery = query(
          collection(db, 'users'), 
          where('role', '==', 'teacher'),
          where('accountStatus', '==', 'active')
        );
        const teachersDocs = await getDocs(teachersQuery);
        const allTeachers = teachersDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        
        // Filter by teacher type based on dialog
        let filteredTeachers = allTeachers;
        if (isChangeTeacherDialogOpen) {
          // Main teacher: show regolare and volontario
          filteredTeachers = allTeachers;
        } else if (isAssignAssistantDialogOpen) {
          // Assistant: show assistente
          filteredTeachers = allTeachers.filter(teacher => 
            (teacher as any).teacherType === 'assistente'
          );
        }
        
        setAvailableTeachers(filteredTeachers);
      } catch (error) {
        console.error('Error fetching available teachers:', error);
      }
    };

    fetchAvailableTeachers();
  }, [isChangeTeacherDialogOpen, isAssignAssistantDialogOpen]);

  const handleChangeTeacher = async (teacherId: string) => {
    if (!selectedClass) return;

    try {
      // Update class with new teacher
      await updateDoc(doc(db, 'classes', selectedClass.id), {
        teacherId: teacherId
      });

      // Update teacher status to assigned
      await updateDoc(doc(db, 'users', teacherId), {
        assigned: true
      });

      // If there was a previous teacher, update their status to unassigned
      if (selectedClass.teacherId && selectedClass.teacherId !== teacherId) {
        await updateDoc(doc(db, 'users', selectedClass.teacherId), {
          assigned: false
        });
      }

      // Update local state
      setSelectedClass(prev => prev ? {
        ...prev,
        teacherId: teacherId
      } : null);

      setIsChangeTeacherDialogOpen(false);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error changing teacher:', error);
    }
  };

  const handleAssignAssistant = async (assistantId: string) => {
    if (!selectedClass) return;

    try {
      // Update class with new assistant
      await updateDoc(doc(db, 'classes', selectedClass.id), {
        assistantId: assistantId
      });

      // Update assistant status to assigned
      await updateDoc(doc(db, 'users', assistantId), {
        assigned: true
      });

      // If there was a previous assistant, update their status to unassigned
      if ((selectedClass as any).assistantId && (selectedClass as any).assistantId !== assistantId) {
        await updateDoc(doc(db, 'users', (selectedClass as any).assistantId), {
          assigned: false
        });
      }

      // Update local state
      setSelectedClass(prev => prev ? {
        ...prev,
        assistantId: assistantId
      } : null);

      setIsAssignAssistantDialogOpen(false);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error assigning assistant:', error);
    }
  };

  const handleUnassignTeacher = async () => {
    if (!selectedClass || !selectedClass.teacherId) return;

    try {
      // Update class to remove teacher
      await updateDoc(doc(db, 'classes', selectedClass.id), {
        teacherId: null
      });

      // Update teacher status to unassigned
      await updateDoc(doc(db, 'users', selectedClass.teacherId), {
        assigned: false
      });

      // Update local state
      setSelectedClass(prev => prev ? {
        ...prev,
        teacherId: undefined
      } : null);

      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error unassigning teacher:', error);
    }
  };

  const handleRemoveAssistant = async () => {
    if (!selectedClass || !(selectedClass as any).assistantId) return;

    try {
      // Update class to remove assistant
      await updateDoc(doc(db, 'classes', selectedClass.id), {
        assistantId: null
      });

      // Update assistant status to unassigned
      await updateDoc(doc(db, 'users', (selectedClass as any).assistantId), {
        assigned: false
      });

      // Update local state
      setSelectedClass(prev => prev ? {
        ...prev,
        assistantId: null
      } : null);

      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error removing assistant:', error);
    }
  };


  const handleDeleteClass = async (classId: string) => {
    // Find the class to check if it has students
    const classToDeleteData = classes.find(c => c.id === classId);
    
    if (classToDeleteData && classToDeleteData.students && classToDeleteData.students.length > 0) {
      setClassToDelete({
        id: classId,
        name: classToDeleteData.name,
        studentCount: classToDeleteData.students.length
      });
      setIsDeletionWarningOpen(true);
      return;
    }

    if (!window.confirm('Sei sicuro di voler eliminare questa classe? Questa azione non può essere annullata.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'classes', classId));
      setClasses(prev => prev.filter(c => c.id !== classId));
      if (selectedClass?.id === classId) {
        setSelectedClass(null);
      }
    } catch (error) {
      console.error('Error deleting class:', error);
    }
  };

  const handleCloseDeletionWarning = () => {
    setIsDeletionWarningOpen(false);
    setClassToDelete(null);
  };

  if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'operatore')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-8 text-center max-w-md mx-auto">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Accesso Negato</h2>
          <p className="text-slate-600">Non hai i permessi per accedere a questa sezione.</p>
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
                <School className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold">Gestione Classi</h1>
                <p className="text-blue-100 mt-1 hidden sm:block">Crea, modifica e gestisci le classi della scuola</p>
              </div>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                aria-label="Crea Classe"
              >
                <Plus className="h-5 w-5 sm:mr-2" />
                <span className="hidden sm:inline">Crea Classe</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-light">Caricamento classi...</p>
          </div>
        ) : selectedClass ? (
          /* Class Details View */
          <div className="space-y-8">
            {/* Header responsive */}
            <div className="mb-4">
              {/* MOBILE: bottoni in riga + titolo centrato sotto */}
              <div className="md:hidden space-y-3">
                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={() => setSelectedClass(null)} className="shrink-0">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Torna alle Classi
                  </Button>

                  {canDeleteResource(userProfile?.role || 'student', 'classes') && (
                    <Button
                      variant="outline"
                      onClick={() => handleDeleteClass(selectedClass.id)}
                      className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Elimina
                    </Button>
                  )}
                </div>

                <h1 className="text-3xl font-semibold text-slate-900 text-center leading-snug break-words mt-4">
                  {selectedClass.name} {selectedClass.turno}
                </h1>
              </div>

              {/* DESKTOP: tre colonne → back | titolo centrato | elimina a destra */}
              <div className="hidden md:grid md:grid-cols-3 md:items-center">
                <div className="flex items-center">
                  <Button variant="outline" onClick={() => setSelectedClass(null)}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Torna alle Classi
                  </Button>
                </div>

                <div className="flex justify-center">
                  <h1 className="text-3xl font-semibold text-slate-900">
                    {selectedClass.name} {selectedClass.turno}
                  </h1>
                </div>

                <div className="flex justify-end">
                  {canDeleteResource(userProfile?.role || 'student', 'classes') && (
                    <Button
                      variant="outline"
                      onClick={() => handleDeleteClass(selectedClass.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Elimina
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Class Statistics */}
              {loadingStats ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-slate-600">Caricamento statistiche...</span>
                  </div>
                </div>
              ) : classStats ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Students */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 bg-teal-100 rounded-lg flex items-center justify-center">
                        <Users className="h-4 w-4 text-teal-600" />
                      </div>
                      <span className="text-sm font-medium text-teal-600">Studenti Totali</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{classStats?.totalStudents || 0}</div>
                    <div className="text-xs text-slate-500 mt-1">Nelle tue classi</div>
                  </div>

                  {/* Attendance Percentage */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 bg-orange-100 rounded-lg flex items-center justify-center">
                        <UserCheck className="h-4 w-4 text-orange-600" />
                      </div>
                      <span className="text-sm font-medium text-orange-600">Tasso Presenze</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{classStats?.attendancePercentage || 0}%</div>
                    <div className="text-xs text-slate-500 mt-1">Media generale</div>
                  </div>

                  {/* Active Classes */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Globe className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-blue-600">Media Voti</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{classStats?.averageGrade?.toFixed(1) || '0.0'}</div>
                    <div className="text-xs text-slate-500 mt-1">Media voti</div>
                  </div>

                  {/* Completed Activities */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-purple-600" />
                      </div>
                      <span className="text-sm font-medium text-purple-600">Compiti Attivi</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{classStats?.activeAssignments || 0}</div>
                    <div className="text-xs text-slate-500 mt-1">In scadenza</div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">Impossibile caricare le statistiche</p>
                  </div>
                </div>
              )}

              {/* Teacher Management */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="p-6 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    Gestione Docenti
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Teacher */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-slate-900">Docente Principale</h4>
                        <div className="flex gap-2">
                          {selectedClass.teacherId ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsChangeTeacherDialogOpen(true)}
                                className="flex items-center gap-2"
                              >
                                <Edit3 className="h-4 w-4" />
                                Cambia
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleUnassignTeacher}
                                className="flex items-center gap-2 text-red-600 hover:text-red-700"
                              >
                                <UserX className="h-4 w-4" />
                                Rimuovi
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsChangeTeacherDialogOpen(true)}
                              className="flex items-center gap-2"
                            >
                              <UserPlus className="h-4 w-4" />
                              Assegna
                            </Button>
                          )}
                        </div>
                      </div>
                      {selectedClass.teacherId && teachers[selectedClass.teacherId] ? (
                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                          <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">
                            {teachers[selectedClass.teacherId]?.displayName?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">
                              {teachers[selectedClass.teacherId]?.displayName}
                            </div>
                            <div className="text-sm text-slate-600">
                              {teachers[selectedClass.teacherId]?.email}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                          Nessun docente assegnato
                        </div>
                      )}
                    </div>

                    {/* Assistant */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-slate-900">Assistente</h4>
                        <div className="flex gap-2">
                          {(selectedClass as any).assistantId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleRemoveAssistant}
                              className="flex items-center gap-2 text-red-600 hover:text-red-700"
                            >
                              <UserX className="h-4 w-4" />
                              Rimuovi
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsAssignAssistantDialogOpen(true)}
                              className="flex items-center gap-2"
                            >
                              <UserPlus className="h-4 w-4" />
                              Assegna
                            </Button>
                          )}
                        </div>
                      </div>
                      {(selectedClass as any).assistantId && teachers[(selectedClass as any).assistantId] ? (
                        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                          <div className="h-10 w-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-medium">
                            {teachers[(selectedClass as any).assistantId]?.displayName?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">
                              {teachers[(selectedClass as any).assistantId]?.displayName}
                            </div>
                            <div className="text-sm text-slate-600">
                              {teachers[(selectedClass as any).assistantId]?.email}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                          Nessun assistente assegnato
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Students List */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="p-6 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Studenti ({selectedClass.students?.length || 0})
                    </h3>
                    <Button
                      onClick={() => setIsAddStudentDialogOpen(true)}
                      className="flex items-center gap-2"
                    >
                      <UserPlus className="h-4 w-4" />
                      Aggiungi Studente
                    </Button>
                  </div>
                </div>
                <div className="p-6">
                  {!selectedClass.students || selectedClass.students.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500 mb-4">Nessuno studente in questa classe</p>
                      <Button
                        onClick={() => setIsAddStudentDialogOpen(true)}
                        variant="outline"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Aggiungi il primo studente
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {selectedClass.students.map((studentId) => {
                        const student = students[studentId];
                        return (
                          <div key={studentId} className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                            <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">
                              {student.firstName.charAt(0).toUpperCase()}{student.lastName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-900 truncate">
                                {student?.displayName || 'Studente non trovato'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewStudentDetails(student)}
                                className="p-2"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRemoveStudentClick(studentId, student?.displayName || 'Studente')}
                                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onClick={() => navigate(`/lessons?classId=${selectedClass.id}&className=${encodeURIComponent(selectedClass.name)}&returnTo=classes`)}
                  className="bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-4">
                    <Users className="h-8 w-8 text-white/90" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">Le Mie Classi</h3>
                  <p className="text-sm text-white/80">Gestisci classi e studenti</p>
                </div>

                <div
                  onClick={() => navigate(`/attendance?classId=${selectedClass.id}&className=${encodeURIComponent(selectedClass.name)}&returnTo=classes`)}
                  className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-4">
                    <UserCheck className="h-8 w-8 text-white/90" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">Presenze</h3>
                  <p className="text-sm text-white/80">Registra presenze</p>
                </div>

                <div
                  onClick={() => navigate(`/homework?classId=${selectedClass.id}&className=${encodeURIComponent(selectedClass.name)}&returnTo=classes`)}
                  className="bg-gradient-to-br from-pink-500 to-pink-700 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-4">
                    <ClipboardList className="h-8 w-8 text-white/90" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">Compiti</h3>
                  <p className="text-sm text-white/80">Gestisci compiti</p>
                </div>

                <div
                  onClick={() => navigate(`/materials?classId=${selectedClass.id}&className=${encodeURIComponent(selectedClass.name)}&returnTo=classes`)}
                  className="bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-4">
                    <FileText className="h-8 w-8 text-white/90" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">Materiali</h3>
                  <p className="text-sm text-white/80">Carica materiali</p>
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === null ? (
          /* Initial Mode Selection Screen */
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="max-w-2xl mx-auto text-center">
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-12">
                <div className="mb-8">
                  <p className="text-lg text-slate-600 mb-8">
                    Scegli la modalità di frequenza delle classi che vuoi gestire
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div 
                    onClick={() => setViewMode('in_presenza')}
                    className="group cursor-pointer bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-8 hover:border-green-400 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                        <Users className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-green-800 mb-2">Classi in Presenza</h3>
                    </div>
                  </div>
                  
                  <div 
                    onClick={() => setViewMode('online')}
                    className="group cursor-pointer bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-2xl p-8 hover:border-blue-400 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                        <BookOpen className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-blue-800 mb-2">Classi Online</h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Classes Grid View */
          <div className="space-y-8">
            {/* Header responsive */}
            <div className="mb-4">
              {/* MOBILE: bottoni in riga + titolo centrato sotto */}
              <div className="md:hidden space-y-3">
                <div className="flex items-center justify-between">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setViewMode(null)}
                   >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Cambia Modalità
                  </Button>

                  {filteredClasses.length} di {classes.length} {classes.length === 1 ? 'classe' : 'classi'}
                </div>

                <div className="text-center mt-4">
                  <h2 className="text-2xl font-bold text-slate-900">
                    Classi {viewMode === 'in_presenza' ? 'in Presenza' : 'Online'}
                  </h2>
                  <p className="text-slate-600 mt-1">Clicca su una classe per gestirla</p>
                </div>
              </div>

              {/* DESKTOP: tre colonne → back | titolo centrato | elimina a destra */}
              <div className="hidden md:grid md:grid-cols-3 md:items-center">
                <div className="flex items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewMode(null)}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Cambia Modalità
                  </Button>
                </div>

                <div className="flex justify-center">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      Classi {viewMode === 'in_presenza' ? 'in Presenza' : 'Online'}
                    </h2>
                    <p className="text-slate-600 mt-1">Clicca su una classe per gestirla</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  {filteredClasses.length} di {classes.length} {classes.length === 1 ? 'classe' : 'classi'}
                  {totalPages > 1 && (
                    <span className="ml-2">• Pagina {currentPage} di {totalPages}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Filters and Sorting */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              {/* Basic Search and Turno Filter */}
              <div className="flex flex-col lg:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cerca per nome o descrizione..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className='flex-1'>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                      value={selectedTurno}
                      onChange={(e) => setSelectedTurno(e.target.value)}
                      className="pl-10 pr-8 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[140px]"
                    >
                      <option value="">Tutti i turni</option>
                      {uniqueTurnos.map(turno => (
                        <option key={turno} value={turno}>{turno}</option>
                      ))}
                    </select>
                  </div>
                </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    className="px-3"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filtri Avanzati
                  </Button>
                  
                  {(searchQuery || selectedTurno || Object.values(filters).some(v => v)) && (
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="px-3"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
              </div>

              {/* Advanced Filters */}
              {filtersOpen && (
                <div className="border-t border-slate-200 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                      <input
                        type="text"
                        placeholder="Filtra per nome..."
                        value={filters.name}
                        onChange={(e) => handleFilterChange('name', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Descrizione</label>
                      <input
                        type="text"
                        placeholder="Filtra per descrizione..."
                        value={filters.description}
                        onChange={(e) => handleFilterChange('description', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Insegnante</label>
                      <input
                        type="text"
                        placeholder="Filtra per insegnante..."
                        value={filters.teacher}
                        onChange={(e) => handleFilterChange('teacher', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Livello</label>
                      <input
                        type="text"
                        placeholder="Filtra per livello..."
                        value={filters.level}
                        onChange={(e) => handleFilterChange('level', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Sorting Row */}
              <div className="border-t border-slate-200 pt-4 mt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <ArrowUp className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">Ordinamento</h3>
                      <p className="text-xs text-gray-600">Clicca per ordinare</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 flex-wrap sm:justify-end">
                    <Button
                      onClick={() => handleSortToggle('createdAt')}
                      variant={sortStates.createdAt ? 'primary' : 'outline'}
                      size="sm"
                      className="rounded-xl transition-all text-xs"
                      leftIcon={
                        sortStates.createdAt === 'desc' ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : sortStates.createdAt === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : null
                      }
                    >
                      Data Creazione
                    </Button>
                    
                    <Button
                      onClick={() => handleSortToggle('name')}
                      variant={sortStates.name ? 'primary' : 'outline'}
                      size="sm"
                      className="rounded-xl transition-all text-xs"
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
                      onClick={() => handleSortToggle('studentCount')}
                      variant={sortStates.studentCount ? 'primary' : 'outline'}
                      size="sm"
                      className="rounded-xl transition-all text-xs"
                      leftIcon={
                        sortStates.studentCount === 'desc' ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : sortStates.studentCount === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : null
                      }
                    >
                      N° Studenti
                    </Button>
                    
                    <Button
                      onClick={() => handleSortToggle('turno')}
                      variant={sortStates.turno ? 'primary' : 'outline'}
                      size="sm"
                      className="rounded-xl transition-all text-xs"
                      leftIcon={
                        sortStates.turno === 'desc' ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : sortStates.turno === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : null
                      }
                    >
                      Turno
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {filteredClasses.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="p-12 text-center">
                  <School className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {classes.length === 0 ? 'Nessuna classe trovata' : 'Nessun risultato'}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {classes.length === 0 
                      ? 'Crea la prima classe per iniziare' 
                      : 'Prova a modificare i filtri di ricerca'
                    }
                  </p>
                  {classes.length === 0 ? (
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Crea Prima Classe
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-2" />
                      Cancella Filtri
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedClasses.map((classItem) => (
                    <div
                      key={classItem.id}
                      onClick={() => setSelectedClass(classItem)}
                      className="group relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-1"
                    >
                      {/* Background gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 via-blue-50/0 to-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      <div className="relative p-6">
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-700 transition-colors duration-200 truncate">
                              {classItem.name} {classItem.turno}
                            </h3>
                            <p className="text-sm text-slate-600 mt-2 line-clamp-2 leading-relaxed">{classItem.description}</p>
                          </div>
                          <div className="ml-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                            <School className="h-6 w-6" />
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors duration-200">
                            <div className="flex items-center gap-2 text-slate-700">
                              <Users className="h-4 w-4 text-blue-600" />
                              <span className="font-medium">Studenti</span>
                            </div>
                            <span className="font-bold text-slate-900 text-lg">{classItem.students?.length || 0}</span>
                          </div>
                          
                          {classItem.turno && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600 font-medium">Turno</span>
                              <span className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${getTurnoColorClass(classItem.turno)}`}>
                                {classItem.turno}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 font-medium">Insegnante</span>
                            <span className="font-semibold text-slate-900 text-sm text-right max-w-[140px] truncate">
                              {classItem.teacherId 
                                ? teachers[classItem.teacherId]?.displayName || 'Non assegnato'
                                : 'Non assegnato'
                              }
                            </span>
                          </div>
                        </div>
                        
                        <div className="mt-6 pt-4 border-t border-slate-200 group-hover:border-blue-200 transition-colors duration-200">
                          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 group-hover:text-blue-600 transition-colors duration-200">
                            <div className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                            <span className="font-medium">Clicca per gestire la classe</span>
                            <div className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Hover border effect */}
                      <div className="absolute inset-0 rounded-2xl border-2 border-blue-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                    </div>
                  ))}
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-8">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Precedente</span>
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <Button
                          key={page}
                          variant={page === currentPage ? undefined : "outline"}
                          onClick={() => setCurrentPage(page)}
                          className="w-10 h-10 p-0"
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-2"
                    >
                      <span className="hidden sm:inline">Successiva</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Class Dialog */}
      <CreateClassDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreated={() => {
          setRefreshKey(prev => prev + 1);
          setIsCreateDialogOpen(false);
        }}
      />

      {/* Add Student Dialog */}
      <AddStudentDialog
        isOpen={isAddStudentDialogOpen}
        onClose={() => setIsAddStudentDialogOpen(false)}
        onAddStudents={handleAddStudents}
        excludeStudentIds={selectedClass?.students || []}
        currentClassId={selectedClass?.id}
      />

      {/* Student Details Dialog */}
      {isStudentDetailsOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Dettagli Studente</h3>
                <button
                  onClick={() => setIsStudentDetailsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-medium">
                  {selectedStudent.firstName.charAt(0).toUpperCase()}{selectedStudent.lastName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-900">{selectedStudent.displayName}</h4>
                  <p className="text-gray-600">{selectedStudent.role}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* Contact Information */}
                {(selectedStudent as any).phoneNumber && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-700">Telefono Genitore</div>
                      <div className="text-gray-900">{(selectedStudent as any).phoneNumber}</div>
                    </div>
                  </div>
                )}

                {/* Personal Information */}
                {(selectedStudent as any).birthDate && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-700">Data di Nascita</div>
                      <div className="text-gray-900">
                        {(toJsDate((selectedStudent as any).birthDate))?.toLocaleDateString('it-IT')}
                      </div>
                    </div>
                  </div>
                )}

                {(selectedStudent as any).gender && (
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-700">Genere</div>
                      <div className="text-gray-900 capitalize">{(selectedStudent as any).gender.toLowerCase()}</div>
                    </div>
                  </div>
                )}

                {/* Address Information */}
                {((selectedStudent as any).address || (selectedStudent as any).city || (selectedStudent as any).postalCode) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-700">Indirizzo</div>
                      <div className="text-gray-900">
                        {[
                          (selectedStudent as any).address,
                          (selectedStudent as any).postalCode,
                          (selectedStudent as any).city
                        ].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Parent Information */}
                {(selectedStudent as any).parentName && (
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-700">Genitore</div>
                      <div className="text-gray-900">{(selectedStudent as any).parentName}</div>
                    </div>
                  </div>
                )}

                {/* Disability Information */}
                <div className="flex items-start gap-3">
                  <Accessibility className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Disabilità</div>
                    <div className="text-gray-900">
                      {(selectedStudent as any).hasDisability ? 'Sì' : 'No'}
                    </div>
                  </div>
                </div>

                {/* Codice Fiscale */}
                {selectedStudent.codiceFiscale && (
                  <div className="flex items-start gap-3">
                    <UserCheck className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-700">Codice Fiscale</div>
                      <div className="text-gray-900 font-mono text-sm">{selectedStudent.codiceFiscale}</div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Button
                  onClick={() => handleRemoveStudentClick(selectedStudent.id, selectedStudent.displayName || 'Studente')}
                  variant="outline"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Rimuovi dalla classe
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Student Confirmation Dialog */}
      {isRemoveStudentDialogOpen && studentToRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                  <UserX className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Rimuovi Studente</h3>
                  <p className="text-gray-600">Questa azione non può essere annullata</p>
                </div>
              </div>
              
              <p className="text-gray-700 mb-6">
                Sei sicuro di voler rimuovere <strong>{studentToRemove.name}</strong> dalla classe?
              </p>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setIsRemoveStudentDialogOpen(false);
                    setStudentToRemove(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Annulla
                </Button>
                <Button
                  onClick={handleRemoveStudent}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  Rimuovi
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Teacher Dialog */}
      {isChangeTeacherDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Cambia Docente</h3>
                <button
                  onClick={() => setIsChangeTeacherDialogOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cerca docente
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    value={teacherSearchQuery}
                    onChange={(e) => setTeacherSearchQuery(e.target.value)}
                    placeholder="Nome o email del docente..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {availableTeachers
                  .filter(teacher => 
                    (!teacherSearchQuery || 
                    teacher.displayName?.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
                    teacher.email?.toLowerCase().includes(teacherSearchQuery.toLowerCase()))
                  )
                  .map(teacher => (
                    <div
                      key={teacher.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                      onClick={() => handleChangeTeacher(teacher.id)}
                    >
                      <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">
                        {teacher.displayName?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{teacher.displayName}</div>
                        <div className="text-sm text-gray-600">{teacher.email}</div>
                      </div>
                    </div>
                  ))}
                {availableTeachers.filter(teacher => 
                  (!teacherSearchQuery || 
                  teacher.displayName?.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
                  teacher.email?.toLowerCase().includes(teacherSearchQuery.toLowerCase()))
                ).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    {teacherSearchQuery ? 'Nessun docente trovato' : 'Nessun docente disponibile'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Assistant Dialog */}
      {isAssignAssistantDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Assegna Assistente</h3>
                <button
                  onClick={() => setIsAssignAssistantDialogOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cerca assistente
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    value={teacherSearchQuery}
                    onChange={(e) => setTeacherSearchQuery(e.target.value)}
                    placeholder="Nome o email dell'assistente..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {availableTeachers
                  .filter(teacher => 
                    (!teacherSearchQuery || 
                    teacher.displayName?.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
                    teacher.email?.toLowerCase().includes(teacherSearchQuery.toLowerCase()))
                  )
                  .map(teacher => (
                    <div
                      key={teacher.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                      onClick={() => handleAssignAssistant(teacher.id)}
                    >
                      <div className="h-8 w-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-medium">
                        {teacher.displayName?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{teacher.displayName}</div>
                        <div className="text-sm text-gray-600">{teacher.email} • {teacher.role}</div>
                      </div>
                    </div>
                  ))}
                {availableTeachers.filter(teacher => 
                  (!teacherSearchQuery || 
                  teacher.displayName?.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
                  teacher.email?.toLowerCase().includes(teacherSearchQuery.toLowerCase()))
                ).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    {teacherSearchQuery ? 'Nessun assistente trovato' : 'Nessun assistente disponibile'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Class Deletion Warning Modal */}
      {isDeletionWarningOpen && classToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mr-4">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Impossibile Eliminare Classe</h3>
                  <p className="text-sm text-gray-600">Questa azione non può essere completata</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700">
                  La classe <span className="font-semibold">"{classToDelete.name}"</span> contiene{' '}
                  <span className="font-semibold">{classToDelete.studentCount} studenti</span>.
                </p>
                <p className="text-gray-600 mt-2">
                  Rimuovi prima tutti gli studenti dalla classe per poterla eliminare.
                </p>
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleCloseDeletionWarning}
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Chiudi
                </Button>
                <Button
                  onClick={handleCloseDeletionWarning}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Ho Capito
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageClasses;