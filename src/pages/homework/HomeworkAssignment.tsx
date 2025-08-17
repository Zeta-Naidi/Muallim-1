import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, query, where, Timestamp, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useForm } from 'react-hook-form';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { db, storage } from '../../services/firebase';
import { Class, Lesson } from '../../types';

interface HomeworkFormValues {
  title: string;
  description: string;
  classId: string;
  lessonId?: string;
  dueDate: string;
}

export const HomeworkAssignment: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<HomeworkFormValues>({
    defaultValues: {
      dueDate: new Date().toISOString().split('T')[0]
    }
  });
  const [classes, setClasses] = useState<Class[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const selectedClassId = watch('classId');

  useEffect(() => {
    const fetchClasses = async () => {
      if (!userProfile) return;
      
      try {
        const classQuery = userProfile.role === 'admin'
          ? query(collection(db, 'classes'))
          : query(collection(db, 'classes'), where('teacherId', '==', userProfile.id));
        
        const classDocs = await getDocs(classQuery);
        setClasses(classDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class)));
      } catch (error) {
        console.error('Errore nel recupero delle classi:', error);
        setMessage({ type: 'error', text: 'Errore nel recupero delle classi' });
      }
    };
    
    fetchClasses();
  }, [userProfile]);

  useEffect(() => {
    const fetchLessons = async () => {
      if (!selectedClassId) {
        setLessons([]);
        return;
      }

      try {
        const lessonsQuery = query(
          collection(db, 'lessons'),
          where('classId', '==', selectedClassId)
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
        console.error('Errore nel recupero delle lezioni:', error);
      }
    };

    fetchLessons();
  }, [selectedClassId]);

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
      console.error('Errore nel caricamento del file:', error);
      throw error;
    }
  };

  const onSubmit = async (data: HomeworkFormValues) => {
    if (!userProfile) return;
    
    setMessage(null);
    setIsLoading(true);
    
    try {
      const attachmentUrls = await uploadFile();
      
      // Convert the date string to a valid Date object
      const dueDate = new Date(data.dueDate);
      dueDate.setHours(23, 59, 59, 999);

      if (isNaN(dueDate.getTime())) {
        throw new Error('Data di scadenza non valida');
      }

      // Get the selected class
      const selectedClass = classes.find(c => c.id === data.classId);
      if (!selectedClass) {
        throw new Error('Classe selezionata non trovata');
      }

      const homeworkData = {
        title: data.title.trim(),
        description: data.description.trim(),
        classId: data.classId,
        className: selectedClass.name,
        lessonId: data.lessonId || null,
        dueDate: Timestamp.fromDate(dueDate),
        attachmentUrls,
        createdBy: userProfile.id,
        teacherName: userProfile.displayName,
        createdAt: Timestamp.now(),
        status: 'active'
      };
      
      const docRef = await addDoc(collection(db, 'homework'), homeworkData);

      // If assigned to a lesson, update the lesson to include this homework
      if (data.lessonId) {
        await updateDoc(doc(db, 'lessons', data.lessonId), {
          homeworks: arrayUnion(docRef.id)
        });
      }
      
      setMessage({ type: 'success', text: 'Compito assegnato con successo' });
      
      // Redirect to homework list after 2 seconds
      setTimeout(() => {
        navigate('/homework');
      }, 2000);
    } catch (error) {
      console.error('Errore nell\'assegnazione del compito:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Errore nell\'assegnazione del compito'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!userProfile || (userProfile.role !== 'teacher' && userProfile.role !== 'admin')) {
    return (
      <PageContainer title="Accesso non autorizzato">
        <p>Non hai i permessi per accedere a questa pagina.</p>
      </PageContainer>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <PageContainer
      title="Assegna Compito"
      description="Crea e assegna un nuovo compito agli studenti"
    >
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Dettagli Compito</CardTitle>
        </CardHeader>
        
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {message && (
              <div className={`p-4 rounded-md flex items-center ${
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
            
            <Input
              label="Titolo"
              error={errors.title?.message}
              fullWidth
              {...register('title', { 
                required: 'Il titolo è obbligatorio',
                minLength: { value: 3, message: 'Il titolo deve avere almeno 3 caratteri' }
              })}
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrizione
              </label>
              <textarea
                className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 min-h-[120px]"
                {...register('description', { 
                  required: 'La descrizione è obbligatoria',
                  minLength: { value: 10, message: 'La descrizione deve avere almeno 10 caratteri' }
                })}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-error-500">{errors.description.message}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Classe
              </label>
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm bg-white border p-2"
                {...register('classId', { required: 'La classe è obbligatoria' })}
              >
                <option value="">Seleziona una classe</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.classId && (
                <p className="mt-1 text-sm text-error-500">{errors.classId.message}</p>
              )}
            </div>

            {selectedClassId && lessons.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lezione (Opzionale)
                </label>
                <select
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm bg-white border p-2"
                  {...register('lessonId')}
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
            
            <Input
              label="Data di scadenza"
              type="date"
              error={errors.dueDate?.message}
              fullWidth
              min={today}
              {...register('dueDate', { 
                required: 'La data di scadenza è obbligatoria',
                validate: value => {
                  const date = new Date(value);
                  const now = new Date();
                  return date >= now || 'La data di scadenza non può essere nel passato';
                }
              })}
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                File (opzionale)
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col rounded-lg border-2 border-dashed border-gray-300 w-full h-32 p-10 group text-center cursor-pointer hover:bg-gray-50">
                  <div className="h-full w-full text-center flex flex-col items-center justify-center">
                    {file ? (
                      <>
                        <Upload className="h-6 w-6 text-primary-600" />
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
                          Trascina qui il file o clicca per selezionarlo
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
          </CardContent>
          
          <CardFooter className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/homework')}
              disabled={isLoading}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={isLoading}
            >
              Assegna Compito
            </Button>
          </CardFooter>
        </form>
      </Card>
    </PageContainer>
  );
};