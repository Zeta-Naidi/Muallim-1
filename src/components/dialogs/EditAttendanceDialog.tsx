import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Save } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Attendance } from '../../types';

interface EditAttendanceDialogProps {
  attendance: Attendance | null;
  studentName: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedAttendance: Attendance) => void;
}

export const EditAttendanceDialog: React.FC<EditAttendanceDialogProps> = ({
  attendance,
  studentName,
  isOpen,
  onClose,
  onUpdate,
}) => {
  const [status, setStatus] = useState<'present' | 'absent' | 'justified'>(attendance?.status || 'present');
  const [notes, setNotes] = useState(attendance?.notes || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (attendance) {
      setStatus(attendance.status);
      setNotes(attendance.notes || '');
    }
  }, [attendance]);

  const handleSave = async () => {
    if (!attendance) return;

    setIsLoading(true);
    setError(null);

    try {
      await updateDoc(doc(db, 'attendance', attendance.id), {
        status,
        notes: notes.trim(),
        updatedAt: new Date(),
      });

      const updatedAttendance = {
        ...attendance,
        status,
        notes: notes.trim(),
      };

      onUpdate(updatedAttendance);
      onClose();
    } catch (error) {
      console.error('Error updating attendance:', error);
      setError('Errore durante l\'aggiornamento della presenza');
    } finally {
      setIsLoading(false);
    }
  };

  if (!attendance) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center border-b border-gray-200 p-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Modifica Presenza - {studentName}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stato Presenza
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="present"
                    checked={status === 'present'}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="h-4 w-4 text-success-600 focus:ring-success-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Presente</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="absent"
                    checked={status === 'absent'}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="h-4 w-4 text-error-600 focus:ring-error-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Assente</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="status"
                    value="justified"
                    checked={status === 'justified'}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Giustificato</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note (Opzionale)
              </label>
              <textarea
                className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 min-h-[80px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Aggiungi note sulla presenza..."
              />
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
              Salva
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};