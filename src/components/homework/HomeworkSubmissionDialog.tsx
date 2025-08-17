import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Upload, FileText, Mic, Camera, Send } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Homework } from '../../types';

interface HomeworkSubmissionDialogProps {
  homework: Homework | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmissionComplete: () => void;
}

export const HomeworkSubmissionDialog: React.FC<HomeworkSubmissionDialogProps> = ({
  homework,
  isOpen,
  onClose,
  onSubmissionComplete,
}) => {
  const { userProfile } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [submissionText, setSubmissionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<string[]> => {
    const uploadPromises = files.map(async (file) => {
      const storageRef = ref(storage, `homework-submissions/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      return getDownloadURL(storageRef);
    });
    
    return Promise.all(uploadPromises);
  };

  const handleSubmit = async () => {
    if (!homework || !userProfile || files.length === 0) {
      setError('Seleziona almeno un file da caricare');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const submissionUrls = await uploadFiles();

      await addDoc(collection(db, 'homeworkSubmissions'), {
        homeworkId: homework.id,
        studentId: userProfile.id,
        studentName: userProfile.displayName,
        submissionUrls,
        submissionText: submissionText.trim(),
        submittedAt: new Date(),
        status: 'submitted',
      });

      onSubmissionComplete();
      onClose();
      setFiles([]);
      setSubmissionText('');
    } catch (error) {
      console.error('Error submitting homework:', error);
      setError('Errore durante l\'invio del compito');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Camera className="h-5 w-5" />;
    } else if (file.type.startsWith('audio/')) {
      return <Mic className="h-5 w-5" />;
    } else {
      return <FileText className="h-5 w-5" />;
    }
  };

  if (!homework) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center border-b border-gray-200 p-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Consegna Compito: {homework.title}
            </Dialog.Title>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-error-50 text-error-700 rounded-md">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Carica File (Foto, Audio, Documenti)
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col rounded-lg border-2 border-dashed border-gray-300 w-full h-32 p-4 group text-center cursor-pointer hover:bg-gray-50">
                  <div className="h-full w-full text-center flex flex-col items-center justify-center">
                    <Upload className="h-6 w-6 text-gray-400 group-hover:text-gray-600" />
                    <p className="text-gray-500 pt-1 group-hover:text-gray-600">
                      Clicca per selezionare i file
                    </p>
                    <p className="text-xs text-gray-400 pt-1">
                      Foto, audio, PDF, documenti
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    onChange={handleFileChange}
                    accept="image/*,audio/*,.pdf,.doc,.docx"
                  />
                </label>
              </div>
            </div>

            {files.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File Selezionati
                </label>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        {getFileIcon(file)}
                        <span className="ml-2 text-sm text-gray-700">{file.name}</span>
                        <span className="ml-2 text-xs text-gray-500">
                          ({Math.round(file.size / 1024)} KB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note Aggiuntive (Opzionale)
              </label>
              <textarea
                className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 min-h-[100px]"
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                placeholder="Aggiungi eventuali note o spiegazioni..."
              />
            </div>
          </div>

          <div className="border-t border-gray-200 p-4 flex justify-end space-x-4">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Annulla
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={isSubmitting || files.length === 0}
              leftIcon={<Send className="h-4 w-4" />}
            >
              Consegna Compito
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};