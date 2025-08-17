import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Users, Save } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useFirestore } from '../../hooks/useFirestore';
import { User } from '../../types';
import { db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface AssignStudentsDialogProps {
  classId: string;
  isOpen: boolean;
  onClose: () => void;
  onAssigned: () => void;
}

export const AssignStudentsDialog: React.FC<AssignStudentsDialogProps> = ({
  classId,
  isOpen,
  onClose,
  onAssigned,
}) => {
  const { getAll: getStudents } = useFirestore<User>('users');
  const { update: updateClass } = useFirestore<any>('classes');

  const [students, setStudents] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await getStudents({ role: 'student' });
        setStudents(list || []);
        // fetch current class students
        const classDoc = await getDoc(doc(db, 'classes', classId));
        const current = (classDoc.exists() ? (classDoc.data()?.students as string[] | undefined) : []) || [];
        setSelectedIds(current);
      } catch (e) {
        console.error(e);
        setError('Errore nel caricamento degli studenti');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, getStudents, classId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      [s.displayName, s.email].some((f) => f?.toLowerCase().includes(q))
    );
  }, [students, search]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateClass(classId, {
        students: selectedIds,
      });
      onAssigned();
      onClose();
    } catch (e) {
      console.error(e);
      setError('Impossibile aggiornare gli studenti. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-3xl w-full bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center border-b border-gray-200 p-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">Gestisci studenti</Dialog.Title>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-6 space-y-4">
            {error && <div className="p-3 bg-error-50 text-error-700 rounded-md text-sm">{error}</div>}

            <Input
              placeholder="Cerca studenti..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fullWidth
            />

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                <p className="mt-2 text-gray-600">Caricamento studenti...</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto border rounded-lg divide-y divide-gray-100">
                {filtered.map((s) => (
                  <label key={s.id} className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedIds.includes(s.id)}
                        onChange={() => toggle(s.id)}
                      />
                      <div>
                        <p className="font-medium text-gray-900">{s.displayName}</p>
                        <p className="text-sm text-gray-500">{s.email}</p>
                      </div>
                    </div>
                    {selectedIds.includes(s.id) && <Users className="h-5 w-5 text-primary-600" />}
                  </label>
                ))}
                {filtered.length === 0 && (
                  <div className="p-6 text-center text-gray-500">Nessuno studente trovato</div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 p-4 flex justify-end space-x-4">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={saving} isLoading={saving} leftIcon={<Save className="h-4 w-4" />}>
              Salva
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default AssignStudentsDialog;
