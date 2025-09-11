import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { Clock, MapPin, CheckCircle, AlertCircle, Calendar, Users, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { Class, TeacherCheckIn } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

export const TeacherCheckInPage: React.FC = () => {
  const { userProfile } = useAuth();
  const [teacherClass, setTeacherClass] = useState<Class | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [hasLessonToday, setHasLessonToday] = useState(false);
  const [todayCheckIn, setTodayCheckIn] = useState<TeacherCheckIn | null>(null);

  useEffect(() => {
    if (userProfile?.role === 'teacher') {
      fetchTeacherClass();
      fetchTodayCheckIn();
    }
  }, [userProfile]);

  const fetchTeacherClass = async () => {
    if (!userProfile) return;

    try {
      const classQuery = query(
        collection(db, 'classes'),
        where('teacherId', '==', userProfile.id)
      );

      const classSnapshot = await getDocs(classQuery);
      if (!classSnapshot.empty) {
        const classData = classSnapshot.docs[0].data() as Class;
        const classWithId = { ...classData, id: classSnapshot.docs[0].id };
        setTeacherClass(classWithId);
        
        // Check if today is a lesson day
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
        
        let hasLesson = false;
        if (classData.turno) {
          switch (classData.turno) {
            case 'sabato pomeriggio':
            case 'sabato sera':
              hasLesson = dayOfWeek === 6; // Saturday
              break;
            case 'domenica mattina':
            case 'domenica pomeriggio':
              hasLesson = dayOfWeek === 0; // Sunday
              break;
          }
        }
        setHasLessonToday(true);
      }
    } catch (error) {
      console.error('Errore nel recupero della classe:', error);
      setMessage({ type: 'error', text: 'Errore nel recupero delle informazioni della classe' });
    }
  };

  const fetchTodayCheckIn = async () => {
    if (!userProfile) return;

    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const checkInQuery = query(
        collection(db, 'teacherCheckIns'),
        where('teacherId', '==', userProfile.id),
        where('checkInTime', '>=', Timestamp.fromDate(startOfDay)),
        where('checkInTime', '<=', Timestamp.fromDate(endOfDay))
      );

      const checkInSnapshot = await getDocs(checkInQuery);
      if (!checkInSnapshot.empty) {
        const checkInData = checkInSnapshot.docs[0].data() as any;
        setTodayCheckIn({
          ...checkInData,
          id: checkInSnapshot.docs[0].id,
          checkInTime: checkInData.checkInTime instanceof Date ? checkInData.checkInTime : checkInData.checkInTime.toDate(),
          checkOutTime: checkInData.checkOutTime ? (checkInData.checkOutTime instanceof Date ? checkInData.checkOutTime : checkInData.checkOutTime.toDate()) : undefined,
        });
      }
    } catch (error) {
      console.error('Errore nel recupero dei check-in:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!userProfile || !teacherClass) return;

    setCheckingIn(true);

    try {
      const now = new Date();
      
      // Get location if available
      let location = '';
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          location = `${position.coords.latitude},${position.coords.longitude}`;
        } catch (error) {
          console.log('Geolocation not available');
        }
      }

      const checkInData: Omit<TeacherCheckIn, 'id'> = {
        teacherId: userProfile.id,
        teacherName: userProfile.displayName,
        scheduledLessonId: `${teacherClass.id}-${now.toDateString()}`, // Create a unique ID for today's lesson
        classId: teacherClass.id,
        className: teacherClass.name,
        checkInTime: now,
        status: 'checked_in',
        isLate: false,
        location,
        createdAt: now,
      };

      await addDoc(collection(db, 'teacherCheckIns'), {
        ...checkInData,
        checkInTime: Timestamp.fromDate(checkInData.checkInTime),
        createdAt: Timestamp.fromDate(checkInData.createdAt),
      });

      setMessage({
        type: 'success',
        text: 'Check-in effettuato con successo!'
      });

      // Refresh check-in data
      await fetchTodayCheckIn();

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Errore nel check-in:', error);
      setMessage({ type: 'error', text: 'Errore durante il check-in' });
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayCheckIn) return;

    setCheckingIn(true);

    try {
      const now = new Date();
      
      await updateDoc(doc(db, 'teacherCheckIns', todayCheckIn.id), {
        checkOutTime: Timestamp.fromDate(now),
        status: 'checked_out',
        updatedAt: Timestamp.fromDate(now),
      });

      setMessage({ type: 'success', text: 'Check-out effettuato con successo!' });
      
      // Refresh check-in data
      await fetchTodayCheckIn();

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Errore nel check-out:', error);
      setMessage({ type: 'error', text: 'Errore durante il check-out' });
    } finally {
      setCheckingIn(false);
    }
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

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };


  if (!userProfile || userProfile.role !== 'teacher') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-8 text-center max-w-md mx-auto">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-2xl font-light text-gray-900 mb-2">Accesso non autorizzato</h3>
          <p className="text-gray-600">Solo gli insegnanti possono accedere a questa pagina.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-white/5" />
        
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
                <Clock className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Check-in Lezioni</h1>
                <p className="text-green-100 mt-1">Registra la tua presenza alle lezioni di oggi</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence>
          {message && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mb-6 p-4 rounded-xl flex items-center ${
                message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 mr-3 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
              )}
              <span>{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-light">Caricamento lezioni...</p>
          </div>
        ) : !hasLessonToday ? (
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl">
            <CardContent className="p-12 text-center">
              <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessuna lezione oggi</h3>
              <p className="text-gray-600">Non hai lezioni programmate per oggi.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
                <CardHeader className={`${
                  todayCheckIn?.status === 'checked_out' ? 'bg-gradient-to-r from-gray-50 to-slate-50' :
                  todayCheckIn ? 'bg-gradient-to-r from-green-50 to-emerald-50' :
                  'bg-gradient-to-r from-blue-50 to-indigo-50'
                } border-b border-gray-100`}>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${
                        todayCheckIn?.status === 'checked_out' ? 'bg-gray-100' :
                        todayCheckIn ? 'bg-green-100' :
                        'bg-blue-100'
                      }`}>
                        <BookOpen className={`h-5 w-5 ${
                          todayCheckIn?.status === 'checked_out' ? 'text-gray-600' :
                          todayCheckIn ? 'text-green-600' :
                          'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{teacherClass?.name}</h3>
                        <p className="text-sm text-gray-600">
                          {teacherClass?.turno && getTurnoTime(teacherClass.turno)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {todayCheckIn && (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          todayCheckIn.status === 'checked_out' ? 'bg-gray-100 text-gray-700' :
                          todayCheckIn.status === 'late' ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {todayCheckIn.status === 'checked_out' ? 'Completata' :
                           todayCheckIn.status === 'late' ? `In ritardo (${todayCheckIn.lateMinutes}min)` :
                           'Presente'}
                        </span>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users className="h-4 w-4" />
                        <span className="text-sm">Classe: {teacherClass?.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">
                          Turno: {teacherClass?.turno && getTurnoTime(teacherClass.turno)}
                        </span>
                      </div>
                      {teacherClass?.subject && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <BookOpen className="h-4 w-4" />
                          <span className="text-sm">Materia: {teacherClass.subject}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {todayCheckIn && (
                        <>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">
                              Check-in: {formatDateTime(todayCheckIn.checkInTime)}
                            </span>
                          </div>
                          {todayCheckIn.checkOutTime && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Clock className="h-4 w-4" />
                              <span className="text-sm">
                                Check-out: {formatDateTime(todayCheckIn.checkOutTime)}
                              </span>
                            </div>
                          )}
                          {todayCheckIn.location && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <MapPin className="h-4 w-4" />
                              <span className="text-sm">Posizione registrata</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    {!todayCheckIn && (
                      <Button
                        onClick={handleCheckIn}
                        disabled={checkingIn}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        leftIcon={<CheckCircle className="h-4 w-4" />}
                      >
                        {checkingIn ? 'Check-in...' : 'Fai Check-in'}
                      </Button>
                    )}

                    {todayCheckIn && todayCheckIn.status !== 'checked_out' && (
                      <Button
                        onClick={handleCheckOut}
                        disabled={checkingIn}
                        variant="outline"
                        leftIcon={<Clock className="h-4 w-4" />}
                      >
                        {checkingIn ? 'Check-out...' : 'Fai Check-out'}
                      </Button>
                    )}

                    {todayCheckIn?.status === 'checked_out' && (
                      <p className="text-sm text-green-600 flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Lezione completata con successo
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};
