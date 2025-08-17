import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Save, Upload, FileText } from 'lucide-react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Lesson } from '../../types';

interface CreateHomeworkDialogProps {
  classId: string;
  className: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateHomeworkDialog: React.FC<CreateHomeworkDialogProps> = ({
  classId,
  className,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { userProfile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [lessonId, setLessonId] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && classId) {
      fetchLessons();
    }
  }, [isOpen, classId]);

  const fetchLessons = async () => {
    try {
      const lessonsQuery = query(
        collection(db, 'lessons'),
        where('classId', '==', classId)
      );
      const lessonsDocs = await getDocs(lessonsQuery);
      const fetchedLessons = lessonsDocs.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          date: data.date?.toDate() || new Date()
        } as Lesson;
      });
      setLessons(fetchedLessons.sort((a, b) => b.date.getTime() - a.date.getTime()));
    } catch (error) {
      console.error('Error fetching lessons:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const uploadFile = async (): Promise<string[]> => {
    if (!file) return [];
    
    try {
      const storageRef = ref(storage, `homework/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      return [downloadUrl];
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    if (!userProfile || !title.trim() || !description.trim() || !dueDate) {
      setError('Tutti i campi obbligatori devono essere compilati');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const attachmentUrls = await uploadFile();
      
      const dueDateObj = new Date(dueDate);
      dueDateObj.setHours(23, 59, 59, 999);

      await addDoc(collection(db, 'homework'), {
        title: title.trim(),
        description: description.trim(),
        classId,
        className,
        lessonId: lessonId || null,
        dueDate: dueDateObj,
        attachmentUrls,
        createdBy: userProfile.id,
        teacherName: userProfile.displayName,
        createdAt: new Date(),
        status: 'active'
      });

      onSuccess();
      onClose();
      
      // Reset form
      setTitle('');
      setDescription('');
      setDueDate(new Date().toISOString().split('T')[0]);
      setLessonId('');
      setFile(null);
    } catch (error) {
      console.error('Error creating homework:', error);
      setError('Errore durante la creazione del compito');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center border-b border-gray-200 p-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Crea Nuovo Compito - {className}
            </Dialog.Title>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-6 space-y-4">
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
                placeholder="Descrivi il compito in dettaglio..."
                required
              />
            </div>

            <Input
              label="Data di Scadenza *"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              fullWidth
              required
            />

            {lessons.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lezione (Opzionale)
                </label>
                <select
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm bg-white border p-2"
                  value={lessonId}
                  onChange={(e) => setLessonId(e.target.value)}
                >
                  <option value="">Non assegnare a una lezione specifica</option>
                  {lessons.map(lesson => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.title} - {lesson.date.toLocaleDateString('it-IT')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                File Allegato (Opzionale)
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col rounded-lg border-2 border-dashed border-gray-300 w-full h-32 p-4 group text-center cursor-pointer hover:bg-gray-50">
                  <div className="h-full w-full text-center flex flex-col items-center justify-center">
                    {file ? (
                      <>
                        <FileText className="h-6 w-6 text-primary-600" />
                        <p className="text-primary-600 pt-1">
                          {file.name} ({Math.round(file.size / 1024)} KB)
                        </p>
                        <p className="text-xs text-gray-400 pt-1">
                          Clicca per cambiare file
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-gray-400 group-hover:text-gray-600" />
                        <p className="text-gray-500 pt-1 group-hover:text-gray-600">
                          Clicca per selezionare un file
                        </p>
                        <p className="text-xs text-gray-400 pt-1">
                          PDF, DOCX, PPTX, immagini
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                  />
                </label>
              </div>
            </div>
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
              Crea Compito
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};