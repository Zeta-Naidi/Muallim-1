import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { FileText, Download, Settings, Search, Filter } from 'lucide-react';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { MaterialAssignmentDialog } from '../../components/materials/MaterialAssignmentDialog';
import { LessonMaterial, Class, User } from '../../types';

export const AdminMaterialsView: React.FC = () => {
  const { userProfile } = useAuth();
  const [materials, setMaterials] = useState<LessonMaterial[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<LessonMaterial[]>([]);
  const [classes, setClasses] = useState<Record<string, Class>>({});
  const [teachers, setTeachers] = useState<Record<string, User>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [selectedMaterial, setSelectedMaterial] = useState<LessonMaterial | null>(null);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile || userProfile.role !== 'admin') return;

      setIsLoading(true);
      try {
        // Fetch all classes
        const classesQuery = query(collection(db, 'classes'));
        const classesDocs = await getDocs(classesQuery);
        const classesMap: Record<string, Class> = {};
        classesDocs.docs.forEach(doc => {
          const classData = { ...doc.data(), id: doc.id } as Class;
          classesMap[doc.id] = classData;
        });
        setClasses(classesMap);

        // Fetch all teachers
        const teachersQuery = query(collection(db, 'users'));
        const teachersDocs = await getDocs(teachersQuery);
        const teachersMap: Record<string, User> = {};
        teachersDocs.docs.forEach(doc => {
          const userData = { ...doc.data(), id: doc.id } as User;
          if (userData.role === 'teacher') {
            teachersMap[doc.id] = userData;
          }
        });
        setTeachers(teachersMap);

        // Fetch all materials
        const materialsQuery = query(
          collection(db, 'materials'),
          orderBy('createdAt', 'desc')
        );
        const materialsDocs = await getDocs(materialsQuery);
        const fetchedMaterials = materialsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate() || new Date()
          } as LessonMaterial;
        });

        setMaterials(fetchedMaterials);
        setFilteredMaterials(fetchedMaterials);
      } catch (error) {
        console.error('Error fetching materials data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userProfile]);

  useEffect(() => {
    let filtered = [...materials];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(material =>
        material.title.toLowerCase().includes(query) ||
        material.description.toLowerCase().includes(query)
      );
    }

    // Apply class filter
    if (selectedClass) {
      filtered = filtered.filter(material => material.classId === selectedClass);
    }

    // Apply teacher filter
    if (selectedTeacher) {
      filtered = filtered.filter(material => material.createdBy === selectedTeacher);
    }

    setFilteredMaterials(filtered);
  }, [materials, searchQuery, selectedClass, selectedTeacher]);

  const handleAssignMaterial = (material: LessonMaterial) => {
    setSelectedMaterial(material);
    setIsAssignmentDialogOpen(true);
  };

  const handleAssignmentComplete = () => {
    // Refresh materials data
    const fetchMaterials = async () => {
      const materialsQuery = query(
        collection(db, 'materials'),
        orderBy('createdAt', 'desc')
      );
      const materialsDocs = await getDocs(materialsQuery);
      const fetchedMaterials = materialsDocs.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date()
        } as LessonMaterial;
      });
      setMaterials(fetchedMaterials);
    };
    fetchMaterials();
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return <FileText className="h-8 w-8 text-error-500" />;
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return <FileText className="h-8 w-8 text-primary-500" />;
    } else if (fileType.includes('presentation') || fileType.includes('powerpoint')) {
      return <FileText className="h-8 w-8 text-accent-500" />;
    } else {
      return <FileText className="h-8 w-8 text-gray-500" />;
    }
  };

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <PageContainer title="Accesso non autorizzato">
        <p>Non hai i permessi per accedere a questa pagina.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Gestione Materiali"
      description="Visualizza e assegna i materiali didattici degli insegnanti"
    >
      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Cerca materiali..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-5 w-5" />}
            />

            <div>
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm bg-white border p-2"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="">Tutte le classi</option>
                {Object.values(classes).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm bg-white border p-2"
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
              >
                <option value="">Tutti gli insegnanti</option>
                {Object.values(teachers).map(teacher => (
                  <option key={teacher.id} value={teacher.id}>{teacher.displayName}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Materials Grid */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Caricamento dei materiali...</p>
        </div>
      ) : filteredMaterials.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMaterials.map(material => (
            <Card key={material.id} variant="bordered" className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start mb-4">
                  {getFileIcon(material.fileType)}
                  <div className="ml-4 flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{material.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{material.description}</p>
                    
                    <div className="space-y-1 text-sm text-gray-500">
                      <div>Classe: {classes[material.classId]?.name || 'Classe non trovata'}</div>
                      <div>Insegnante: {teachers[material.createdBy]?.displayName || 'Insegnante non trovato'}</div>
                      <div>Caricato: {format(material.createdAt, 'd MMMM yyyy', { locale: it })}</div>
                      {material.lessonId && (
                        <div className="text-primary-600">✓ Assegnato a lezione</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <a
                    href={material.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Scarica
                  </a>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAssignMaterial(material)}
                    leftIcon={<Settings className="h-4 w-4" />}
                  >
                    Assegna
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Nessun materiale trovato</h3>
            <p className="text-gray-500">
              {searchQuery || selectedClass || selectedTeacher
                ? 'Nessun risultato per i filtri selezionati.'
                : 'Non ci sono materiali didattici disponibili.'
              }
            </p>
          </CardContent>
        </Card>
      )}

      <MaterialAssignmentDialog
        material={selectedMaterial}
        isOpen={isAssignmentDialogOpen}
        onClose={() => {
          setIsAssignmentDialogOpen(false);
          setSelectedMaterial(null);
        }}
        onAssignmentComplete={handleAssignmentComplete}
      />
    </PageContainer>
  );
};