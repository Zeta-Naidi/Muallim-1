import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Clock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { Class } from '../../types';
import { useNavigate } from 'react-router-dom';

export const CheckInBanner: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [shouldShowBanner, setShouldShowBanner] = useState(false);
  const [isVisible] = useState(true);
  const [teacherClass, setTeacherClass] = useState<Class | null>(null);

  useEffect(() => {
    if (userProfile?.role === 'teacher') {
      checkIfShouldShowBanner();
    }
  }, [userProfile]);

  const checkIfShouldShowBanner = async () => {
    if (!userProfile) return;

    try {
      // Get teacher's class
      const classQuery = query(
        collection(db, 'classes'),
        where('teacherId', '==', userProfile.id)
      );
      
      const classSnapshot = await getDocs(classQuery);
      if (classSnapshot.empty) return;

      const teacherClassData = classSnapshot.docs[0].data() as Class;
      setTeacherClass({ ...teacherClassData, id: classSnapshot.docs[0].id });

      // Check if today is a lesson day for this class
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
      
      let hasLessonToday = false;
      
      if (teacherClassData.turno) {
        switch (teacherClassData.turno) {
          case 'sabato pomeriggio':
          case 'sabato sera':
            hasLessonToday = dayOfWeek === 6; // Saturday
            break;
          case 'domenica mattina':
          case 'domenica pomeriggio':
            hasLessonToday = dayOfWeek === 0; // Sunday
            break;
        }
      }

      if (!hasLessonToday) return;

      // Check if teacher has already checked in today
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const checkInQuery = query(
        collection(db, 'teacherCheckIns'),
        where('teacherId', '==', userProfile.id),
        where('checkInTime', '>=', Timestamp.fromDate(startOfDay)),
        where('checkInTime', '<=', Timestamp.fromDate(endOfDay))
      );

      const checkInSnapshot = await getDocs(checkInQuery);
      
      // Show banner if no check-in found for today
      setShouldShowBanner(checkInSnapshot.empty);
    } catch (error) {
      console.error('Errore nel controllo del check-in:', error);
    }
  };

  const handleBannerClick = () => {
    navigate('/teacher/checkin');
  };

  const getTurnoTime = (turno: string) => {
    switch (turno) {
      case 'sabato pomeriggio':
        return 'Sabato Pomeriggio';
      case 'sabato sera':
        return 'Sabato Sera';
      case 'domenica mattina':
        return 'Domenica Mattina';
      case 'domenica pomeriggio':
        return 'Domenica Pomeriggio';
      default:
        return turno;
    }
  };

  if (!shouldShowBanner || !isVisible || !teacherClass) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        transition={{ duration: 0.3 }}
        className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4"
      >
        <div
          onClick={handleBannerClick}
          className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl shadow-2xl p-4 cursor-pointer hover:from-orange-600 hover:to-red-600 transition-all duration-200 border border-orange-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Check-in Richiesto</h3>
                <p className="text-xs text-orange-100 mt-1">
                  {getTurnoTime(teacherClass.turno || '')} - Classe {teacherClass.name}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-orange-100">
            Clicca per registrare la tua presenza
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
