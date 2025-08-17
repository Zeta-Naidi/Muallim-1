import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Plus, FileText, Trash2, Download, File, Search, AlertCircle, CheckCircle, Edit } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EditMaterialDialog } from '../../components/dialogs/EditMaterialDialog';
import { useAuth } from '../../context/AuthContext';
import { db, storage } from '../../services/firebase';
import { LessonMaterial, Class } from '../../types';

export const MaterialsList: React.FC = () => {
  const { userProfile } = useAuth();
  const [materials, setMaterials] = useState<LessonMaterial[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<LessonMaterial[]>([]);
  const [classes, setClasses] = useState<Record<string, Class>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingMaterial, setDeletingMaterial] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<LessonMaterial | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      if (!userProfile) return;
      
      try {
        const classQuery = query(collection(db, 'classes'));
        const classDocs = await getDocs(classQuery);
        
        const classesMap: Record<string, Class> = {};
        classDocs.docs.forEach(doc => {
          const classData = { ...doc.data(), id: doc.id } as Class;
          classesMap[doc.id] = classData;
        });
        
        setClasses(classesMap);
      } catch (error) {
        console.error('Errore nel recupero delle classi:', error);
      }
    };
    
    fetchClasses();
  }, [userProfile]);

  useEffect(() => {
    const fetchMaterials = async () => {
      if (!userProfile) return;
      
      setIsLoading(true);
      
      try {
        let materialsQuery;
        
        if (userProfile.role === 'student') {
          // Only query if classId is defined
          if (userProfile.classId) {
            materialsQuery = query(
              collection(db, 'materials'),
              where('classId', '==', userProfile.classId),
              orderBy('createdAt', 'desc')
            );
          } else {
            // If no classId, set empty arrays and return
            setMaterials([]);
            setFilteredMaterials([]);
            setIsLoading(false);
            return;
          }
        } else if (userProfile.role === 'teacher') {
          materialsQuery = query(
            collection(db, 'materials'),
            where('createdBy', '==', userProfile.id),
            orderBy('createdAt', 'desc')
          );
        } else if (userProfile.role === 'admin') {
          if (selectedClass) {
            materialsQuery = query(
              collection(db, 'materials'),
              where('classId', '==', selectedClass),
              orderBy('createdAt', 'desc')
            );
          } else {
            materialsQuery = query(
              collection(db, 'materials'),
              orderBy('createdAt', 'desc')
            );
          }
        }
        
        if (materialsQuery) {
          const materialsDocs = await getDocs(materialsQuery);
          const fetchedMaterials = materialsDocs.docs.map(doc => ({ 
            ...doc.data(), 
            id: doc.id,
            createdAt: doc.data().createdAt?.toDate() || new Date()
          } as LessonMaterial));
          setMaterials(fetchedMaterials);
          setFilteredMaterials(fetchedMaterials);
        }
      } catch (error) {
        console.error('Errore nel recupero dei materiali didattici:', error);
        setMessage({ type: 'error', text: 'Errore nel recupero dei materiali didattici' });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMaterials();
  }, [userProfile, selectedClass]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredMaterials(materials);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = materials.filter(material => 
        material.title.toLowerCase().includes(query) || 
        material.description.toLowerCase().includes(query)
      );
      setFilteredMaterials(filtered);
    }
  }, [searchQuery, materials]);

  const handleDeleteMaterial = async (material: LessonMaterial) => {
    if (!window.confirm(`Sei sicuro di voler eliminare il materiale "${material.title}"? Questa azione non può essere annullata.`)) {
      return;
    }
    
    setDeletingMaterial(material.id);
    setMessage(null);
    
    try {
      // Delete the file from Firebase Storage
      try {
        const fileRef = ref(storage, material.fileUrl);
        await deleteObject(fileRef);
        console.log('File deleted from storage successfully');
      } catch (storageError) {
        console.warn('Could not delete file from storage (file may not exist):', storageError);
        // Continue with database deletion even if storage deletion fails
      }
      
      // Delete the document from Firestore
      await deleteDoc(doc(db, 'materials', material.id));
      
      // Update local state
      setMaterials(prev => prev.filter(m => m.id !== material.id));
      setFilteredMaterials(prev => prev.filter(m => m.id !== material.id));
      
      setMessage({ type: 'success', text: 'Materiale eliminato con successo' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Errore nell\'eliminazione del materiale:', error);
      setMessage({ type: 'error', text: 'Errore nell\'eliminazione del materiale' });
      
      // Clear error message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setDeletingMaterial(null);
    }
  };

  const handleEditMaterial = (material: LessonMaterial) => {
    setEditingMaterial(material);
    setIsEditDialogOpen(true);
  };

  const handleMaterialUpdate = (updatedMaterial: LessonMaterial) => {
    setMaterials(prev => prev.map(m => 
      m.id === updatedMaterial.id ? updatedMaterial : m
    ));
    setFilteredMaterials(prev => prev.map(m => 
      m.id === updatedMaterial.id ? updatedMaterial : m
    ));
  };

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedClass(e.target.value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const canEditMaterial = (material: LessonMaterial): boolean => {
    return userProfile?.role === 'admin' || 
           (userProfile?.role === 'teacher' && material.createdBy === userProfile.id);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) {
      return <FileText className="h-10 w-10 text-error-500" />;
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return <FileText className="h-10 w-10 text-primary-500" />;
    } else if (fileType.includes('presentation') || fileType.includes('powerpoint')) {
      return <FileText className="h-10 w-10 text-accent-500" />;
    } else if (fileType.includes('image')) {
      return <File className="h-10 w-10 text-secondary-500" />;
    } else {
      return <File className="h-10 w-10 text-gray-500" />;
    }
  };

  if (!userProfile) return null;

  return (
    <PageContainer
      title="Materiali Didattici"
      description={
        userProfile.role === 'student'
          ? 'Visualizza i materiali didattici'
          : 'Gestisci i materiali didattici per gli studenti'
      }
      actions={
        (userProfile.role === 'teacher' || userProfile.role === 'admin') && (
          <Link to="/materials/new">
            <Button leftIcon={<Plus className="h-4 w-4" />}>
              Nuovo Materiale
            </Button>
          </Link>
        )
      }
    >
      {message && (
        <div className={`mb-6 p-4 rounded-md flex items-center ${
          message.type === 'success' ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 mr-2" />
          ) : (
            <AlertCircle className="h-5 w-5 mr-2" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userProfile.role === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filtra per classe
                </label>
                <select
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm bg-white border p-2"
                  value={selectedClass}
                  onChange={handleClassChange}
                >
                  <option value="">Tutte le classi</option>
                  {Object.values(classes).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div>
              <Input
                label="Cerca materiali"
                placeholder="Titolo o descrizione..."
                value={searchQuery}
                onChange={handleSearchChange}
                leftIcon={<Search className="h-5 w-5" />}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Caricamento dei materiali...</p>
        </div>
      ) : filteredMaterials.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMaterials.map((material) => (
            <Card 
              key={material.id}
              variant="bordered"
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex items-start mb-4">
                  {getFileIcon(material.fileType)}
                  <div className="ml-4 flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 truncate pr-4">{material.title}</h3>
                    <p className="text-sm text-gray-500">
                      Aggiunto il {format(material.createdAt, 'd MMMM yyyy', { locale: it })}
                    </p>
                  </div>
                  {canEditMaterial(material) && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEditMaterial(material)}
                        className="text-gray-400 hover:text-primary-500 focus:outline-none"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMaterial(material)}
                        disabled={deletingMaterial === material.id}
                        className={`text-gray-400 hover:text-error-500 focus:outline-none transition-colors ${
                          deletingMaterial === material.id ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {deletingMaterial === material.id ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-error-500 border-t-transparent" />
                        ) : (
                          <Trash2 className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
                
                <p className="text-gray-600 mb-4 line-clamp-3">
                  {material.description}
                </p>
                
                <div className="flex items-center text-sm text-gray-500 mb-4">
                  <FileText className="h-4 w-4 mr-1 flex-shrink-0" />
                  <span>
                    Classe: {classes[material.classId]?.name || 'Classe non trovata'}
                  </span>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between">
                  <span className="text-sm text-gray-500">
                    {material.fileType.split('/').pop()?.toUpperCase() || 'FILE'}
                  </span>
                  <a 
                    href={material.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Scarica
                  </a>
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
              {searchQuery 
                ? 'Nessun risultato per la tua ricerca. Prova con termini diversi.'
                : userProfile.role === 'student'
                  ? !userProfile.classId
                    ? 'Non sei assegnato ad alcuna classe.'
                    : 'Non ci sono materiali didattici disponibili in questo momento.'
                  : 'Non hai ancora caricato alcun materiale didattico.'
              }
            </p>
            {(userProfile.role === 'teacher' || userProfile.role === 'admin') && !searchQuery && (
              <div className="mt-4">
                <Link to="/materials/new">
                  <Button>Carica un materiale</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Material Dialog */}
      <EditMaterialDialog
        material={editingMaterial}
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingMaterial(null);
        }}
        onUpdate={handleMaterialUpdate}
      />
    </PageContainer>
  );
};