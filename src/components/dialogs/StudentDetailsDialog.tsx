import React from 'react';
import { Dialog } from '@headlessui/react';
import { X } from 'lucide-react';
import { User } from '../../types';
import { Button } from '../ui/Button';

interface StudentDetailsDialogProps {
  student: User | null;
  isOpen: boolean;
  onClose: () => void;
  title?: string; // allow overriding title (e.g., Dettagli Insegnante)
  actionButtons?: React.ReactNode; // Optional action buttons for teacher details
}

export const StudentDetailsDialog: React.FC<StudentDetailsDialogProps> = ({
  student,
  isOpen,
  onClose,
  title,
  actionButtons,
}) => {
  if (!student) return null;

  // Compute age from birthdate if present, otherwise fallback to provided age field
  const computeAge = (birth: any): number | null => {
    if (!birth) return null;
    const d = new Date(birth);
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  };

  // Handle different birthdate field names from both User and Student types
  const birthdate = (student as any).birthDate || (student as any).birthdate || (student as any).dateOfBirth;
  console.log(birthdate);
  const ageFromBirthdate = computeAge(birthdate);
  const ageDisplay = ageFromBirthdate != null ? `${ageFromBirthdate} anni` : ((student as any).age ? `${(student as any).age} anni` : 'Non specificato');

  // Handle gender display - convert from Student format (M/F) to readable format
  const genderDisplay = () => {
    const gender = student.gender || (student as any).sex;
    if (gender === 'M' || gender === 'male') return 'Maschio';
    if (gender === 'F' || gender === 'female') return 'Femmina';
    return 'Non specificato';
  };

  // Get full name - prioritize firstName + lastName if available
  const fullName = (student as any).firstName && (student as any).lastName 
    ? `${(student as any).firstName} ${(student as any).lastName}`
    : student.displayName;

  // Get parent information - handle both direct fields and nested parent data
  const parentName = (student as any).parentName || 'Non specificato';
  const parentContact = (student as any).parentContact || 'Non specificato';
  const parentEmail = (student as any).parentEmail || 'Non specificato';
  const parentAddress = (student as any).parentAddress || 'Non specificato';
  
  // Get student address - prioritize student's own address
  const studentAddress = student.address || parentAddress;

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
              {title ?? 'Dettagli Studente'}
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
                <p className="mt-1 text-sm text-gray-900">{fullName}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Email</h3>
                <p className="mt-1 text-sm text-gray-900">{student.email}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Età</h3>
                <p className="mt-1 text-sm text-gray-900">{ageDisplay}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Genere</h3>
                <p className="mt-1 text-sm text-gray-900">{genderDisplay()}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Indirizzo</h3>
                <p className="mt-1 text-sm text-gray-900">{studentAddress}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Città</h3>
                <p className="mt-1 text-sm text-gray-900">{(student as any).city || (student as any).parentCity || 'Non specificato'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">CAP</h3>
                <p className="mt-1 text-sm text-gray-900">{(student as any).postalCode || (student as any).parentPostalCode || 'Non specificato'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Telefono</h3>
                <p className="mt-1 text-sm text-gray-900">{student.phoneNumber || 'Non specificato'}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Nome Genitore</h3>
                <p className="mt-1 text-sm text-gray-900">{parentName}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Telefono Genitore</h3>
                <p className="mt-1 text-sm text-gray-900">{parentContact}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Email Genitore</h3>
                <p className="mt-1 text-sm text-gray-900">{parentEmail}</p>
              </div>

              {(student as any).codiceFiscale && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Codice Fiscale</h3>
                  <p className="mt-1 text-sm text-gray-900">{(student as any).codiceFiscale}</p>
                </div>
              )}

              {(student as any).emergencyContact && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Contatto di Emergenza</h3>
                  <p className="mt-1 text-sm text-gray-900">{(student as any).emergencyContact}</p>
                </div>
              )}

              {(student as any).attendanceMode && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Modalità di Frequenza</h3>
                  <p className="mt-1 text-sm text-gray-900">
                    {(student as any).attendanceMode === 'in_presenza' ? 'In Presenza' : 'Online'}
                  </p>
                </div>
              )}

              {(student as any).currentClass && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Classe Attuale</h3>
                  <p className="mt-1 text-sm text-gray-900">{(student as any).currentClass}</p>
                </div>
              )}

              {(student as any).italianSchoolClass && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Classe Italiana</h3>
                  <p className="mt-1 text-sm text-gray-900">{(student as any).italianSchoolClass}</p>
                </div>
              )}

              {(student as any).enrollmentType && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Tipo Iscrizione</h3>
                  <p className="mt-1 text-sm text-gray-900">
                    {(student as any).enrollmentType === 'nuova_iscrizione' ? 'Nuova Iscrizione' : 'Rinnovo'}
                  </p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-500">Fratelli/Sorelle</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {(student as any).siblingCount > 1 
                    ? `${(student as any).siblingCount - 1} ${(student as any).siblingCount - 1 === 1 ? 'fratello/sorella' : 'fratelli/sorelle'}`
                    : 'Figlio unico'
                  }
                </p>
              </div>

              {(student as any).selectedTurni && (student as any).selectedTurni.length > 0 && (
                <div className="col-span-2">
                  <h3 className="text-sm font-medium text-gray-500">Turni Selezionati</h3>
                  <p className="mt-1 text-sm text-gray-900">
                    {(student as any).selectedTurni.map((turno: string) => {
                      switch(turno) {
                        case 'sabato_pomeriggio': return 'Sabato Pomeriggio';
                        case 'sabato_sera': return 'Sabato Sera';
                        case 'domenica_mattina': return 'Domenica Mattina';
                        case 'domenica_pomeriggio': return 'Domenica Pomeriggio';
                        default: return turno;
                      }
                    }).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 p-4 flex justify-between items-center">
            <div className="flex gap-2">
              {actionButtons}
            </div>
            <Button onClick={onClose}>
              Chiudi
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};