import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Save, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { collection, addDoc, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { format, isWeekend } from 'date-fns';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { User } from '../../types';

interface CreateAttendanceDialogProps {
  classId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateAttendanceDialog: React.FC<CreateAttendanceDialogProps> = ({
  classId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { userProfile } = useAuth();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [students, setStudents] = useState<User[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, { status: 'present' | 'absent' | 'justified'; notes: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && classId) {
      fetchStudents();
    }
  }, [isOpen, classId]);

  const fetchStudents = async () => {
    try {
      // Get the class document to access the students array
      const classDoc = await getDoc(doc(db, 'classes', classId));
      if (!classDoc.exists()) {
        setError('Classe non trovata');
        return;
      }
      
      const classData = classDoc.data();
      const studentIds = classData.students || [];
      
      if (studentIds.length === 0) {
        setStudents([]);
        setAttendanceData({});
        return;
      }
      
      // Fetch student documents in batches (Firestore 'in' query limit is 10)
      const studentBatches = [];
      for (let i = 0; i < studentIds.length; i += 10) {
        const batch = studentIds.slice(i, i + 10);
        const studentsQuery = query(
          collection(db, 'students'),
          where('__name__', 'in', batch)
        );
        const studentsDocs = await getDocs(studentsQuery);
        const batchStudents = studentsDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        studentBatches.push(...batchStudents);
      }
      
      // Sort students by name
      const fetchedStudents = studentBatches.sort((a, b) => 
        a.displayName.localeCompare(b.displayName)
      );
      
      setStudents(fetchedStudents);

      // Initialize attendance data with default 'present' status
      const initialData: Record<string, { status: 'present' | 'absent' | 'justified'; notes: string }> = {};
      fetchedStudents.forEach(student => {
        initialData[student.id] = { status: 'present', notes: '' };
      });
      setAttendanceData(initialData);
    } catch (error) {
      console.error('Error fetching students:', error);
      setError('Errore nel caricamento degli studenti');
    }
  };

  const handleStatusChange = (studentId: string, status: 'present' | 'absent' | 'justified') => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], status }
    }));
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], notes }
    }));
  };

  const handleSave = async () => {
    if (!userProfile || !classId) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // Validate date is weekend
    const selectedDate = new Date(date);
    if (!isWeekend(selectedDate)) {
      setError('È possibile creare presenze solo per Sabato o Domenica');
      return;
    }

    try {
      const attendancePromises = students.map(student => {
        const data = attendanceData[student.id];
        return addDoc(collection(db, 'attendance'), {
          studentId: student.id,
          classId,
          date: new Date(date),
          status: data.status,
          notes: data.notes.trim(),
          createdBy: userProfile.id,
          createdAt: new Date(),
        });
      });

      await Promise.all(attendancePromises);
      setSuccess('Registro presenze creato con successo');
      
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error creating attendance:', error);
      setError('Errore durante la creazione del registro presenze');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-4xl w-full bg-white rounded-lg shadow-xl max-h-[90vh] overflow-hidden">
          <div className="flex justify-between items-center border-b border-gray-200 p-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Crea Registro Presenze
            </Dialog.Title>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {error && (
              <div className="mb-4 p-3 bg-error-50 text-error-700 rounded-md text-sm flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-success-50 text-success-700 rounded-md text-sm flex items-center">
                <CheckCircle className="h-4 w-4 mr-2" />
                {success}
              </div>
            )}

            <div className="mb-6">
              <Input
                label="Data"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                leftIcon={<Calendar className="h-5 w-5" />}
                helperText="Seleziona Sabato o Domenica"
                fullWidth
              />
            </div>

            {students.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Studenti ({students.length})
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Studente
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Presenza
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Note
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.map(student => (
                        <tr key={student.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{student.displayName}</div>
                            <div className="text-sm text-gray-500">{student.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex space-x-2">
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name={`status-${student.id}`}
                                  value="present"
                                  checked={attendanceData[student.id]?.status === 'present'}
                                  onChange={() => handleStatusChange(student.id, 'present')}
                                  className="h-4 w-4 text-success-600 focus:ring-success-500 border-gray-300"
                                />
                                <span className="ml-1 text-xs text-gray-700">Presente</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name={`status-${student.id}`}
                                  value="absent"
                                  checked={attendanceData[student.id]?.status === 'absent'}
                                  onChange={() => handleStatusChange(student.id, 'absent')}
                                  className="h-4 w-4 text-error-600 focus:ring-error-500 border-gray-300"
                                />
                                <span className="ml-1 text-xs text-gray-700">Assente</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="radio"
                                  name={`status-${student.id}`}
                                  value="justified"
                                  checked={attendanceData[student.id]?.status === 'justified'}
                                  onChange={() => handleStatusChange(student.id, 'justified')}
                                  className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300"
                                />
                                <span className="ml-1 text-xs text-gray-700">Giustificato</span>
                              </label>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                              placeholder="Note..."
                              value={attendanceData[student.id]?.notes || ''}
                              onChange={(e) => handleNotesChange(student.id, e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">Nessuno studente trovato per questa classe.</p>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 p-4 flex justify-end space-x-4">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Annulla
            </Button>
            <Button
              onClick={handleSave}
              isLoading={isLoading}
              disabled={isLoading || students.length === 0}
              leftIcon={<Save className="h-4 w-4" />}
            >
              Crea Registro
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};