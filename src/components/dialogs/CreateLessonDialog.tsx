import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Save, Plus, Paperclip } from 'lucide-react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { LessonMaterial } from '../../types';

interface CreateLessonDialogProps {
  classId: string;
  className: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newLesson: any) => void;
  initialDate?: Date;
}

export const CreateLessonDialog: React.FC<CreateLessonDialogProps> = ({
  classId,
  className,
  isOpen,
  onClose,
  onSuccess,
  initialDate,
}) => {
  const { userProfile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Helper function to convert local date to YYYY-MM-DD format without timezone issues
  const toLocalISOString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState(
    initialDate 
      ? toLocalISOString(initialDate)
      : toLocalISOString(new Date())
  );
  const [topics, setTopics] = useState<{name: string, details: string}[]>([{name: '', details: ''}]);
  const [materials, setMaterials] = useState<LessonMaterial[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && classId) {
      fetchMaterials();
    }
  }, [isOpen, classId]);

  // Update date when initialDate changes
  useEffect(() => {
    if (initialDate) {
      setDate(toLocalISOString(initialDate));
    } else {
      setDate(toLocalISOString(new Date()));
    }
  }, [initialDate]);

  const fetchMaterials = async () => {
    try {
      const materialsQuery = query(
        collection(db, 'materials'),
        where('classId', '==', classId)
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
    } catch (error) {
      console.error('Error fetching materials:', error);
    }
  };

  const handleTopicChange = (index: number, field: 'name' | 'details', value: string) => {
    const newTopics = [...topics];
    newTopics[index] = { ...newTopics[index], [field]: value };
    setTopics(newTopics);
  };

  const handleAddTopic = () => {
    setTopics([...topics, {name: '', details: ''}]);
  };

  const handleRemoveTopic = (index: number) => {
    if (topics.length > 1) {
      setTopics(topics.filter((_, i) => i !== index));
    }
  };

  const handleMaterialToggle = (materialId: string) => {
    setSelectedMaterials(prev => 
      prev.includes(materialId)
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    );
  };

  const handleSave = async () => {
    if (!userProfile || !title.trim() || !description.trim() || !date) {
      setError('Titolo, descrizione e data sono obbligatori');
      return;
    }

    const filteredTopics = topics.filter(topic => topic.name.trim() !== '');
    if (filteredTopics.length === 0) {
      setError('Almeno un argomento è obbligatorio');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create date at noon local time to avoid timezone issues
      const [year, month, day] = date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day, 12, 0, 0);
      
      const newLesson = {
        title: title.trim(),
        description: description.trim(),
        classId,
        date: localDate,
        topics: filteredTopics.map(t => t.name),
        topicDetails: filteredTopics.reduce((acc, topic) => {
          if (topic.details.trim()) {
            acc[topic.name] = topic.details;
          }
          return acc;
        }, {} as Record<string, string>),
        materials: selectedMaterials,
        homeworks: [],
        createdBy: userProfile.id,
        teacherName: userProfile.displayName,
        createdAt: new Date(),
      };

      const docRef = await addDoc(collection(db, 'lessons'), newLesson);
      onSuccess({ id: docRef.id, ...newLesson });
      onClose();
      
      // Reset form
      setTitle('');
      setDescription('');
      setDate(toLocalISOString(new Date()));
      setTopics([{name: '', details: ''}]);
      setSelectedMaterials([]);
    } catch (error) {
      console.error('Error creating lesson:', error);
      setError('Errore durante la creazione della lezione');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl max-h-[90vh] overflow-hidden">
          <div className="flex justify-between items-center border-b border-gray-200 p-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Crea Nuova Lezione - {className}
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
                placeholder="Descrivi la lezione in dettaglio..."
                required
              />
            </div>

            <Input
              label="Data *"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              fullWidth
              required
            />

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Argomenti Trattati *
                </label>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddTopic}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Aggiungi Argomento
                </Button>
              </div>
              
              {topics.map((topic, index) => (
                <div key={index} className="mb-4 p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Input
                      value={topic.name}
                      onChange={(e) => handleTopicChange(index, 'name', e.target.value)}
                      placeholder={`Argomento ${index + 1}`}
                      fullWidth
                    />
                    {topics.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveTopic(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Dettagli argomento (opzionale)
                    </label>
                    <textarea
                      className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm p-2 min-h-[60px]"
                      value={topic.details}
                      onChange={(e) => handleTopicChange(index, 'details', e.target.value)}
                      placeholder="Descrivi i dettagli specifici di questo argomento..."
                    />
                  </div>
                </div>
              ))}
            </div>

            {materials.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Materiali da Allegare (Opzionale)
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
                  {materials.map(material => (
                    <label key={material.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedMaterials.includes(material.id)}
                        onChange={() => handleMaterialToggle(material.id)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div className="ml-3 flex items-center">
                        <Paperclip className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-700">{material.title}</span>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedMaterials.length > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedMaterials.length} materiale/i selezionato/i
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
              disabled={isLoading}
              leftIcon={<Save className="h-4 w-4" />}
            >
              Crea Lezione
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};