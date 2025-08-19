import React, { useEffect, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Save, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useFirestore } from '../../hooks/useFirestore';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface CreateClassDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface Teacher {
  id: string;
  displayName: string;
  email: string;
}

export const CreateClassDialog: React.FC<CreateClassDialogProps> = ({ isOpen, onClose, onCreated }) => {
  const { create } = useFirestore<any>('classes');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [turno, setTurno] = useState<'Sabato Pomeriggio' | 'Sabato Sera' | 'Domenica Mattina' | 'Domenica Pomeriggio' | ''>('');
  const [teacherId, setTeacherId] = useState<string>('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load teachers when dialog opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      loadTeachers();
    }
  }, [isOpen]);

  const loadTeachers = async () => {
    setIsLoadingTeachers(true);
    try {
      const teachersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'teacher'),
        where('accountStatus', '==', 'active')
      );
      const teachersDocs = await getDocs(teachersQuery);
      const teachersList = teachersDocs.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          displayName: data.displayName || data.name || 'Nome non disponibile',
          email: data.email || ''
        } as Teacher;
      });
      setTeachers(teachersList);
    } catch (error) {
      console.error('Error loading teachers:', error);
      setError('Errore nel caricamento degli insegnanti');
    } finally {
      setIsLoadingTeachers(false);
    }
  };

  const reset = () => {
    setName('');
    setDescription('');
    setTurno('');
    setTeacherId('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Il nome della classe è obbligatorio');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await create({
        name: name.trim(),
        description: description.trim() || '',
        turno: turno || null,
        students: [],
        teacherId: teacherId || null,
        teacherName: teacherId ? teachers.find(t => t.id === teacherId)?.displayName || '' : '',
        studentsCount: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      onCreated();
      onClose();
      reset();
    } catch (e) {
      console.error('Errore durante la creazione della classe:', e);
      setError('Impossibile creare la classe. Riprova.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-xl w-full bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center border-b border-gray-200 p-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Crea nuova classe
            </Dialog.Title>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-error-50 text-error-700 rounded-md text-sm">{error}</div>
            )}

            <Input
              label="Nome classe *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
              <textarea
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 min-h-[80px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrizione della classe (opzionale)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Turno</label>
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm bg-white border p-2"
                value={turno}
                onChange={(e) => setTurno(e.target.value as any)}
              >
                <option value="">Seleziona turno</option>
                <option value="Sabato Pomeriggio">Sabato Pomeriggio</option>
                <option value="Sabato Sera">Sabato Sera</option>
                <option value="Domenica Mattina">Domenica Mattina</option>
                <option value="Domenica Pomeriggio">Domenica Pomeriggio</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="h-4 w-4 inline mr-1" />
                Insegnante
              </label>
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm bg-white border p-2"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                disabled={isLoadingTeachers}
              >
                <option value="">Nessun insegnante assegnato</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.displayName} ({teacher.email})
                  </option>
                ))}
              </select>
              {isLoadingTeachers && (
                <p className="text-sm text-gray-500 mt-1">Caricamento insegnanti...</p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 p-4 flex justify-end space-x-4">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Annulla
            </Button>
            <Button onClick={handleSave} isLoading={isSaving} disabled={isSaving} leftIcon={<Save className="h-4 w-4" />}>
              Crea
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default CreateClassDialog;
