import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { BarChart3, Users, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Filter, Download, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { User, TeacherCheckIn, TeacherAttendanceStats as TeacherAttendanceStatsType } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

interface TeacherStatsDisplay extends TeacherAttendanceStatsType {
  user: User;
}

export const TeacherAttendanceStats: React.FC = () => {
  const { userProfile } = useAuth();
  const [teachers, setTeachers] = useState<User[]>([]);
  const [teacherStats, setTeacherStats] = useState<TeacherStatsDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'attendanceRate' | 'totalLessons'>('attendanceRate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchTeachers();
    }
  }, [userProfile]);

  useEffect(() => {
    if (teachers.length > 0) {
      calculateStats();
    }
  }, [teachers, selectedPeriod]);

  const fetchTeachers = async () => {
    try {
      const teachersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'teacher')
      );

      const teachersSnapshot = await getDocs(teachersQuery);
      const teachersData = teachersSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as User[];

      setTeachers(teachersData);
    } catch (error) {
      console.error('Errore nel recupero degli insegnanti:', error);
    }
  };

  const calculateStats = async () => {
    setIsLoading(true);
    
    try {
      const [year, month] = selectedPeriod.split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

      const statsPromises = teachers.map(async (teacher) => {
        // Get teacher's class to determine lesson schedule
        const classQuery = query(
          collection(db, 'classes'),
          where('teacherId', '==', teacher.id)
        );

        const classSnapshot = await getDocs(classQuery);
        let totalScheduledLessons = 0;

        console.log(`Teacher ${teacher.displayName}: classSnapshot.empty = ${classSnapshot.empty}`);
        
        if (!classSnapshot.empty) {
          const teacherClass = classSnapshot.docs[0].data();
          console.log(`Teacher ${teacher.displayName}: turno = ${teacherClass.turno}`);
          
          // Calculate expected lessons based on class schedule
          if (teacherClass.turno) {
            const lessonDays: number[] = [];
            
            switch (teacherClass.turno) {
              case 'sabato pomeriggio':
              case 'sabato sera':
                lessonDays.push(6); // Saturday
                break;
              case 'domenica mattina':
              case 'domenica pomeriggio':
                lessonDays.push(0); // Sunday
                break;
            }

            // Count lesson days in the selected period
            const currentDate = new Date(startDate);
            while (currentDate <= endDate) {
              if (lessonDays.includes(currentDate.getDay())) {
                totalScheduledLessons++;
              }
              currentDate.setDate(currentDate.getDate() + 1);
            }
            
            console.log(`Teacher ${teacher.displayName}: totalScheduledLessons = ${totalScheduledLessons} for period ${selectedPeriod}`);
          }
        }

        // Fetch check-ins for the period
        const checkInsQuery = query(
          collection(db, 'teacherCheckIns'),
          where('teacherId', '==', teacher.id),
          where('checkInTime', '>=', Timestamp.fromDate(startDate)),
          where('checkInTime', '<=', Timestamp.fromDate(endDate))
        );

        const checkInsSnapshot = await getDocs(checkInsQuery);
        const checkIns = checkInsSnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          checkInTime: doc.data().checkInTime.toDate(),
          checkOutTime: doc.data().checkOutTime?.toDate(),
        })) as TeacherCheckIn[];
        
        console.log(`Teacher ${teacher.displayName}: found ${checkIns.length} check-ins for period ${selectedPeriod}`);

        // Calculate statistics
        const attendedLessons = checkIns.filter(ci => 
          ci.status === 'checked_in' || ci.status === 'checked_out' || ci.status === 'late'
        ).length;
        const missedLessons = Math.max(0, totalScheduledLessons - attendedLessons);
        const lateArrivals = checkIns.filter(ci => ci.status === 'late' || ci.isLate).length;
        const attendanceRate = totalScheduledLessons > 0 ? (attendedLessons / totalScheduledLessons) * 100 : 0;
        
        const lateCheckIns = checkIns.filter(ci => ci.isLate && ci.lateMinutes);
        const averageLateMinutes = lateCheckIns.length > 0 
          ? lateCheckIns.reduce((sum, ci) => sum + (ci.lateMinutes || 0), 0) / lateCheckIns.length 
          : 0;

        const stats: TeacherStatsDisplay = {
          teacherId: teacher.id,
          teacherName: teacher.displayName,
          period: selectedPeriod,
          totalScheduledLessons,
          attendedLessons,
          missedLessons,
          lateArrivals,
          attendanceRate: Math.round(attendanceRate * 100) / 100,
          averageLateMinutes: Math.round(averageLateMinutes * 100) / 100,
          lastUpdated: new Date(),
          user: teacher,
        };

        return stats;
      });

      const allStats = await Promise.all(statsPromises);
      setTeacherStats(allStats);
    } catch (error) {
      console.error('Errore nel calcolo delle statistiche:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAndSortedStats = teacherStats
    .filter(stat => 
      stat.teacherName.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.teacherName.localeCompare(b.teacherName);
          break;
        case 'attendanceRate':
          comparison = a.attendanceRate - b.attendanceRate;
          break;
        case 'totalLessons':
          comparison = a.totalScheduledLessons - b.totalScheduledLessons;
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  const overallStats = {
    totalTeachers: teacherStats.length,
    averageAttendanceRate: teacherStats.length > 0 
      ? teacherStats.reduce((sum, stat) => sum + stat.attendanceRate, 0) / teacherStats.length 
      : 0,
    totalLessons: teacherStats.reduce((sum, stat) => sum + stat.totalScheduledLessons, 0),
    totalMissedLessons: teacherStats.reduce((sum, stat) => sum + stat.missedLessons, 0),
    teachersWithPerfectAttendance: teacherStats.filter(stat => stat.attendanceRate === 100).length,
    teachersWithLowAttendance: teacherStats.filter(stat => stat.attendanceRate < 80).length,
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600 bg-green-50';
    if (rate >= 85) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getAttendanceIcon = (rate: number) => {
    if (rate >= 95) return <CheckCircle className="h-4 w-4" />;
    if (rate >= 85) return <Clock className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  const exportToCSV = () => {
    const headers = ['Nome Insegnante', 'Lezioni Programmate', 'Lezioni Frequentate', 'Lezioni Perse', 'Ritardi', 'Percentuale Presenza', 'Media Minuti Ritardo'];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedStats.map(stat => [
        stat.teacherName,
        stat.totalScheduledLessons,
        stat.attendedLessons,
        stat.missedLessons,
        stat.lateArrivals,
        `${stat.attendanceRate}%`,
        stat.averageLateMinutes || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `statistiche_presenze_${selectedPeriod}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!userProfile || userProfile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 p-8 text-center max-w-md mx-auto">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-2xl font-light text-gray-900 mb-2">Accesso non autorizzato</h3>
          <p className="text-gray-600">Solo gli amministratori possono accedere a questa pagina.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-white/5" />
        
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm">
                <BarChart3 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Statistiche Presenze Insegnanti</h1>
                <p className="text-purple-100 mt-1">Monitora l'attendance e le performance degli insegnanti</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Controls */}
        <Card className="mb-6 bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtri e Controlli
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Periodo</label>
                <input
                  type="month"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <Input
                  label="Cerca Insegnante"
                  placeholder="Nome insegnante..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  fullWidth
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ordina per</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="attendanceRate">Percentuale Presenza</option>
                  <option value="name">Nome</option>
                  <option value="totalLessons">Numero Lezioni</option>
                </select>
              </div>
              
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="flex-1"
                >
                  {sortOrder === 'desc' ? <TrendingDown className="h-4 w-4 mr-2" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                  {sortOrder === 'desc' ? 'Decrescente' : 'Crescente'}
                </Button>
                <Button
                  onClick={exportToCSV}
                  className="bg-green-600 hover:bg-green-700"
                  leftIcon={<Download className="h-4 w-4" />}
                >
                  Esporta CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Insegnanti Totali</p>
                  <p className="text-2xl font-bold text-gray-900">{overallStats.totalTeachers}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Presenza Media</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round(overallStats.averageAttendanceRate * 100) / 100}%
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-xl">
                  <BarChart3 className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Presenza Perfetta</p>
                  <p className="text-2xl font-bold text-gray-900">{overallStats.teachersWithPerfectAttendance}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-xl">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Presenza Bassa (&lt;80%)</p>
                  <p className="text-2xl font-bold text-gray-900">{overallStats.teachersWithLowAttendance}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Teachers Statistics Table */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 font-light">Caricamento statistiche...</p>
          </div>
        ) : (
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Dettaglio Presenze Insegnanti ({filteredAndSortedStats.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Insegnante</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Lezioni Programmate</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Frequentate</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Perse</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Ritardi</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">% Presenza</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Media Ritardo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    <AnimatePresence>
                      {filteredAndSortedStats.map((stat) => (
                        <motion.tr
                          key={stat.teacherId}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-blue-50/30 transition-all duration-200"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 flex items-center justify-center">
                                <span className="text-purple-700 font-semibold text-sm">
                                  {stat.teacherName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{stat.teacherName}</div>
                                <div className="text-sm text-gray-500">{stat.user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-lg font-semibold text-gray-900">{stat.totalScheduledLessons}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-lg font-semibold text-green-600">{stat.attendedLessons}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-lg font-semibold ${stat.missedLessons > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {stat.missedLessons}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-lg font-semibold ${stat.lateArrivals > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                              {stat.lateArrivals}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getAttendanceColor(stat.attendanceRate)}`}>
                              {getAttendanceIcon(stat.attendanceRate)}
                              {stat.attendanceRate}%
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm text-gray-600">
                              {stat.averageLateMinutes ? `${stat.averageLateMinutes} min` : '-'}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
