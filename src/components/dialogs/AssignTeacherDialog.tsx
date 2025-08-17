import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X, UserCheck, Save } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useFirestore } from '../../hooks/useFirestore';
import { User } from '../../types';

interface AssignTeacherDialogProps {
  classId: string;
  currentTeacherName?: string;
  isOpen: boolean;
  onClose: () => void;
  onAssigned: () => void;
}

export const AssignTeacherDialog: React.FC<AssignTeacherDialogProps> = ({
  classId,
  currentTeacherName,
  isOpen,
  onClose,
  onAssigned,
}) => {
  const { getAll: getTeachers } = useFirestore<User>('users');
  const { update: updateClass } = useFirestore<any>('classes');

  const [teachers, setTeachers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await getTeachers({ role: 'teacher' });
        setTeachers(list || []);
      } catch (e) {
        console.error(e);
        setError('Errore nel caricamento degli insegnanti');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, getTeachers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) =>
      [t.displayName, t.email].some((f) => f?.toLowerCase().includes(q))
    );
  }, [teachers, search]);

  const handleAssign = async () => {
    if (!selectedTeacher) return;
    setSaving(true);
    setError(null);
    try {
      await updateClass(classId, {
        teacherId: selectedTeacher.id,
        teacherName: selectedTeacher.displayName,
      });
      onAssigned();
      onClose();
    } catch (e) {
      console.error(e);
      setError('Impossibile assegnare l\'insegnante. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center border-b border-gray-200 p-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Assegna insegnante {currentTeacherName ? `(attuale: ${currentTeacherName})` : ''}
            </Dialog.Title>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-6 space-y-4">
            {error && <div className="p-3 bg-error-50 text-error-700 rounded-md text-sm">{error}</div>}
            <div className="relative">
              <Input
                placeholder="Cerca insegnante..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                fullWidth
              />
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                <p className="mt-2 text-gray-600">Caricamento insegnanti...</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 border rounded-lg">
                {filtered.map((t) => (
                  <button
                    key={t.id}
                    className={`w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 ${
                      selectedTeacher?.id === t.id ? 'bg-primary-50' : ''
                    }`}
                    onClick={() => setSelectedTeacher(t)}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{t.displayName}</p>
                      <p className="text-sm text-gray-500">{t.email}</p>
                    </div>
                    {selectedTeacher?.id === t.id && (
                      <UserCheck className="h-5 w-5 text-primary-600" />
                    )}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="p-6 text-center text-gray-500">Nessun insegnante trovato</div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 p-4 flex justify-end space-x-4">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Annulla
            </Button>
            <Button onClick={handleAssign} disabled={!selectedTeacher || saving} isLoading={saving} leftIcon={<Save className="h-4 w-4" />}>
              Assegna
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default AssignTeacherDialog;
