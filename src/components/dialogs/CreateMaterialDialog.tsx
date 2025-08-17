import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Save, Upload, FileText, Copy } from 'lucide-react';
import { collection, addDoc, getDocs, query } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Class } from '../../types';

interface CreateMaterialDialogProps {
  classId: string;
  className: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateMaterialDialog: React.FC<CreateMaterialDialogProps> = ({
  classId,
  className,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { userProfile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([classId]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchClasses();
      setSelectedClasses([classId]); // Always include current class
    }
  }, [isOpen, classId]);

  const fetchClasses = async () => {
    try {
      const classesQuery = query(collection(db, 'classes'));
      const classesDocs = await getDocs(classesQuery);
      const fetchedClasses = classesDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));
      setClasses(fetchedClasses);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'audio/mpeg',
        'audio/mp3',
        'audio/wav'
      ];
      
      if (!allowedTypes.includes(selectedFile.type)) {
        setError('Tipo di file non supportato. Sono accettati: PDF, Word, PNG, JPG, MP3');
        return;
      }
      
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('Il file è troppo grande. Dimensione massima: 10MB');
        return;
      }
      
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleClassToggle = (classIdToToggle: string) => {
    if (classIdToToggle === classId) return; // Can't unselect current class
    
    setSelectedClasses(prev => 
      prev.includes(classIdToToggle)
        ? prev.filter(id => id !== classIdToToggle)
        : [...prev, classIdToToggle]
    );
  };

  const uploadFile = async (): Promise<{ url: string; type: string }> => {
    if (!file) throw new Error('Nessun file selezionato');
    
    try {
      const storageRef = ref(storage, `materials/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      return { url: downloadUrl, type: file.type };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    if (!userProfile || !title.trim() || !description.trim() || !file) {
      setError('Tutti i campi sono obbligatori');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { url, type } = await uploadFile();
      
      // Create material for each selected class
      const createPromises = selectedClasses.map(targetClassId => {
        const targetClass = classes.find(c => c.id === targetClassId);
        return addDoc(collection(db, 'materials'), {
          title: title.trim(),
          description: description.trim(),
          classId: targetClassId,
          fileUrl: url,
          fileType: type,
          createdBy: userProfile.id,
          teacherName: userProfile.displayName,
          createdAt: new Date(),
        });
      });

      await Promise.all(createPromises);

      onSuccess();
      onClose();
      
      // Reset form
      setTitle('');
      setDescription('');
      setFile(null);
      setSelectedClasses([classId]);
    } catch (error) {
      console.error('Error creating material:', error);
      setError('Errore durante la creazione del materiale');
    } finally {
      setIsLoading(false);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return '🖼️';
    } else if (file.type.startsWith('audio/')) {
      return '🎵';
    } else if (file.type.includes('pdf')) {
      return '📄';
    } else if (file.type.includes('word')) {
      return '📝';
    } else {
      return '📎';
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl max-h-[90vh] overflow-hidden">
          <div className="flex justify-between items-center border-b border-gray-200 p-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Carica Nuovo Materiale - {className}
            </Dialog.Title>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
            {error && (
              <div className="p-3 bg-error-50 text-error-700 rounded-md text-sm">
                {error}
              </div>
            )}

            <Input
              label="Titolo *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrizione *
              </label>
              <textarea
                className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 min-h-[120px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrivi il materiale didattico..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                File *
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col rounded-lg border-2 border-dashed border-gray-300 w-full h-32 p-4 group text-center cursor-pointer hover:bg-gray-50">
                  <div className="h-full w-full text-center flex flex-col items-center justify-center">
                    {file ? (
                      <>
                        <div className="text-2xl mb-2">{getFileIcon(file)}</div>
                        <p className="text-primary-600 pt-1 font-medium">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {Math.round(file.size / 1024)} KB - Clicca per cambiare
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-gray-400 group-hover:text-gray-600" />
                        <p className="text-gray-500 pt-1 group-hover:text-gray-600">
                          Clicca per selezionare un file
                        </p>
                        <p className="text-xs text-gray-400 pt-1">
                          PDF, Word, PNG, JPG, MP3 (max 10MB)
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.mp3,.wav"
                  />
                </label>
              </div>
            </div>

            {classes.length > 1 && (
              <div>
                <div className="flex items-center mb-2">
                  <Copy className="h-4 w-4 text-gray-500 mr-2" />
                  <label className="block text-sm font-medium text-gray-700">
                    Clona in Altre Classi (Opzionale)
                  </label>
                </div>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
                  {classes.map(cls => (
                    <label key={cls.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(cls.id)}
                        onChange={() => handleClassToggle(cls.id)}
                        disabled={cls.id === classId}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className={`ml-3 text-sm ${cls.id === classId ? 'text-primary-600 font-medium' : 'text-gray-700'}`}>
                        {cls.name} {cls.id === classId && '(Classe corrente)'}
                      </span>
                    </label>
                  ))}
                </div>
                {selectedClasses.length > 1 && (
                  <p className="text-sm text-gray-500 mt-1">
                    Il materiale sarà creato in {selectedClasses.length} classi
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 p-4 flex justify-end space-x-4">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Annulla
            </Button>
            <Button
              onClick={handleSave}
              isLoading={isLoading}
              disabled={isLoading || !file}
              leftIcon={<Save className="h-4 w-4" />}
            >
              Carica Materiale
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};