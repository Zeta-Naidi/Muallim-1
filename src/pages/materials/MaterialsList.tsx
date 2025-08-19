import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Plus, FileText, Trash2, Download, File, Search, AlertCircle, CheckCircle, Edit, BookOpen, Users, FolderOpen } from 'lucide-react';
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
      return <FileText className="h-8 w-8 text-red-500" />;
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return <FileText className="h-8 w-8 text-blue-500" />;
    } else if (fileType.includes('presentation') || fileType.includes('powerpoint')) {
      return <FileText className="h-8 w-8 text-orange-500" />;
    } else if (fileType.includes('image')) {
      return <File className="h-8 w-8 text-green-500" />;
    } else {
      return <File className="h-8 w-8 text-slate-500" />;
    }
  };

  if (!userProfile) return null;

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
                <BookOpen className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Materiali Didattici</h1>
                <p className="text-blue-100 mt-1">
                  {userProfile.role === 'student'
                    ? 'Visualizza i materiali didattici condivisi dai tuoi insegnanti'
                    : 'Gestisci e condividi materiali didattici con gli studenti'
                  }
                </p>
              </div>
            </div>
            
            {(userProfile.role === 'teacher' || userProfile.role === 'admin') && (
              <div className="flex items-center gap-2 mt-8">
                <Link to="/materials/new">
                  <Button
                    leftIcon={<Plus className="h-4 w-4" />}
                    className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
                  >
                    Nuovo Materiale
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center ${
            message.type === 'success' ? 'bg-success-50 text-success-700 border border-success-200' : 'bg-error-50 text-error-700 border border-error-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-3 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <Card className="mb-6 bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="flex items-center text-slate-900">
              <Search className="h-5 w-5 mr-2 text-blue-600" />
              Filtri e Ricerca
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {userProfile.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Filtra per classe
                  </label>
                  <select
                    className="block w-full rounded-xl border border-slate-200 bg-white h-10 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
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
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600 font-light">Caricamento dei materiali...</p>
          </div>
        ) : filteredMaterials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMaterials.map((material) => (
              <Card 
                key={material.id}
                className="bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 hover:border-slate-300"
              >
                <CardContent className="p-6">
                  <div className="flex items-start mb-4">
                    <div className="p-2 rounded-xl bg-blue-50">
                      {getFileIcon(material.fileType)}
                    </div>
                    <div className="ml-4 flex-1">
                      <h3 className="text-lg font-semibold text-slate-900 truncate pr-4">{material.title}</h3>
                      <p className="text-sm text-slate-500">
                        Aggiunto il {format(material.createdAt, 'd MMMM yyyy', { locale: it })}
                      </p>
                    </div>
                    {canEditMaterial(material) && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditMaterial(material)}
                          className="text-slate-400 hover:text-blue-600 focus:outline-none transition-colors"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMaterial(material)}
                          disabled={deletingMaterial === material.id}
                          className={`text-slate-400 hover:text-red-600 focus:outline-none transition-colors ${
                            deletingMaterial === material.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {deletingMaterial === material.id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-500 border-t-transparent" />
                          ) : (
                            <Trash2 className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-slate-600 mb-4 line-clamp-3">
                    {material.description}
                  </p>
                  
                  <div className="flex items-center text-sm text-slate-500 mb-4">
                    <Users className="h-4 w-4 mr-2 flex-shrink-0 text-blue-600" />
                    <span>
                      Classe: {classes[material.classId]?.name || 'Classe non trovata'}
                    </span>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-xs font-medium text-slate-700">
                      {material.fileType.split('/').pop()?.toUpperCase() || 'FILE'}
                    </span>
                    <a 
                      href={material.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
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
          <Card className="bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
            <CardContent className="p-12 text-center">
              <FolderOpen className="h-16 w-16 text-slate-400 mx-auto mb-6" />
              <h3 className="text-2xl font-light text-slate-900 mb-3">Nessun materiale trovato</h3>
              <p className="text-slate-600 max-w-md mx-auto mb-8">
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
      </div>
    </div>
  );
};