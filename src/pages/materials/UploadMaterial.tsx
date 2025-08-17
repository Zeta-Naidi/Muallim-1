import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useForm } from 'react-hook-form';
import { Upload, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { db, storage } from '../../services/firebase';
import { Class } from '../../types';

interface MaterialFormValues {
  title: string;
  description: string;
  classId: string;
}

export const UploadMaterial: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<MaterialFormValues>();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      if (!userProfile) return;
      
      try {
        const classQuery = userProfile.role === 'admin'
          ? query(collection(db, 'classes'))
          : query(collection(db, 'classes'), where('teacherId', '==', userProfile.id));
        
        const classDocs = await getDocs(classQuery);
        setClasses(classDocs.docs.map(doc => doc.data() as Class));
      } catch (error) {
        console.error('Errore nel recupero delle classi:', error);
        setMessage({ type: 'error', text: 'Errore nel recupero delle classi' });
      }
    };
    
    fetchClasses();
  }, [userProfile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const uploadFile = async (): Promise<{ url: string; type: string }> => {
    if (!file) throw new Error('Nessun file selezionato');
    
    try {
      const storageRef = ref(storage, `materials/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      return { url: downloadUrl, type: file.type };
    } catch (error) {
      console.error('Errore nel caricamento del file:', error);
      throw error;
    }
  };

  const onSubmit = async (data: MaterialFormValues) => {
    if (!userProfile || !file) {
      setMessage({ type: 'error', text: 'Seleziona un file da caricare' });
      return;
    }
    
    setMessage(null);
    setIsLoading(true);
    
    try {
      const { url, type } = await uploadFile();
      
      await addDoc(collection(db, 'materials'), {
        title: data.title,
        description: data.description,
        classId: data.classId,
        fileUrl: url,
        fileType: type,
        createdBy: userProfile.id,
        createdAt: new Date(),
      });
      
      setMessage({ type: 'success', text: 'Materiale caricato con successo' });
      
      // Reindirizza alla lista dei materiali dopo 2 secondi
      setTimeout(() => {
        navigate('/materials');
      }, 2000);
    } catch (error) {
      console.error('Errore nel caricamento del materiale:', error);
      setMessage({ type: 'error', text: 'Errore nel caricamento del materiale' });
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

  return (
    <PageContainer
      title="Carica Materiale Didattico"
      description="Carica un nuovo materiale didattico per gli studenti"
    >
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Dettagli Materiale</CardTitle>
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
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                File
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col rounded-lg border-2 border-dashed border-gray-300 w-full h-32 p-10 group text-center cursor-pointer hover:bg-gray-50">
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
                    required
                  />
                </label>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/materials')}
              disabled={isLoading}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={isLoading || !file}
            >
              Carica Materiale
            </Button>
          </CardFooter>
        </form>
      </Card>
    </PageContainer>
  );
};