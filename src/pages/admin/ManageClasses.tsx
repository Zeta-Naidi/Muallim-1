import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageContainer } from '../../components/layout/PageContainer';
import { Search, Plus, ChevronRight, School, User as UserIcon, Users, FileText } from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { EditClassDialog } from '../../components/dialogs/EditClassDialog';
import { CreateHomeworkDialog } from '../../components/dialogs/CreateHomeworkDialog';
import { AssignTeacherDialog } from '../../components/dialogs/AssignTeacherDialog';
import { AssignStudentsDialog } from '../../components/dialogs/AssignStudentsDialog';
import { CreateLessonDialog } from '../../components/dialogs/CreateLessonDialog';
import { CreateMaterialDialog } from '../../components/dialogs/CreateMaterialDialog';
import { MaterialAssignmentDialog } from '../../components/materials/MaterialAssignmentDialog';
import { CreateClassDialog } from '../../components/dialogs/CreateClassDialog';
import type { Homework, Lesson, LessonMaterial } from '../../types';

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
}

type TabType = 'overview' | 'students' | 'homework' | 'lessons' | 'materials';

export const ManageClasses: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { getAll } = useFirestore<any>('classes');
  const [classes, setClasses] = useState<ClassWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabType>('overview');
  const [selectedClassDetails, setSelectedClassDetails] = useState<ClassWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [turnoFilter, setTurnoFilter] = useState<string>('');
  const [isEditClassOpen, setIsEditClassOpen] = useState<boolean>(false);
  const [isCreateHomeworkOpen, setIsCreateHomeworkOpen] = useState<boolean>(false);
  const [isAssignTeacherOpen, setIsAssignTeacherOpen] = useState<boolean>(false);
  const [isAssignStudentsOpen, setIsAssignStudentsOpen] = useState<boolean>(false);
  const [isCreateLessonOpen, setIsCreateLessonOpen] = useState<boolean>(false);
  const [isCreateMaterialOpen, setIsCreateMaterialOpen] = useState<boolean>(false);
  const [assignMaterialTarget, setAssignMaterialTarget] = useState<LessonMaterial | null>(null);
  const [isCreateClassOpen, setIsCreateClassOpen] = useState<boolean>(false);

  // Tab data states
  const { getAll: getAllHomework } = useFirestore<Homework>('homework');
  const { getAll: getAllLessons } = useFirestore<Lesson>('lessons');
  const { getAll: getAllMaterials } = useFirestore<LessonMaterial>('materials');

  const [homework, setHomework] = useState<Homework[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [materials, setMaterials] = useState<LessonMaterial[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);

  // Filter classes
  const filteredClasses = (classes || [])
    .filter(cls => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        cls.name.toLowerCase().includes(q) ||
        cls.teacherName.toLowerCase().includes(q)
      );
    })
    .filter(cls => {
      if (!turnoFilter) return true;
      return (cls.turno || '') === turnoFilter;
    });

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
      const details = classes.find(cls => cls.id === selectedClass) || null;
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

  return (
    <PageContainer title="Gestione Classi" description="Crea, modifica e gestisci le classi">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">Le tue classi</h2>
                {(userProfile?.role === 'teacher' || userProfile?.role === 'admin') && (
                  <Button size="sm" variant="outline" onClick={() => setIsCreateClassOpen(true)}>
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
                <div className="relative">
                  <select
                    className="block w-full rounded-xl border bg-white py-3 px-4 text-slate-900 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 hover:border-slate-300 border-slate-200 relative"
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
              </div>
            </div>

            <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto p-4 custom-scrollbar">
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
                    <Button className="mt-4" variant="outline" onClick={() => setIsCreateClassOpen(true)}>
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
                        className={`relative p-4 rounded-lg border transition-all duration-200 cursor-pointer group ${
                          selectedClass === cls.id 
                            ? 'border-slate-300 bg-slate-50' 
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedClass(cls.id)}
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
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h1 className="text-2xl font-bold text-slate-900">
                  {selectedClassDetails.name}
                </h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedClassDetails.turno && (
                    <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                      {selectedClassDetails.turno}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex space-x-2">
                  <Button
                    variant="outline"
                    className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    onClick={() => setIsEditClassOpen(true)}
                  >
                    <UserIcon className="h-4 w-4 mr-2" />
                    Modifica classe
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    onClick={() => setIsAssignTeacherOpen(true)}
                  >
                    <UserIcon className="h-4 w-4 mr-2" />
                    Assegna insegnante
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    onClick={() =>
                      navigate(
                        `/attendance?classId=${selectedClassDetails.id}&className=${encodeURIComponent(
                          selectedClassDetails.name
                        )}&returnTo=classes`
                      )
                    }
                  >
                    <UserIcon className="h-4 w-4 mr-2" />
                    Presenze
                  </Button>
                </div>

                {/* Quick stats */}
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <p className="text-sm font-medium text-slate-600">Studenti</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">
                      {selectedClassDetails.studentsCount}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <p className="text-sm font-medium text-slate-600">Compiti attivi</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">
                      {selectedClassDetails.recentHomeworkCount}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
                    <p className="text-sm font-medium text-slate-600">Prossima lezione</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{getNextLessonLabel(selectedClassDetails.turno)}</p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="mt-6 border-b border-slate-200">
                <nav className="-mb-px flex overflow-x-auto" aria-label="Tabs">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedTab(tab.id as TabType)}
                      className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center ${
                        selectedTab === tab.id
                          ? 'border-slate-500 text-slate-700'
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
                  <div>
                    <h2 className="text-lg font-medium text-slate-900 mb-4">Panoramica</h2>
                    {selectedClassDetails.panoramica ? (
                      <p className="text-slate-700 whitespace-pre-wrap">{selectedClassDetails.panoramica}</p>
                    ) : (
                      <p className="text-slate-500 italic">Nessuna panoramica disponibile per questa classe.</p>
                    )}
                  </div>
                )}
                {selectedTab === 'students' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-medium text-slate-900">Studenti</h2>
                      <Button onClick={() => setIsAssignStudentsOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Studenti
                      </Button>
                    </div>
                    <p className="text-slate-600">Elenco studenti della classe.</p>
                  </div>
                )}
                {selectedTab === 'homework' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-medium text-slate-900">Compiti</h2>
                      <Button onClick={() => setIsCreateHomeworkOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Crea compito
                      </Button>
                    </div>
                    {tabLoading ? (
                      <p className="text-slate-500">Caricamento...</p>
                    ) : tabError ? (
                      <p className="text-red-600 text-sm">{tabError}</p>
                    ) : homework.length === 0 ? (
                      <p className="text-slate-600">Nessun compito.</p>
                    ) : (
                      <ul className="space-y-2">
                        {homework.map((h) => (
                          <li key={h.id} className="p-4 border border-slate-200 rounded-lg flex items-center justify-between">
                            <div>
                              <p className="font-medium text-slate-900">{h.title}</p>
                              <p className="text-sm text-slate-500">
                                Scadenza: {h.dueDate.toLocaleDateString('it-IT')} • Stato: {h.status}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {selectedTab === 'lessons' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-medium text-slate-900">Lezioni</h2>
                      <Button onClick={() => setIsCreateLessonOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Crea lezione
                      </Button>
                    </div>
                    {tabLoading ? (
                      <p className="text-slate-500">Caricamento...</p>
                    ) : tabError ? (
                      <p className="text-red-600 text-sm">{tabError}</p>
                    ) : lessons.length === 0 ? (
                      <p className="text-slate-600">Nessuna lezione.</p>
                    ) : (
                      <ul className="space-y-2">
                        {lessons.map((l) => (
                          <li key={l.id} className="p-4 border border-slate-200 rounded-lg">
                            <p className="font-medium text-slate-900">{l.title}</p>
                            <p className="text-sm text-slate-500">
                              {l.date.toLocaleDateString('it-IT')} • Argomenti: {l.topics?.length || 0} • Materiali: {l.materials?.length || 0}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {selectedTab === 'materials' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-medium text-slate-900">Materiali</h2>
                      <Button onClick={() => setIsCreateMaterialOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Carica materiale
                      </Button>
                    </div>
                    {tabLoading ? (
                      <p className="text-slate-500">Caricamento...</p>
                    ) : tabError ? (
                      <p className="text-red-600 text-sm">{tabError}</p>
                    ) : materials.length === 0 ? (
                      <p className="text-slate-600">Nessun materiale.</p>
                    ) : (
                      <ul className="space-y-2">
                        {materials.map((m) => (
                          <li key={m.id} className="p-4 border border-slate-200 rounded-lg flex items-center justify-between">
                            <div>
                              <p className="font-medium text-slate-900">{m.title}</p>
                              <p className="text-sm text-slate-500">Tipo: {m.fileType?.split('/')?.[0] || 'file'}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" onClick={() => setAssignMaterialTarget(m)}>Assegna a lezione</Button>
                              <a className="text-slate-700 hover:underline text-sm" href={m.fileUrl} target="_blank" rel="noreferrer">Apri</a>
                            </div>
                          </li>
                        ))}
                      </ul>
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