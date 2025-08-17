import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X, BookOpen, Check } from 'lucide-react';
import { collection, getDocs, query, where, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { LessonMaterial, Lesson, Class } from '../../types';

interface MaterialAssignmentDialogProps {
  material: LessonMaterial | null;
  isOpen: boolean;
  onClose: () => void;
  onAssignmentComplete: () => void;
}

export const MaterialAssignmentDialog: React.FC<MaterialAssignmentDialogProps> = ({
  material,
  isOpen,
  onClose,
  onAssignmentComplete,
}) => {
  const { userProfile } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (!material || !isOpen) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch all classes
        const classesQuery = query(collection(db, 'classes'));
        const classesDocs = await getDocs(classesQuery);
        const fetchedClasses = classesDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class));
        setClasses(fetchedClasses);

        // Fetch all lessons
        const lessonsQuery = query(collection(db, 'lessons'));
        const lessonsDocs = await getDocs(lessonsQuery);
        const fetchedLessons = lessonsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date?.toDate() || new Date(),
            materials: data.materials || []
          } as Lesson;
        });
        setLessons(fetchedLessons);

        // Pre-select lessons that already have this material
        const lessonsWithMaterial = fetchedLessons
          .filter(lesson => lesson.materials?.includes(material.id))
          .map(lesson => lesson.id);
        setSelectedLessons(lessonsWithMaterial);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [material, isOpen]);

  const handleLessonToggle = (lessonId: string) => {
    setSelectedLessons(prev => 
      prev.includes(lessonId)
        ? prev.filter(id => id !== lessonId)
        : [...prev, lessonId]
    );
  };

  const handleAssign = async () => {
    if (!material) return;

    setIsAssigning(true);
    try {
      // Update material with lesson assignment
      if (selectedLessons.length > 0) {
        await updateDoc(doc(db, 'materials', material.id), {
          lessonId: selectedLessons[0], // For simplicity, assign to first selected lesson
        });
      }

      // Update lessons to include this material
      const updatePromises = selectedLessons.map(lessonId => 
        updateDoc(doc(db, 'lessons', lessonId), {
          materials: arrayUnion(material.id)
        })
      );

      await Promise.all(updatePromises);

      onAssignmentComplete();
      onClose();
    } catch (error) {
      console.error('Error assigning material:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  const getClassName = (classId: string) => {
    return classes.find(c => c.id === classId)?.name || 'Classe sconosciuta';
  };

  if (!material) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl">
          <div className="flex justify-between items-center border-b border-gray-200 p-4">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Assegna Materiale: {material.title}
            </Dialog.Title>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Caricamento lezioni...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  Seleziona le lezioni a cui assegnare questo materiale:
                </p>
                
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {lessons.map(lesson => (
                    <div
                      key={lesson.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedLessons.includes(lesson.id)
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleLessonToggle(lesson.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <BookOpen className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <h4 className="font-medium text-gray-900">{lesson.title}</h4>
                            <p className="text-sm text-gray-500">
                              {getClassName(lesson.classId)} - {lesson.date.toLocaleDateString('it-IT')}
                            </p>
                          </div>
                        </div>
                        {selectedLessons.includes(lesson.id) && (
                          <Check className="h-5 w-5 text-primary-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {lessons.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    Nessuna lezione disponibile
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 p-4 flex justify-end space-x-4">
            <Button variant="outline" onClick={onClose} disabled={isAssigning}>
              Annulla
            </Button>
            <Button
              onClick={handleAssign}
              isLoading={isAssigning}
              disabled={isAssigning || selectedLessons.length === 0}
            >
              Assegna Materiale
            </Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};