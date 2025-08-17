import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Save } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { LessonMaterial } from '../../types';

interface EditMaterialDialogProps {
  material: LessonMaterial | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedMaterial: LessonMaterial) => void;
}

export const EditMaterialDialog: React.FC<EditMaterialDialogProps> = ({
  material,
  isOpen,
  onClose,
  onUpdate,
}) => {
  const [title, setTitle] = useState(material?.title || '');
  const [description, setDescription] = useState(material?.description || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (material) {
      setTitle(material.title);
      setDescription(material.description);
    }
  }, [material]);

  const handleSave = async () => {
    if (!material) return;

    if (!title.trim() || !description.trim()) {
      setError('Titolo e descrizione sono obbligatori');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await updateDoc(doc(db, 'materials', material.id), {
        title: title.trim(),
        description: description.trim(),
        updatedAt: new Date(),
      });

      const updatedMaterial = {
        ...material,
        title: title.trim(),
        description: description.trim(),
      };

      onUpdate(updatedMaterial);
      onClose();
    } catch (error) {
      console.error('Error updating material:', error);
      setError('Errore durante l\'aggiornamento del materiale');
    } finally {
      setIsLoading(false);
    }
  };

  if (!material) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center border-b border-gray-200 p-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Modifica Materiale
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
              label="Titolo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrizione
              </label>
              <textarea
                className="block w-full rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 min-h-[120px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Nota:</strong> Il file associato a questo materiale non può essere modificato. 
                Per cambiare il file, è necessario creare un nuovo materiale.
              </p>
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