import React from 'react';
import { Dialog } from '@headlessui/react';
import { X } from 'lucide-react';
import { User } from '../../types';
import { Button } from '../ui/Button';

interface StudentDetailsDialogProps {
  student: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export const StudentDetailsDialog: React.FC<StudentDetailsDialogProps> = ({
  student,
  isOpen,
  onClose,
}) => {
  if (!student) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center border-b border-gray-200 p-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Dettagli Studente
            </Dialog.Title>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Nome Completo</h3>
                <p className="mt-1 text-sm text-gray-900">{student.displayName}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Email</h3>
                <p className="mt-1 text-sm text-gray-900">{student.email}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Età</h3>
                <p className="mt-1 text-sm text-gray-900">{student.age || 'Non specificato'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Sesso</h3>
                <p className="mt-1 text-sm text-gray-900">{student.sex || 'Non specificato'}</p>
              </div>

              <div className="col-span-2">
                <h3 className="text-sm font-medium text-gray-500">Indirizzo</h3>
                <p className="mt-1 text-sm text-gray-900">{student.address || 'Non specificato'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Telefono</h3>
                <p className="mt-1 text-sm text-gray-900">{student.phoneNumber || 'Non specificato'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Contatto di Emergenza</h3>
                <p className="mt-1 text-sm text-gray-900">{student.emergencyContact || 'Non specificato'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Nome Genitore</h3>
                <p className="mt-1 text-sm text-gray-900">{student.parentName || 'Non specificato'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Contatto Genitore</h3>
                <p className="mt-1 text-sm text-gray-900">{student.parentContact || 'Non specificato'}</p>
              </div>

              <div className="col-span-2">
                <h3 className="text-sm font-medium text-gray-500">Informazioni Mediche</h3>
                <p className="mt-1 text-sm text-gray-900">{student.medicalInfo || 'Nessuna informazione medica'}</p>
              </div>

              <div className="col-span-2">
                <h3 className="text-sm font-medium text-gray-500">Note</h3>
                <p className="mt-1 text-sm text-gray-900">{student.notes || 'Nessuna nota'}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 p-4 flex justify-end">
            <Button onClick={onClose}>
              Chiudi
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};