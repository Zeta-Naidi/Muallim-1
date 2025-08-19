import { useEffect, useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFirestore } from '../../hooks/useFirestore';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageContainer } from '../../components/layout/PageContainer';
import { Search, Plus, ChevronRight, School, User as UserIcon, Users, FileText, Trash2, Phone, Mail, Calendar, Clock, CheckCircle, AlertCircle, Edit3, Eye, BookOpen, Paperclip, Download, File, Image, Video, Music, Archive, TrendingUp, Activity, X, MapPin, Info } from 'lucide-react';
import { Dialog } from '@headlessui/react';
import { EditClassDialog } from '../../components/dialogs/EditClassDialog';
import { CreateHomeworkDialog } from '../../components/dialogs/CreateHomeworkDialog';
import { EditHomeworkDialog } from '../../components/dialogs/EditHomeworkDialog';
import { AssignTeacherDialog } from '../../components/dialogs/AssignTeacherDialog';
import { AssignStudentsDialog } from '../../components/dialogs/AssignStudentsDialog';
import { CreateLessonDialog } from '../../components/dialogs/CreateLessonDialog';
import { EditLessonDialog } from '../../components/dialogs/EditLessonDialog';
import { CreateMaterialDialog } from '../../components/dialogs/CreateMaterialDialog';
import { MaterialAssignmentDialog } from '../../components/materials/MaterialAssignmentDialog';
import { CreateClassDialog } from '../../components/dialogs/CreateClassDialog';
import type { Homework, Lesson, LessonMaterial, User } from '../../types';
import { db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface ClassWithDetails {
  id: string;
  name: string;
  teacherName: string;
  studentsCount: number;
  recentHomeworkCount: number;
  status: 'active' | 'inactive';
  schedule?: string;
  level?: string;
  turno?: string;
  panoramica?: string;
  students?: string[];
}

type TabType = 'overview' | 'students' | 'homework' | 'lessons' | 'materials';

export const ManageClasses: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { getAll } = useFirestore<any>('classes');
  const { update: updateClass } = useFirestore<any>('classes');
  const { update: updateHomework, remove: removeHomework } = useFirestore<Homework>('homework');
  const { update: updateLesson, remove: removeLesson } = useFirestore<Lesson>('lessons');
  const { getAll: getAllHomework } = useFirestore<Homework>('homework');
  const { getAll: getAllLessons } = useFirestore<Lesson>('lessons');
  const { getAll: getAllMaterials } = useFirestore<LessonMaterial>('materials');
  const { remove: removeMaterial } = useFirestore<LessonMaterial>('materials');

  const [classes, setClasses] = useState<ClassWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabType>('overview');
  const [selectedClassDetails, setSelectedClassDetails] = useState<ClassWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [turnoFilter, setTurnoFilter] = useState<string>('');
  const [sortKey, setSortKey] = useState<'name' | 'students' | 'status'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [isEditClassOpen, setIsEditClassOpen] = useState<boolean>(false);
  const [isCreateHomeworkOpen, setIsCreateHomeworkOpen] = useState<boolean>(false);
  const [isAssignTeacherOpen, setIsAssignTeacherOpen] = useState<boolean>(false);
  const [isAssignStudentsOpen, setIsAssignStudentsOpen] = useState<boolean>(false);
  const [isCreateLessonOpen, setIsCreateLessonOpen] = useState<boolean>(false);
  const [isCreateMaterialOpen, setIsCreateMaterialOpen] = useState<boolean>(false);
  const [assignMaterialTarget, setAssignMaterialTarget] = useState<LessonMaterial | null>(null);
  const [isCreateClassOpen, setIsCreateClassOpen] = useState<boolean>(false);

  // Tab data states
  const [homework, setHomework] = useState<Homework[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [materials, setMaterials] = useState<LessonMaterial[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);
  const [classStudents, setClassStudents] = useState<User[]>([]);
  const [studentsSearch, setStudentsSearch] = useState('');
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [homeworkFilter, setHomeworkFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [homeworkSort, setHomeworkSort] = useState<'dueDate' | 'created' | 'title'>('dueDate');
  const [lessonsSort, setLessonsSort] = useState<'date' | 'created' | 'title'>('date');
  const [materialsSort, setMaterialsSort] = useState<'created' | 'title' | 'type'>('created');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [studentToRemove, setStudentToRemove] = useState<User | null>(null);
  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [lessonsMonthFilter, setLessonsMonthFilter] = useState<string>('');
  const [homeworkToDelete, setHomeworkToDelete] = useState<Homework | null>(null);
  const [lessonToDelete, setLessonToDelete] = useState<Lesson | null>(null);
  const [materialToDelete, setMaterialToDelete] = useState<LessonMaterial | null>(null);
  const [deletingHomeworkId, setDeletingHomeworkId] = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  // Filter + sort classes (memoized)
  const filteredClasses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = (classes || [])
      .filter((cls) => {
        if (!q) return true;
        return (
          cls.name.toLowerCase().includes(q) ||
          cls.teacherName.toLowerCase().includes(q)
        );
      })
      .filter((cls) => {
        if (!turnoFilter) return true;
        return (cls.turno || '') === turnoFilter;
      });

    const sorted = [...list].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';
      if (sortKey === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortKey === 'students') {
        valA = a.studentsCount;
        valB = b.studentsCount;
      } else if (sortKey === 'status') {
        // Active first
        valA = a.status === 'active' ? 0 : 1;
        valB = b.status === 'active' ? 0 : 1;
      }
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [classes, searchQuery, turnoFilter, sortKey, sortDir]);

  // Fetch classes from Firestore
  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      if (!userProfile) return;
      setIsLoading(true);
      setError(null);
      try {
        // Optionally add role-based filters here if your schema supports it
        const filters = userProfile.role === 'teacher' ? { teacherId: userProfile.id } : undefined;
        const docs = await getAll(filters);
        if (isCancelled) return;
        const mapped: ClassWithDetails[] = (docs || []).map((d: any) => ({
          id: d.id,
          name: d.name || d.title || 'Classe senza nome',
          teacherName: d.teacherName || d.teacher?.name || 'Insegnante non assegnato',
          studentsCount: typeof d.studentsCount === 'number' ? d.studentsCount : Array.isArray(d.students) ? d.students.length : 0,
          recentHomeworkCount: typeof d.recentHomeworkCount === 'number' ? d.recentHomeworkCount : 0,
          status: d.status === 'inactive' ? 'inactive' : 'active',
          schedule: d.schedule || d.timeSlot || undefined,
          level: d.level || d.grade || undefined,
          turno: d.turno || undefined,
          panoramica: d.panoramica || undefined,
          students: Array.isArray(d.students) ? d.students : [],
        }));
        setClasses(mapped);
        if (mapped.length > 0 && !selectedClass) {
          setSelectedClass(mapped[0].id);
          setSelectedClassDetails(mapped[0]);
        }
      } catch (e: any) {
        console.error('Error loading classes:', e);
        if (!isCancelled) setError('Impossibile caricare le classi. Riprova.');
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      isCancelled = true;
    };
  }, [userProfile, getAll, reloadKey]);

  // Sync selected class details
  useEffect(() => {
    if (selectedClass) {
      const details = classes.find((cls) => cls.id === selectedClass) || null;
      setSelectedClassDetails(details);
    }
  }, [selectedClass, classes]);

  // Load tab data when tab changes or class reloads
  useEffect(() => {
    const loadTab = async () => {
      if (!selectedClassDetails) return;
      setTabLoading(true);
      setTabError(null);
      try {
        if (selectedTab === 'homework') {
          const items = await getAllHomework({ classId: selectedClassDetails.id });
          setHomework((items || []).map((h: any) => ({
            ...h,
            dueDate: h.dueDate instanceof Date ? h.dueDate : (h.dueDate?.toDate?.() || new Date()),
            createdAt: h.createdAt instanceof Date ? h.createdAt : (h.createdAt?.toDate?.() || new Date()),
          })));
        } else if (selectedTab === 'lessons') {
          const items = await getAllLessons({ classId: selectedClassDetails.id });
          setLessons((items || []).map((l: any) => ({
            ...l,
            date: l.date instanceof Date ? l.date : (l.date?.toDate?.() || new Date()),
            createdAt: l.createdAt instanceof Date ? l.createdAt : (l.createdAt?.toDate?.() || new Date()),
          })));
        } else if (selectedTab === 'materials') {
          const items = await getAllMaterials({ classId: selectedClassDetails.id });
          setMaterials((items || []).map((m: any) => ({
            ...m,
            createdAt: m.createdAt instanceof Date ? m.createdAt : (m.createdAt?.toDate?.() || new Date()),
          })));
        } else if (selectedTab === 'students') {
          // Load assigned students by IDs from the class document
          const ids = selectedClassDetails.students || [];
          if (ids.length === 0) {
            setClassStudents([]);
          } else {
            const fetched: User[] = [];
            for (const uid of ids) {
              try {
                const snap = await getDoc(doc(db, 'users', uid));
                if (snap.exists()) {
                  const data: any = snap.data();
                  fetched.push({
                    id: snap.id,
                    email: data.email || '',
                    displayName: data.displayName || data.name || 'Senza nome',
                    role: data.role || 'student',
                    classId: data.classId,
                    createdAt: data.createdAt?.toDate?.() || new Date(),
                  } as User);
                }
              } catch (e) {
                console.warn('Impossibile leggere utente', uid, e);
              }
            }
            setClassStudents(fetched);
          }
        }
      } catch (e) {
        console.error('Error loading tab data:', e);
        setTabError('Errore nel caricamento dei dati');
      } finally {
        setTabLoading(false);
      }
    };
    loadTab();
  }, [selectedTab, selectedClassDetails, getAllHomework, getAllLessons, getAllMaterials, reloadKey]);

  // Remove student from class
  const handleRemoveStudent = async (studentId: string) => {
    if (!selectedClassDetails || removingStudentId) return;
    
    setRemovingStudentId(studentId);
    try {
      const updatedStudents = (selectedClassDetails.students || []).filter(id => id !== studentId);
      await updateClass(selectedClassDetails.id, { students: updatedStudents });
      
      // Update local state optimistically
      setClassStudents(prev => prev.filter(s => s.id !== studentId));
      setSelectedClassDetails(prev => prev ? { ...prev, students: updatedStudents, studentsCount: updatedStudents.length } : null);
      setClasses(prev => prev.map(cls => 
        cls.id === selectedClassDetails.id 
          ? { ...cls, students: updatedStudents, studentsCount: updatedStudents.length }
          : cls
      ));
      setStudentToRemove(null);
    } catch (error) {
      console.error('Error removing student:', error);
      setTabError('Errore nella rimozione dello studente. Riprova.');
    } finally {
      setRemovingStudentId(null);
    }
  };

  // Toggle homework status
  const handleToggleHomeworkStatus = async (homeworkId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'completed' : 'active';
      await updateHomework(homeworkId, { status: newStatus });
      
      // Update local state
      setHomework(prev => prev.map(h => 
        h.id === homeworkId ? { ...h, status: newStatus as 'active' | 'completed' } : h
      ));
    } catch (error) {
      console.error('Error updating homework status:', error);
      setTabError('Errore nell\'aggiornamento dello stato del compito.');
    }
  };

  // Delete homework
  const handleDeleteHomework = async (homeworkId: string) => {
    setDeletingHomeworkId(homeworkId);
    try {
      await deleteDoc(doc(db, 'homework', homeworkId));
      setHomework(prev => prev.filter(h => h.id !== homeworkId));
      setHomeworkToDelete(null);
    } catch (error) {
      console.error('Error deleting homework:', error);
    } finally {
      setDeletingHomeworkId(null);
    }
  };

  // Delete lesson
  const handleDeleteLesson = async (lessonId: string) => {
    setDeletingLessonId(lessonId);
    try {
      await deleteDoc(doc(db, 'lessons', lessonId));
      setLessons(prev => prev.filter(l => l.id !== lessonId));
      setLessonToDelete(null);
    } catch (error) {
      console.error('Error deleting lesson:', error);
    } finally {
      setDeletingLessonId(null);
    }
  };

  // Delete material
  const handleDeleteMaterial = async (materialId: string) => {
    setDeletingMaterialId(materialId);
    try {
      await removeMaterial(materialId);
      setMaterials(prev => prev.filter(m => m.id !== materialId));
      setMaterialToDelete(null);
    } catch (error) {
      console.error('Error deleting material:', error);
      setTabError('Errore nell\'eliminazione del materiale.');
    } finally {
      setDeletingMaterialId(null);
    }
  };

  // Get homework status info
  const getHomeworkStatusInfo = (homework: Homework) => {
    const now = new Date();
    const isOverdue = homework.dueDate < now && homework.status === 'active';
    const isDueSoon = homework.dueDate > now && homework.dueDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000; // Due within 24h
    
    return { isOverdue, isDueSoon };
  };

  // Get lesson status info
  const getLessonStatusInfo = (lesson: Lesson) => {
    const now = new Date();
    const lessonDate = new Date(lesson.date);
    const isToday = lessonDate.toDateString() === now.toDateString();
    const isPast = lessonDate < now && !isToday;
    const isUpcoming = lessonDate > now;
    
    return { isToday, isPast, isUpcoming };
  };

  // Helpers for Students UI
  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  };

  const colorClasses = [
    'bg-indigo-100 text-indigo-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-sky-100 text-sky-700',
    'bg-rose-100 text-rose-700',
    'bg-purple-100 text-purple-700',
  ];

  const colorForString = (s?: string) => {
    if (!s) return colorClasses[0];
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    return colorClasses[hash % colorClasses.length];
  };

  const filteredStudents = useMemo(() => {
    const q = studentsSearch.trim().toLowerCase();
    const list = (classStudents || []).slice().sort((a, b) =>
      (a.displayName || '').localeCompare(b.displayName || '')
    );
    if (!q) return list;
    return list.filter((s) =>
      [s.displayName, s.email].some((f) => f?.toLowerCase().includes(q))
    );
  }, [classStudents, studentsSearch]);

  const filteredHomework = useMemo(() => {
    let list = homework.slice();
    
    // Filter by status
    if (homeworkFilter !== 'all') {
      list = list.filter(h => h.status === homeworkFilter);
    }
    
    // Sort
    list.sort((a, b) => {
      if (homeworkSort === 'dueDate') {
        return a.dueDate.getTime() - b.dueDate.getTime();
      } else if (homeworkSort === 'created') {
        return b.createdAt.getTime() - a.createdAt.getTime();
      } else {
        return a.title.localeCompare(b.title);
      }
    });
    
    return list;
  }, [homework, homeworkFilter, homeworkSort]);

  const filteredLessons = useMemo(() => {
    let list = lessons.slice();
    
    // Filter by month if selected
    if (lessonsMonthFilter) {
      list = list.filter(l => {
        const lessonMonth = l.date.toISOString().slice(0, 7); // YYYY-MM format
        return lessonMonth === lessonsMonthFilter;
      });
    }
    
    // Sort
    list.sort((a, b) => {
      if (lessonsSort === 'date') {
        return b.date.getTime() - a.date.getTime(); // Most recent first
      } else if (lessonsSort === 'created') {
        return b.createdAt.getTime() - a.createdAt.getTime();
      } else {
        return a.title.localeCompare(b.title);
      }
    });
    
    return list;
  }, [lessons, lessonsSort, lessonsMonthFilter]);

  // Get available months from lessons
  const availableMonths = useMemo(() => {
    const months = lessons.map(l => l.date.toISOString().slice(0, 7));
    return [...new Set(months)].sort().reverse();
  }, [lessons]);

  const filteredMaterials = useMemo(() => {
    let list = materials.slice();
    
    // Sort
    list.sort((a, b) => {
      if (materialsSort === 'created') {
        return b.createdAt.getTime() - a.createdAt.getTime();
      } else if (materialsSort === 'type') {
        return (a.fileType || '').localeCompare(b.fileType || '');
      } else {
        return a.title.localeCompare(b.title);
      }
    });
    
    return list;
  }, [materials, materialsSort]);

  const tabs = [
    { id: 'overview', label: 'Panoramica', icon: <FileText className="h-4 w-4" /> },
    { id: 'students', label: 'Studenti', icon: <Users className="h-4 w-4" /> },
    { id: 'homework', label: 'Compiti', icon: <FileText className="h-4 w-4" /> },
    { id: 'lessons', label: 'Lezioni', icon: <School className="h-4 w-4" /> },
    { id: 'materials', label: 'Materiali', icon: <FileText className="h-4 w-4" /> },
  ];

  // Helper: compute next lesson label based on turno
  const getNextLessonLabel = (turno?: string): string => {
    if (!turno) return '—';
    const now = new Date();
    let targetDay: number | null = null; // 0 = Sun, 6 = Sat
    let hour = 0;
    let minute = 0;

    switch (turno) {
      case 'Sabato Pomeriggio':
        targetDay = 6;
        hour = 14; minute = 0;
        break;
      case 'Sabato Sera':
        targetDay = 6;
        hour = 17; minute = 0;
        break;
      case 'Domenica Mattina':
        targetDay = 0;
        hour = 9; minute = 0;
        break;
      case 'Domenica Pomeriggio':
        targetDay = 0;
        hour = 13; minute = 0;
        break;
      default:
        return '—';
    }

    const candidate = new Date(now);
    if (targetDay === null) return '—';
    const daysUntil = (targetDay - now.getDay() + 7) % 7;
    candidate.setDate(now.getDate() + daysUntil);
    candidate.setHours(hour, minute, 0, 0);
    // If it's today and time already passed, move to next week
    if (daysUntil === 0 && candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 7);
    }

    const weekday = candidate.toLocaleDateString('it-IT', { weekday: 'short' });
    const labelWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    const hh = String(candidate.getHours()).padStart(2, '0');
    const mm = String(candidate.getMinutes()).padStart(2, '0');
    const day = candidate.toLocaleDateString('it-IT', { day: '2-digit' });
    const month = candidate.toLocaleDateString('it-IT', { month: '2-digit' });
    return `${labelWeekday} ${hh}:${mm} • ${day}/${month}`;
  };

  // Get file type icon
  const getFileTypeIcon = (fileType?: string) => {
    if (!fileType) return <File className="h-5 w-5" />;
    
    if (fileType.startsWith('image/')) return <Image className="h-5 w-5 text-emerald-600" />;
    if (fileType.startsWith('video/')) return <Video className="h-5 w-5 text-blue-600" />;
    if (fileType.startsWith('audio/')) return <Music className="h-5 w-5 text-purple-600" />;
    if (fileType.includes('pdf')) return <FileText className="h-5 w-5 text-red-600" />;
    if (fileType.includes('zip') || fileType.includes('rar')) return <Archive className="h-5 w-5 text-amber-600" />;
    
    return <File className="h-5 w-5 text-slate-600" />;
  };

  // Class statistics for overview
  const classStats = useMemo(() => {
    if (!selectedClassDetails) return null;
    
    const activeHomework = homework.filter(h => h.status === 'active').length;
    const completedHomework = homework.filter(h => h.status === 'completed').length;
    const upcomingLessons = lessons.filter(l => new Date(l.date) > new Date()).length;
    const pastLessons = lessons.filter(l => new Date(l.date) < new Date()).length;
    const totalMaterials = materials.length;
    
    const recentActivity = [
      ...homework.slice(0, 3).map(h => ({
        type: 'homework' as const,
        title: h.title,
        date: h.createdAt,
        status: h.status
      })),
      ...lessons.slice(0, 3).map(l => ({
        type: 'lesson' as const,
        title: l.title,
        date: l.createdAt,
        status: new Date(l.date) > new Date() ? 'upcoming' : 'completed'
      })),
      ...materials.slice(0, 3).map(m => ({
        type: 'material' as const,
        title: m.title,
        date: m.createdAt,
        status: 'uploaded'
      }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);
    
    return {
      activeHomework,
      completedHomework,
      upcomingLessons,
      pastLessons,
      totalMaterials,
      recentActivity
    };
  }, [selectedClassDetails, homework, lessons, materials]);

  return (
    <PageContainer title="Gestione Classi" description="Crea, modifica e gestisci le classi">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-4 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">Le tue classi</h2>
                {(userProfile?.role === 'teacher' || userProfile?.role === 'admin') && (
                  <Button size="sm" onClick={() => setIsCreateClassOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Nuova classe
                  </Button>
                )}
              </div>
              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                  <Input
                    type="text"
                    placeholder="Cerca classe..."
                    className="pl-10 relative"
                    fullWidth
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <select
                      className="block w-full rounded-xl border bg-white py-2.5 px-3 text-sm text-slate-900 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 hover:border-slate-300 border-slate-200"
                      value={turnoFilter}
                      onChange={(e) => setTurnoFilter(e.target.value)}
                    >
                      <option value="">Tutti i turni</option>
                      <option value="Sabato Pomeriggio">Sabato Pomeriggio</option>
                      <option value="Sabato Sera">Sabato Sera</option>
                      <option value="Domenica Mattina">Domenica Mattina</option>
                      <option value="Domenica Pomeriggio">Domenica Pomeriggio</option>
                    </select>
                  </div>
                  <div className="relative">
                    <select
                      className="block w-full rounded-xl border bg-white py-2.5 px-3 text-sm text-slate-900 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 hover:border-slate-300 border-slate-200"
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value as any)}
                    >
                      <option value="name">Ordina: Nome</option>
                      <option value="students">Ordina: Studenti</option>
                      <option value="status">Ordina: Stato</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Direzione</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setSortDir('asc')} className={`h-7 px-2 text-xs ${sortDir==='asc' ? 'border-slate-500 text-slate-700' : ''}`}>Asc</Button>
                        <Button size="sm" variant="outline" onClick={() => setSortDir('desc')} className={`h-7 px-2 text-xs ${sortDir==='desc' ? 'border-slate-500 text-slate-700' : ''}`}>Desc</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 max-h-[calc(100vh-260px)] overflow-y-auto p-4 custom-scrollbar" role="listbox" aria-label="Elenco classi" tabIndex={0}
              onKeyDown={(e) => {
                if (!filteredClasses.length) return;
                const idx = filteredClasses.findIndex(c => c.id === selectedClass);
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const next = filteredClasses[(idx + 1) % filteredClasses.length];
                  setSelectedClass(next.id);
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  const prev = filteredClasses[(idx - 1 + filteredClasses.length) % filteredClasses.length];
                  setSelectedClass(prev.id);
                }
              }}
            >
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-lg border border-slate-200 animate-pulse">
                      <div className="h-4 w-1/3 bg-slate-200 rounded" />
                      <div className="mt-3 space-y-2">
                        <div className="h-3 w-1/2 bg-slate-200 rounded" />
                        <div className="h-3 w-1/4 bg-slate-200 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <p className="text-sm text-red-600 mb-3">{error}</p>
                  <Button variant="outline" onClick={() => setReloadKey(k => k + 1)}>
                    Riprova
                  </Button>
                </div>
              ) : filteredClasses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <School className="h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">
                    {searchQuery ? 'Nessun risultato' : 'Nessuna classe disponibile'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchQuery 
                      ? 'Prova a modificare i criteri di ricerca' 
                      : userProfile?.role === 'teacher' || userProfile?.role === 'admin'
                        ? 'Crea la tua prima classe per iniziare' 
                        : 'Non sei ancora iscritto a nessuna classe'}
                  </p>
                  {(userProfile?.role === 'teacher' || userProfile?.role === 'admin') && !searchQuery && (
                    <Button className="mt-4" onClick={() => setIsCreateClassOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Crea Classe
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredClasses.map((cls) => (
                    <motion.div
                      key={cls.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="relative"
                    >
                      <div 
                        className={`relative p-4 rounded-lg border transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-slate-500 ${
                          selectedClass === cls.id 
                            ? 'border-slate-300 bg-slate-50 shadow-inner' 
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedClass(cls.id)}
                        tabIndex={0}
                        role="option"
                        aria-selected={selectedClass === cls.id}
                      >
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium text-slate-900">
                            {cls.name}
                          </h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            cls.status === 'active' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {cls.status === 'active' ? 'Attiva' : 'Inattiva'}
                          </span>
                        </div>
                        
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center text-sm text-slate-600">
                            <UserIcon className="h-3.5 w-3.5 mr-1.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">
                              {cls.teacherName || 'Insegnante non assegnato'}
                            </span>
                          </div>
                          
                          <div className="flex items-center text-sm text-slate-600">
                            <Users className="h-3.5 w-3.5 mr-1.5 text-slate-400 flex-shrink-0" />
                            <span>{cls.studentsCount} studenti</span>
                          </div>
                          
                          {cls.turno && (
                            <div className="text-xs text-slate-500">
                              Turno: {cls.turno}
                            </div>
                          )}

                          {cls.recentHomeworkCount > 0 && (
                            <div className="flex items-center text-sm text-amber-700">
                              <FileText className="h-3.5 w-3.5 mr-1.5 text-amber-600 flex-shrink-0" />
                              <span>{cls.recentHomeworkCount} compiti recenti</span>
                            </div>
                          )}
                        </div>

                        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="h-5 w-5 text-slate-500" />
                        </div>

                        {selectedClass === cls.id && (
                          <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-10 bg-slate-400 rounded-r-full" />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right content */}
        <div className="lg:col-span-3">
          {!selectedClassDetails ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Seleziona una classe per visualizzare i dettagli
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">{selectedClassDetails.name}</h1>
                    <div className="flex flex-wrap gap-2 mt-2 items-center">
                      {selectedClassDetails.turno && (
                        <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                          {selectedClassDetails.turno}
                        </span>
                      )}
                      
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="border-slate-200 text-slate-700 hover:bg-slate-50"
                      onClick={() => setIsEditClassOpen(true)}
                    >
                      <UserIcon className="h-4 w-4 mr-2" /> Modifica
                    </Button>
                    <Button
                      variant="outline"
                      className="border-slate-200 text-slate-700 hover:bg-slate-50"
                      onClick={() => setIsAssignTeacherOpen(true)}
                    >
                      <UserIcon className="h-4 w-4 mr-2" /> Insegnante
                    </Button>
                    <Button
                      variant="outline"
                      className="border-slate-200 text-slate-700 hover:bg-slate-50"
                      onClick={() =>
                        navigate(
                          `/attendance?classId=${selectedClassDetails.id}&className=${encodeURIComponent(selectedClassDetails.name)}&returnTo=classes`
                        )
                      }
                    >
                      <UserIcon className="h-4 w-4 mr-2" /> Presenze
                    </Button>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <p className="text-sm font-medium text-slate-600">Studenti</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{selectedClassDetails.studentsCount}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <p className="text-sm font-medium text-slate-600">Compiti attivi</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{selectedClassDetails.recentHomeworkCount}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <p className="text-sm font-medium text-slate-600">Prossima lezione</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{getNextLessonLabel(selectedClassDetails.turno)}</p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="mt-6 border-b border-slate-200 bg-white rounded-xl">
                <nav className="-mb-px flex overflow-x-auto px-2" aria-label="Tabs">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedTab(tab.id as TabType)}
                      className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center transition-colors ${
                        selectedTab === tab.id
                          ? 'border-slate-600 text-slate-900'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {tab.icon}
                      <span className="ml-2">{tab.label}</span>
                      {tab.id === 'homework' && selectedClassDetails.recentHomeworkCount ? (
                        <span className="ml-2 py-0.5 px-2 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {selectedClassDetails.recentHomeworkCount}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab content */}
              <div className="p-6">
                {selectedTab === 'overview' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-medium text-slate-900 mb-4">Panoramica</h2>
                      {selectedClassDetails?.panoramica ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                          <p className="text-slate-700 whitespace-pre-wrap">{selectedClassDetails.panoramica}</p>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                          <p className="text-slate-500 italic">Nessuna panoramica disponibile per questa classe.</p>
                        </div>
                      )}
                    </div>

                    {classStats && (
                      <>
                        <div>
                          <h3 className="text-md font-medium text-slate-900 mb-3 flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Statistiche
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                              <div className="text-2xl font-bold text-blue-600">{classStats.activeHomework}</div>
                              <div className="text-sm text-slate-600">Compiti attivi</div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                              <div className="text-2xl font-bold text-emerald-600">{classStats.upcomingLessons}</div>
                              <div className="text-sm text-slate-600">Lezioni programmate</div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                              <div className="text-2xl font-bold text-amber-600">{classStats.totalMaterials}</div>
                              <div className="text-sm text-slate-600">Materiali</div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                              <div className="text-2xl font-bold text-slate-600">{selectedClassDetails.studentsCount}</div>
                              <div className="text-sm text-slate-600">Studenti</div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-md font-medium text-slate-900 mb-3 flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Attività recente
                          </h3>
                          <div className="bg-white border border-slate-200 rounded-xl">
                            {classStats.recentActivity.length === 0 ? (
                              <div className="p-6 text-center text-slate-500 text-sm">
                                Nessuna attività recente
                              </div>
                            ) : (
                              <div className="divide-y divide-slate-200">
                                {classStats.recentActivity.map((activity, idx) => (
                                  <div key={idx} className="p-4 flex items-center gap-3">
                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                      activity.type === 'homework' ? 'bg-blue-100' :
                                      activity.type === 'lesson' ? 'bg-emerald-100' : 'bg-amber-100'
                                    }`}>
                                      {activity.type === 'homework' ? <FileText className="h-4 w-4 text-blue-600" /> :
                                       activity.type === 'lesson' ? <BookOpen className="h-4 w-4 text-emerald-600" /> :
                                       <Paperclip className="h-4 w-4 text-amber-600" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-slate-900 truncate">{activity.title}</p>
                                      <p className="text-sm text-slate-500">
                                        {activity.type === 'homework' ? 'Compito' :
                                         activity.type === 'lesson' ? 'Lezione' : 'Materiale'} • 
                                        {activity.date.toLocaleDateString('it-IT')}
                                      </p>
                                    </div>
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                      activity.status === 'active' ? 'bg-blue-100 text-blue-700' :
                                      activity.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                      activity.status === 'upcoming' ? 'bg-amber-100 text-amber-700' :
                                      'bg-slate-100 text-slate-700'
                                    }`}>
                                      {activity.status === 'active' ? 'Attivo' :
                                       activity.status === 'completed' ? 'Completato' :
                                       activity.status === 'upcoming' ? 'Programmato' : 'Caricato'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {selectedTab === 'students' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-medium text-slate-900">Studenti</h2>
                        <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                          {(classStudents?.length || 0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-56 hidden sm:block">
                          <Input
                            placeholder="Cerca studenti..."
                            value={studentsSearch}
                            onChange={(e) => setStudentsSearch(e.target.value)}
                            fullWidth
                          />
                        </div>
                        <Button onClick={() => setIsAssignStudentsOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" /> Assegna studenti
                        </Button>
                      </div>
                    </div>
                    {tabLoading ? (
                      <p className="text-slate-500">Caricamento...</p>
                    ) : tabError ? (
                      <p className="text-red-600 text-sm">{tabError}</p>
                    ) : (classStudents?.length || 0) === 0 ? (
                      <div className="text-slate-600 text-sm bg-slate-50 border border-slate-200 p-4 rounded-lg">
                        Nessuno studente assegnato. Clicca "Assegna studenti" per aggiungerli.
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <div className="divide-y divide-slate-200">
                          {filteredStudents.map((s) => (
                            <div
                              key={s.id}
                              className="group p-4 sm:p-5 hover:bg-slate-50 transition-colors cursor-pointer"
                              onClick={() => setSelectedStudent(s)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                                  <div className={`h-12 w-12 rounded-full flex items-center justify-center text-sm font-semibold ${colorForString(s.displayName)}`}>
                                    {getInitials(s.displayName)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-slate-900 truncate">{s.displayName}</p>
                                    <div className="flex items-center gap-4 mt-1">
                                      <div className="flex items-center gap-1 text-sm text-slate-500">
                                        <Mail className="h-3.5 w-3.5" />
                                        <span className="truncate">{s.email}</span>
                                      </div>
                                      {s.phoneNumber && (
                                        <div className="flex items-center gap-1 text-sm text-slate-500">
                                          <Phone className="h-3.5 w-3.5" />
                                          <span>{s.phoneNumber}</span>
                                        </div>
                                      )}
                                    </div>
                                    {s.parentName && (
                                      <p className="text-xs text-slate-400 mt-1">
                                        Genitore: {s.parentName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setStudentToRemove(s);
                                    }}
                                    disabled={removingStudentId === s.id}
                                  >
                                    {removingStudentId === s.id ? (
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                </div>
                              </div>
                            </div>
                          ))}
                          {filteredStudents.length === 0 && (
                            <div className="col-span-full p-6 text-center text-slate-500 text-sm">Nessun risultato per la ricerca corrente</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {selectedTab === 'homework' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-medium text-slate-900">Compiti</h2>
                        <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                          {filteredHomework.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
                          value={homeworkFilter}
                          onChange={(e) => setHomeworkFilter(e.target.value as any)}
                        >
                          <option value="all">Tutti</option>
                          <option value="active">Attivi</option>
                          <option value="completed">Completati</option>
                        </select>
                        <select
                          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
                          value={homeworkSort}
                          onChange={(e) => setHomeworkSort(e.target.value as any)}
                        >
                          <option value="dueDate">Scadenza</option>
                          <option value="created">Data creazione</option>
                          <option value="title">Titolo</option>
                        </select>
                        <Button onClick={() => setIsCreateHomeworkOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" /> Crea compito
                        </Button>
                      </div>
                    </div>
                    {tabLoading ? (
                      <p className="text-slate-500">Caricamento...</p>
                    ) : tabError ? (
                      <p className="text-red-600 text-sm">{tabError}</p>
                    ) : filteredHomework.length === 0 ? (
                      <div className="text-slate-600 text-sm bg-slate-50 border border-slate-200 p-4 rounded-lg">
                        {homeworkFilter === 'all' 
                          ? 'Nessun compito. Crea il primo per assegnare attività agli studenti.'
                          : `Nessun compito ${homeworkFilter === 'active' ? 'attivo' : 'completato'}.`
                        }
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredHomework.map((h) => {
                          const { isOverdue, isDueSoon } = getHomeworkStatusInfo(h);
                          return (
                            <div 
                              key={h.id} 
                              className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 hover:shadow-sm transition-shadow cursor-pointer"
                              onClick={() => setSelectedHomework(h)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="font-medium text-slate-900 truncate">{h.title}</h3>
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                        h.status === 'completed' 
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : isOverdue
                                            ? 'bg-red-100 text-red-700'
                                            : isDueSoon
                                              ? 'bg-amber-100 text-amber-700'
                                              : 'bg-blue-100 text-blue-700'
                                      }`}>
                                        {h.status === 'completed' ? 'Completato' : 
                                         isOverdue ? 'Scaduto' :
                                         isDueSoon ? 'Scade presto' : 'Attivo'}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {h.description && (
                                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">{h.description}</p>
                                  )}
                                  
                                  <div className="flex items-center gap-4 text-sm text-slate-500">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-4 w-4" />
                                      <span>Scadenza: {h.dueDate.toLocaleDateString('it-IT')}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-4 w-4" />
                                      <span>Creato: {h.createdAt.toLocaleDateString('it-IT')}</span>
                                    </div>
                                    {h.teacherName && (
                                      <div className="flex items-center gap-1">
                                        <UserIcon className="h-4 w-4" />
                                        <span>{h.teacherName}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-1 ml-4" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleToggleHomeworkStatus(h.id, h.status)}
                                    title={h.status === 'completed' ? 'Segna come attivo' : 'Segna come completato'}
                                  >
                                    {h.status === 'completed' ? (
                                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                                    ) : (
                                      <AlertCircle className="h-4 w-4 text-slate-400" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setEditingHomework(h)}
                                    title="Modifica compito"
                                  >
                                    <Edit3 className="h-4 w-4 text-slate-400" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                                    onClick={() => setHomeworkToDelete(h)}
                                    title="Elimina compito"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {selectedTab === 'lessons' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-medium text-slate-900">Lezioni</h2>
                        <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                          {filteredLessons.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
                          value={lessonsMonthFilter}
                          onChange={(e) => setLessonsMonthFilter(e.target.value)}
                        >
                          <option value="">Tutti i mesi</option>
                          {availableMonths.map(month => {
                            const date = new Date(month + '-01');
                            const label = date.toLocaleDateString('it-IT', { year: 'numeric', month: 'long' });
                            return (
                              <option key={month} value={month}>{label}</option>
                            );
                          })}
                        </select>
                        <select
                          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
                          value={lessonsSort}
                          onChange={(e) => setLessonsSort(e.target.value as any)}
                        >
                          <option value="date">Data lezione</option>
                          <option value="created">Data creazione</option>
                          <option value="title">Titolo</option>
                        </select>
                        <Button onClick={() => setIsCreateLessonOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" /> Crea lezione
                        </Button>
                      </div>
                    </div>
                    {tabLoading ? (
                      <p className="text-slate-500">Caricamento...</p>
                    ) : tabError ? (
                      <p className="text-red-600 text-sm">{tabError}</p>
                    ) : filteredLessons.length === 0 ? (
                      <div className="text-slate-600 text-sm bg-slate-50 border border-slate-200 p-4 rounded-lg">
                        Nessuna lezione. Pianifica la prossima per organizzare il corso.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredLessons.map((l) => {
                          const { isToday, isPast, isUpcoming } = getLessonStatusInfo(l);
                          return (
                            <div 
                              key={l.id} 
                              className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 hover:shadow-sm transition-shadow cursor-pointer"
                              onClick={() => setSelectedLesson(l)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="font-medium text-slate-900 truncate">{l.title}</h3>
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                        isToday 
                                          ? 'bg-blue-100 text-blue-700'
                                          : isPast
                                            ? 'bg-slate-100 text-slate-700'
                                            : 'bg-emerald-100 text-emerald-700'
                                      }`}>
                                        {isToday ? 'Oggi' : isPast ? 'Completata' : 'Programmata'}
                                      </span>
                                      {(l.materials?.length || 0) > 0 && (
                                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                                          <Paperclip className="h-3 w-3" />
                                          {l.materials?.length} materiali
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 text-sm text-slate-500 mb-2">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-4 w-4" />
                                      {l.date.toLocaleDateString('it-IT')}
                                    </span>
                                    {l.topics && l.topics.length > 0 && (
                                      <span>{l.topics.length} argomenti</span>
                                    )}
                                  </div>
                                  
                                  {l.description && (
                                    <p className="text-sm text-slate-600 line-clamp-2">{l.description}</p>
                                  )}
                                </div>
                                
                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingLesson(l)}
                                    title="Modifica lezione"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setLessonToDelete(l)}
                                    title="Elimina lezione"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {selectedTab === 'materials' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-medium text-slate-900">Materiali</h2>
                        <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                          {filteredMaterials.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
                          value={materialsSort}
                          onChange={(e) => setMaterialsSort(e.target.value as any)}
                        >
                          <option value="created">Data caricamento</option>
                          <option value="title">Titolo</option>
                          <option value="type">Tipo file</option>
                        </select>
                        <Button onClick={() => setIsCreateMaterialOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" /> Carica materiale
                        </Button>
                      </div>
                    </div>
                    {tabLoading ? (
                      <p className="text-slate-500">Caricamento...</p>
                    ) : tabError ? (
                      <p className="text-red-600 text-sm">{tabError}</p>
                    ) : filteredMaterials.length === 0 ? (
                      <div className="text-slate-600 text-sm bg-slate-50 border border-slate-200 p-4 rounded-lg">
                        Nessun materiale. Carica documenti o link utili per la classe.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredMaterials.map((m) => (
                          <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0">
                                {getFileTypeIcon(m.fileType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-slate-900 truncate mb-1">{m.title}</h3>
                                {m.description && (
                                  <p className="text-sm text-slate-600 mb-2 line-clamp-2">{m.description}</p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                                  <span>Tipo: {m.fileType?.split('/')?.[0] || 'file'}</span>
                                  <span>Caricato: {m.createdAt.toLocaleDateString('it-IT')}</span>
                                  {m.teacherName && <span>Da: {m.teacherName}</span>}
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex gap-2">
                                    <a
                                      href={m.fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                    >
                                      <Download className="h-3 w-3" />
                                      Scarica
                                    </a>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => setAssignMaterialTarget(m)}
                                    >
                                      Assegna a lezione
                                    </Button>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                                    onClick={() => setMaterialToDelete(m)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dialogs */}
              {selectedClassDetails && (
                <>
                  <EditClassDialog
                    cls={{
                      id: selectedClassDetails.id,
                      name: selectedClassDetails.name,
                      level: selectedClassDetails.level,
                      turno: selectedClassDetails.turno,
                      panoramica: selectedClassDetails.panoramica,
                      status: selectedClassDetails.status,
                    }}
                    isOpen={isEditClassOpen}
                    onClose={() => setIsEditClassOpen(false)}
                    onSuccess={() => setReloadKey((k) => k + 1)}
                  />
                  <AssignTeacherDialog
                    classId={selectedClassDetails.id}
                    currentTeacherName={selectedClassDetails.teacherName}
                    isOpen={isAssignTeacherOpen}
                    onClose={() => setIsAssignTeacherOpen(false)}
                    onAssigned={() => setReloadKey((k) => k + 1)}
                  />
                  <AssignStudentsDialog
                    classId={selectedClassDetails.id}
                    isOpen={isAssignStudentsOpen}
                    onClose={() => setIsAssignStudentsOpen(false)}
                    onAssigned={() => setReloadKey((k) => k + 1)}
                  />
                  <CreateHomeworkDialog
                    classId={selectedClassDetails.id}
                    className={selectedClassDetails.name}
                    isOpen={isCreateHomeworkOpen}
                    onClose={() => setIsCreateHomeworkOpen(false)}
                    onSuccess={() => setReloadKey((k) => k + 1)}
                  />
                  <CreateLessonDialog
                    classId={selectedClassDetails.id}
                    className={selectedClassDetails.name}
                    isOpen={isCreateLessonOpen}
                    onClose={() => setIsCreateLessonOpen(false)}
                    onSuccess={() => setReloadKey((k) => k + 1)}
                  />
                  <CreateMaterialDialog
                    classId={selectedClassDetails.id}
                    className={selectedClassDetails.name}
                    isOpen={isCreateMaterialOpen}
                    onClose={() => setIsCreateMaterialOpen(false)}
                    onSuccess={() => setReloadKey((k) => k + 1)}
                  />
                  <MaterialAssignmentDialog
                    material={assignMaterialTarget}
                    isOpen={!!assignMaterialTarget}
                    onClose={() => setAssignMaterialTarget(null)}
                    onAssignmentComplete={() => setReloadKey((k) => k + 1)}
                  />
                </>
              )}
              
              {/* Student Details Modal */}
              {selectedStudent && (
                <Dialog open={!!selectedStudent} onClose={() => setSelectedStudent(null)} className="relative z-50">
                  <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
                  <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-xl shadow-xl">
                      <div className="flex justify-between items-center border-b border-slate-200 p-6">
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-semibold ${colorForString(selectedStudent.displayName)}`}>
                            {getInitials(selectedStudent.displayName)}
                          </div>
                          <div>
                            <Dialog.Title className="text-xl font-semibold text-slate-900">{selectedStudent.displayName}</Dialog.Title>
                            <p className="text-sm text-slate-500">{selectedStudent.email}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                      
                      <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h3 className="font-medium text-slate-900 flex items-center gap-2">
                              <Info className="h-4 w-4" />
                              Informazioni personali
                            </h3>
                            <div className="space-y-3">
                              <div>
                                <label className="text-sm font-medium text-slate-700">Email</label>
                                <p className="text-sm text-slate-600">{selectedStudent.email}</p>
                              </div>
                              {selectedStudent.phoneNumber && (
                                <div>
                                  <label className="text-sm font-medium text-slate-700">Telefono</label>
                                  <p className="text-sm text-slate-600">{selectedStudent.phoneNumber}</p>
                                </div>
                              )}
                              {selectedStudent.gender && (
                                <div>
                                  <label className="text-sm font-medium text-slate-700">Genere</label>
                                  <p className="text-sm text-slate-600">{selectedStudent.gender === 'male' ? 'Maschio' : selectedStudent.gender === 'female' ? 'Femmina' : selectedStudent.gender}</p>
                                </div>
                              )}
                              {selectedStudent.age && (
                                <div>
                                  <label className="text-sm font-medium text-slate-700">Età</label>
                                  <p className="text-sm text-slate-600">{selectedStudent.age} anni</p>
                                </div>
                              )}
                              {selectedStudent.address && (
                                <div>
                                  <label className="text-sm font-medium text-slate-700">Indirizzo</label>
                                  <p className="text-sm text-slate-600 flex items-start gap-1">
                                    <MapPin className="h-4 w-4 mt-0.5 text-slate-400" />
                                    {selectedStudent.address}
                                  </p>
                                </div>
                              )}
                              {selectedStudent.enrollmentDate && (
                                <div>
                                  <label className="text-sm font-medium text-slate-700">Data di iscrizione</label>
                                  <p className="text-sm text-slate-600">
                                    {new Date(selectedStudent.enrollmentDate).toLocaleDateString('it-IT')}
                                  </p>
                                </div>
                              )}
                              {selectedStudent.isEnrolled !== undefined && (
                                <div>
                                  <label className="text-sm font-medium text-slate-700">Stato iscrizione</label>
                                  <p className="text-sm text-slate-600">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                      selectedStudent.isEnrolled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      {selectedStudent.isEnrolled ? 'Iscritto' : 'Non iscritto'}
                                    </span>
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <h3 className="font-medium text-slate-900">Contatti di emergenza</h3>
                            <div className="space-y-3">
                              {selectedStudent.parentName && (
                                <div>
                                  <label className="text-sm font-medium text-slate-700">Genitore</label>
                                  <p className="text-sm text-slate-600">{selectedStudent.parentName}</p>
                                </div>
                              )}
                              {selectedStudent.parentContact && (
                                <div>
                                  <label className="text-sm font-medium text-slate-700">Contatto genitore</label>
                                  <p className="text-sm text-slate-600">{selectedStudent.parentContact}</p>
                                </div>
                              )}
                              {selectedStudent.emergencyContact && (
                                <div>
                                  <label className="text-sm font-medium text-slate-700">Contatto di emergenza</label>
                                  <p className="text-sm text-slate-600">{selectedStudent.emergencyContact}</p>
                                </div>
                              )}
                            </div>
                            
                            <h3 className="font-medium text-slate-900 mt-6">Informazioni sistema</h3>
                            <div className="space-y-3">
                              {selectedStudent.id && (
                                <div>
                                  <label className="text-sm font-medium text-slate-700">ID Utente</label>
                                  <p className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded">{selectedStudent.id}</p>
                                </div>
                              )}
                              {selectedStudent.classId && (
                                <div>
                                  <label className="text-sm font-medium text-slate-700">ID Classe</label>
                                  <p className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded">{selectedStudent.classId}</p>
                                </div>
                              )}
                              {selectedStudent.createdAt && (
                                <div>
                                  <label className="text-sm font-medium text-slate-700">Account creato</label>
                                  <p className="text-sm text-slate-600">
                                    {new Date(selectedStudent.createdAt).toLocaleDateString('it-IT', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              )}
                              {selectedStudent.updatedAt && (
                                <div>
                                  <label className="text-sm font-medium text-slate-700">Ultimo aggiornamento</label>
                                  <p className="text-sm text-slate-600">
                                    {new Date(selectedStudent.updatedAt).toLocaleDateString('it-IT', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {selectedStudent.notes && (
                          <div>
                            <h3 className="font-medium text-slate-900 mb-2">Note</h3>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedStudent.notes}</p>
                            </div>
                          </div>
                        )}
                        
                        {selectedStudent.medicalInfo && (
                          <div>
                            <h3 className="font-medium text-slate-900 mb-2">Informazioni mediche</h3>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <p className="text-sm text-amber-800 whitespace-pre-wrap">{selectedStudent.medicalInfo}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="border-t border-slate-200 p-6 flex justify-end">
                        <Button onClick={() => setSelectedStudent(null)}>Chiudi</Button>
                      </div>
                    </Dialog.Panel>
                  </div>
                </Dialog>
              )}
              
              {/* Student Removal Confirmation */}
              {studentToRemove && (
                <Dialog open={!!studentToRemove} onClose={() => setStudentToRemove(null)} className="relative z-50">
                  <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
                  <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-xl shadow-xl">
                      <div className="p-6">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                            <Trash2 className="h-6 w-6 text-red-600" />
                          </div>
                          <div>
                            <Dialog.Title className="text-lg font-semibold text-slate-900">Rimuovi studente</Dialog.Title>
                            <p className="text-sm text-slate-500">Questa azione non può essere annullata</p>
                          </div>
                        </div>
                        
                        <p className="text-sm text-slate-700 mb-6">
                          Sei sicuro di voler rimuovere <strong>{studentToRemove.displayName}</strong> da questa classe?
                        </p>
                        
                        <div className="flex gap-3 justify-end">
                          <Button variant="outline" onClick={() => setStudentToRemove(null)}>
                            Annulla
                          </Button>
                          <Button 
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => handleRemoveStudent(studentToRemove.id)}
                            disabled={removingStudentId === studentToRemove.id}
                          >
                            {removingStudentId === studentToRemove.id ? 'Rimozione...' : 'Rimuovi'}
                          </Button>
                        </div>
                      </div>
                    </Dialog.Panel>
                  </div>
                </Dialog>
              )}
              
              {/* Homework Deletion Confirmation */}
              {homeworkToDelete && (
                <Dialog open={!!homeworkToDelete} onClose={() => setHomeworkToDelete(null)} className="relative z-50">
                  <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
                  <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-xl shadow-xl p-6">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                          <Trash2 className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                          <Dialog.Title className="text-lg font-semibold text-slate-900">Elimina Compito</Dialog.Title>
                          <p className="text-sm text-slate-500">Questa azione non può essere annullata</p>
                        </div>
                      </div>
                      
                      <div className="mb-6">
                        <p className="text-slate-700">
                          Sei sicuro di voler eliminare il compito <strong>"{homeworkToDelete.title}"</strong>?
                        </p>
                      </div>
                      
                      <div className="flex gap-3 justify-end">
                        <Button variant="outline" onClick={() => setHomeworkToDelete(null)}>
                          Annulla
                        </Button>
                        <Button 
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => handleDeleteHomework(homeworkToDelete.id)}
                          disabled={deletingHomeworkId === homeworkToDelete.id}
                        >
                          {deletingHomeworkId === homeworkToDelete.id ? 'Eliminazione...' : 'Elimina'}
                        </Button>
                      </div>
                    </Dialog.Panel>
                  </div>
                </Dialog>
              )}
              
              {/* Lesson Deletion Confirmation */}
              {lessonToDelete && (
                <Dialog open={!!lessonToDelete} onClose={() => setLessonToDelete(null)} className="relative z-50">
                  <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
                  <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-xl shadow-xl p-6">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                          <Trash2 className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                          <Dialog.Title className="text-lg font-semibold text-slate-900">Elimina Lezione</Dialog.Title>
                          <p className="text-sm text-slate-500">Questa azione non può essere annullata</p>
                        </div>
                      </div>
                      
                      <div className="mb-6">
                        <p className="text-slate-700">
                          Sei sicuro di voler eliminare la lezione <strong>"{lessonToDelete.title}"</strong>?
                        </p>
                      </div>
                      
                      <div className="flex gap-3 justify-end">
                        <Button variant="outline" onClick={() => setLessonToDelete(null)}>
                          Annulla
                        </Button>
                        <Button 
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => handleDeleteLesson(lessonToDelete.id)}
                          disabled={deletingLessonId === lessonToDelete.id}
                        >
                          {deletingLessonId === lessonToDelete.id ? 'Eliminazione...' : 'Elimina'}
                        </Button>
                      </div>
                    </Dialog.Panel>
                  </div>
                </Dialog>
              )}
              
              {/* Material Deletion Confirmation */}
              {materialToDelete && (
                <Dialog open={!!materialToDelete} onClose={() => setMaterialToDelete(null)} className="relative z-50">
                  <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
                  <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-xl shadow-xl p-6">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                          <Trash2 className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                          <Dialog.Title className="text-lg font-semibold text-slate-900">Elimina Materiale</Dialog.Title>
                          <p className="text-sm text-slate-500">Questa azione non può essere annullata</p>
                        </div>
                      </div>
                      
                      <div className="mb-6">
                        <p className="text-slate-700">
                          Sei sicuro di voler eliminare il materiale <strong>"{materialToDelete.title}"</strong>?
                        </p>
                      </div>
                      
                      <div className="flex gap-3 justify-end">
                        <Button variant="outline" onClick={() => setMaterialToDelete(null)}>
                          Annulla
                        </Button>
                        <Button 
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => handleDeleteMaterial(materialToDelete.id)}
                          disabled={deletingMaterialId === materialToDelete.id}
                        >
                          {deletingMaterialId === materialToDelete.id ? 'Eliminazione...' : 'Elimina'}
                        </Button>
                      </div>
                    </Dialog.Panel>
                  </div>
                </Dialog>
              )}
              
              {/* Homework Details Modal */}
              {selectedHomework && (
                <Dialog open={!!selectedHomework} onClose={() => setSelectedHomework(null)} className="relative z-50">
                  <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
                  <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-xl shadow-xl">
                      <div className="flex justify-between items-center border-b border-slate-200 p-6">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <Dialog.Title className="text-xl font-semibold text-slate-900">{selectedHomework.title}</Dialog.Title>
                            <p className="text-sm text-slate-500">Compito • {selectedHomework.status === 'active' ? 'Attivo' : 'Completato'}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedHomework(null)}>
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                      
                      <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium text-slate-700">Descrizione</label>
                              <div className="mt-1 bg-slate-50 border border-slate-200 rounded-lg p-3">
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                  {selectedHomework.description || 'Nessuna descrizione disponibile'}
                                </p>
                              </div>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium text-slate-700">Stato</label>
                              <div className="mt-1">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  selectedHomework.status === 'completed' 
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {selectedHomework.status === 'completed' ? 'Completato' : 'Attivo'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium text-slate-700">Data di scadenza</label>
                              <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                                <Calendar className="h-4 w-4" />
                                {selectedHomework.dueDate.toLocaleDateString('it-IT', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium text-slate-700">Creato il</label>
                              <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                                <Clock className="h-4 w-4" />
                                {selectedHomework.createdAt.toLocaleDateString('it-IT')}
                              </p>
                            </div>
                            
                            {selectedHomework.teacherName && (
                              <div>
                                <label className="text-sm font-medium text-slate-700">Assegnato da</label>
                                <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                                  <UserIcon className="h-4 w-4" />
                                  {selectedHomework.teacherName}
                                </p>
                              </div>
                            )}
                            
                            {selectedHomework.materials && selectedHomework.materials.length > 0 && (
                              <div>
                                <label className="text-sm font-medium text-slate-700">Materiali allegati</label>
                                <div className="mt-1 space-y-2">
                                  {selectedHomework.materials.map((material, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded border">
                                      <Paperclip className="h-4 w-4 text-slate-500" />
                                      <span className="text-sm text-slate-600 flex-1">
                                        {material.name || `Material ${idx + 1}`}
                                      </span>
                                      {material.downloadUrl && (
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          onClick={() => window.open(material.downloadUrl, '_blank')}
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="border-t border-slate-200 p-6 flex justify-between">
                        <Button 
                          onClick={() => handleToggleHomeworkStatus(selectedHomework.id, selectedHomework.status)}
                          className={selectedHomework.status === 'completed' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                        >
                          {selectedHomework.status === 'completed' ? 'Segna come attivo' : 'Segna come completato'}
                        </Button>
                        <Button onClick={() => setSelectedHomework(null)}>Chiudi</Button>
                      </div>
                    </Dialog.Panel>
                  </div>
                </Dialog>
              )}
              
              {/* Lesson Details Modal - Enhanced */}
              {selectedLesson && (
                <Dialog open={!!selectedLesson} onClose={() => setSelectedLesson(null)} className="relative z-50">
                  <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
                  <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="mx-auto max-w-4xl w-full bg-white rounded-xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
                      {/* Header */}
                      <div className="flex justify-between items-center border-b border-slate-200 p-6">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-emerald-600" />
                          </div>
                          <div>
                            <Dialog.Title className="text-xl font-semibold text-slate-900">{selectedLesson.title}</Dialog.Title>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-sm text-slate-500">
                                {selectedLesson.date.toLocaleDateString('it-IT', { 
                                  weekday: 'long', 
                                  month: 'long', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                              {(() => {
                                const today = new Date();
                                const lessonDate = selectedLesson.date;
                                const isToday = lessonDate.toDateString() === today.toDateString();
                                const isPast = lessonDate < today && !isToday;
                                const isFuture = lessonDate > today;
                                
                                if (isToday) {
                                  return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">Oggi</span>;
                                } else if (isPast) {
                                  return <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">Completata</span>;
                                } else {
                                  return <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">Programmata</span>;
                                }
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setEditingLesson(selectedLesson);
                              setSelectedLesson(null);
                            }}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedLesson(null)}>
                            <X className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Content - Scrollable */}
                      <div className="flex-1 overflow-y-auto p-6">
                        <div className="space-y-8">
                          {/* Description Section */}
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-3">Descrizione</h3>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {selectedLesson.description || 'Nessuna descrizione disponibile per questa lezione.'}
                              </p>
                            </div>
                          </div>

                          {/* Topics Section */}
                          {selectedLesson.topics && selectedLesson.topics.length > 0 && (
                            <div>
                              <h3 className="text-lg font-semibold text-slate-900 mb-3">Argomenti Trattati</h3>
                              <div className="flex flex-wrap gap-2">
                                {selectedLesson.topics.map((topic, idx) => (
                                  <span key={idx} className="px-3 py-2 bg-emerald-100 text-emerald-800 rounded-lg text-sm font-medium">
                                    {topic}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Details Grid */}
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">Dettagli</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {/* Date and Time */}
                              <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Calendar className="h-5 w-5 text-slate-500" />
                                  <span className="font-medium text-slate-900">Data e Ora</span>
                                </div>
                                <p className="text-slate-600">
                                  {selectedLesson.date.toLocaleDateString('it-IT', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </p>
                                <p className="text-sm text-slate-500 mt-1">
                                  {selectedLesson.date.toLocaleTimeString('it-IT', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>

                              {/* Teacher */}
                              {selectedLesson.teacherName && (
                                <div className="bg-white border border-slate-200 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <UserIcon className="h-5 w-5 text-slate-500" />
                                    <span className="font-medium text-slate-900">Docente</span>
                                  </div>
                                  <p className="text-slate-600">{selectedLesson.teacherName}</p>
                                </div>
                              )}

                              {/* Creation Date */}
                              <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Clock className="h-5 w-5 text-slate-500" />
                                  <span className="font-medium text-slate-900">Creata il</span>
                                </div>
                                <p className="text-slate-600">
                                  {selectedLesson.createdAt.toLocaleDateString('it-IT', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </p>
                                <p className="text-sm text-slate-500 mt-1">
                                  {selectedLesson.createdAt.toLocaleTimeString('it-IT', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>

                              {/* Materials */}
                              {selectedLesson.materials && selectedLesson.materials.length > 0 && (
                                <div className="bg-white border border-slate-200 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Paperclip className="h-5 w-5 text-slate-500" />
                                    <span className="font-medium text-slate-900">Materiali</span>
                                  </div>
                                  <p className="text-slate-600">
                                    {selectedLesson.materials.length} file allegati
                                  </p>
                                  <div className="mt-2 space-y-1">
                                    {selectedLesson.materials.slice(0, 3).map((material, idx) => (
                                      <p key={idx} className="text-sm text-slate-500 truncate">
                                        {material.name || `Material ${idx + 1}`}
                                      </p>
                                    ))}
                                    {selectedLesson.materials.length > 3 && (
                                      <p className="text-sm text-slate-400">
                                        +{selectedLesson.materials.length - 3} altri
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Lesson ID */}
                              <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Info className="h-5 w-5 text-slate-500" />
                                  <span className="font-medium text-slate-900">ID Lezione</span>
                                </div>
                                <p className="text-slate-600 font-mono text-sm">{selectedLesson.id}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Footer */}
                      <div className="border-t border-slate-200 p-6 flex justify-between">
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setEditingLesson(selectedLesson);
                            setSelectedLesson(null);
                          }}
                          leftIcon={<Edit3 className="h-4 w-4" />}
                        >
                          Modifica Lezione
                        </Button>
                        <Button onClick={() => setSelectedLesson(null)}>Chiudi</Button>
                      </div>
                    </Dialog.Panel>
                  </div>
                </Dialog>
              )}
              
              {/* Edit Homework Dialog */}
              {editingHomework && (
                <EditHomeworkDialog
                  homework={editingHomework}
                  isOpen={!!editingHomework}
                  onClose={() => setEditingHomework(null)}
                  onUpdate={(updatedHomework) => {
                    setHomework(prev => prev.map(h => h.id === updatedHomework.id ? updatedHomework : h));
                    setEditingHomework(null);
                  }}
                />
              )}
              
              {/* Edit Lesson Dialog */}
              {editingLesson && (
                <EditLessonDialog
                  lesson={editingLesson}
                  isOpen={!!editingLesson}
                  onClose={() => setEditingLesson(null)}
                  onUpdate={(updatedLesson) => {
                    setLessons(prev => prev.map(l => l.id === updatedLesson.id ? updatedLesson : l));
                    setEditingLesson(null);
                  }}
                />
              )}
              
              {/* Create Class Dialog - available globally */}
              <CreateClassDialog
                isOpen={isCreateClassOpen}
                onClose={() => setIsCreateClassOpen(false)}
                onCreated={() => setReloadKey((k) => k + 1)}
              />
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default ManageClasses;