import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Save, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
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
  selectedDate?: string;
}

export const CreateAttendanceDialog: React.FC<CreateAttendanceDialogProps> = ({
  classId,
  isOpen,
  onClose,
  onSuccess,
  selectedDate,
}) => {
  const { userProfile } = useAuth();
  const [date, setDate] = useState(selectedDate || format(new Date(), 'yyyy-MM-dd'));
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

  useEffect(() => {
    if (selectedDate) {
      setDate(selectedDate);
    }
  }, [selectedDate]);

  const fetchStudents = async () => {
    try {
      console.log('Fetching students for class:', classId);
      
      // Get the class document to access the students array (same as AttendanceTracking)
      const classDoc = await getDoc(doc(db, 'classes', classId));
      let fetchedStudents: User[] = [];
      
      if (classDoc.exists()) {
        const classData = classDoc.data();
        const studentIds = classData.students || [];
        console.log('Student IDs from class document:', studentIds);
        
        if (studentIds.length > 0) {
          // Fetch student documents in batches (Firestore 'in' query limit is 10)
          const studentBatches = [];
          for (let i = 0; i < studentIds.length; i += 10) {
            const batch = studentIds.slice(i, i + 10);
            const studentsQuery = query(
              collection(db, 'users'),
              where('__name__', 'in', batch)
            );
            const studentsDocs = await getDocs(studentsQuery);
            const batchStudents = studentsDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
            studentBatches.push(...batchStudents);
          }
          fetchedStudents = studentBatches;
          console.log('Fetched students:', fetchedStudents.map(s => ({ id: s.id, displayName: s.displayName })));
        } else {
          console.log('No students found in class document');
        }
      } else {
        console.log('Class document not found:', classId);
      }
      
      // Sort students by name
      fetchedStudents = fetchedStudents.sort((a, b) => 
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

    // Validate date
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      setError('Data non valida');
      setIsLoading(false);
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
        <Dialog.Panel className="mx-auto max-w-5xl w-full bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden border border-slate-200 flex flex-col">
          <div className="flex justify-between items-center border-b border-slate-200 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
              <Dialog.Title className="text-xl font-bold text-slate-900">
                Crea Registro Presenze
              </Dialog.Title>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-500 hover:text-slate-700 hover:bg-white/50">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-8 overflow-y-auto flex-1 bg-slate-50/30">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center shadow-sm">
                <AlertCircle className="h-5 w-5 mr-3 text-red-500" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center shadow-sm">
                <CheckCircle className="h-5 w-5 mr-3 text-emerald-500" />
                <span className="font-medium">{success}</span>
              </div>
            )}

            <div className="mb-8 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <Input
                label="Data"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                leftIcon={<Calendar className="h-5 w-5" />}
                helperText="Seleziona Sabato o Domenica per registrare le presenze"
                fullWidth
              />
            </div>

            {students.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Studenti ({students.length})
                    </h3>
                  </div>
                </div>
                
                <div className="divide-y divide-slate-100">
                  {students.map((student, index) => (
                    <div key={student.id} className={`p-6 hover:bg-slate-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Student Info */}
                        <div className="flex items-center gap-4 lg:w-1/3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                            <span className="text-blue-700 font-semibold text-sm">
                              {student.displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{student.displayName}</div>
                            <div className="text-sm text-slate-500">{student.email}</div>
                          </div>
                        </div>

                        {/* Status Selection */}
                        <div className="lg:w-1/3">
                          <div className="flex flex-wrap gap-3">
                            <label className="flex items-center cursor-pointer group">
                              <input
                                type="radio"
                                name={`status-${student.id}`}
                                value="present"
                                checked={attendanceData[student.id]?.status === 'present'}
                                onChange={() => handleStatusChange(student.id, 'present')}
                                className="sr-only"
                              />
                              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                                attendanceData[student.id]?.status === 'present'
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
                              }`}>
                                <CheckCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">Presente</span>
                              </div>
                            </label>
                            
                            <label className="flex items-center cursor-pointer group">
                              <input
                                type="radio"
                                name={`status-${student.id}`}
                                value="absent"
                                checked={attendanceData[student.id]?.status === 'absent'}
                                onChange={() => handleStatusChange(student.id, 'absent')}
                                className="sr-only"
                              />
                              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                                attendanceData[student.id]?.status === 'absent'
                                  ? 'border-red-500 bg-red-50 text-red-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-red-300'
                              }`}>
                                <X className="h-4 w-4" />
                                <span className="text-sm font-medium">Assente</span>
                              </div>
                            </label>
                            
                            <label className="flex items-center cursor-pointer group">
                              <input
                                type="radio"
                                name={`status-${student.id}`}
                                value="justified"
                                checked={attendanceData[student.id]?.status === 'justified'}
                                onChange={() => handleStatusChange(student.id, 'justified')}
                                className="sr-only"
                              />
                              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                                attendanceData[student.id]?.status === 'justified'
                                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300'
                              }`}>
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">Giustificato</span>
                              </div>
                            </label>
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="lg:w-1/3">
                          <input
                            type="text"
                            className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm placeholder-slate-400"
                            placeholder="Aggiungi note..."
                            value={attendanceData[student.id]?.notes || ''}
                            onChange={(e) => handleNotesChange(student.id, e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                <div className="h-16 w-16 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Nessuno studente trovato</h3>
                <p className="text-slate-500">Non ci sono studenti registrati per questa classe.</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50/50 px-8 py-6 flex justify-between items-center flex-shrink-0">
            <div className="text-sm text-slate-600">
              {students.length > 0 && (
                <span>
                  {students.filter(s => attendanceData[s.id]?.status === 'present').length} presenti, {' '}
                  {students.filter(s => attendanceData[s.id]?.status === 'absent').length} assenti, {' '}
                  {students.filter(s => attendanceData[s.id]?.status === 'justified').length} giustificati
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={onClose} 
                disabled={isLoading}
                className="px-6"
              >
                Annulla
              </Button>
              <Button
                onClick={handleSave}
                isLoading={isLoading}
                disabled={isLoading || students.length === 0}
                leftIcon={<Save className="h-4 w-4" />}
                className="px-6 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Crea Registro
              </Button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};