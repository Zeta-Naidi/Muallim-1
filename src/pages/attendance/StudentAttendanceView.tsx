import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay, addMonths, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import { Calendar, Check, X, ShieldCheck, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Attendance } from '../../types';

export const StudentAttendanceView: React.FC = () => {
  const { userProfile } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!userProfile?.classId) return;

      setIsLoading(true);
      try {
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('studentId', '==', userProfile.id),
          where('classId', '==', userProfile.classId),
          orderBy('date', 'desc')
        );

        const attendanceDocs = await getDocs(attendanceQuery);
        const records = attendanceDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date?.toDate() || new Date()
          } as Attendance;
        });

        setAttendanceRecords(records);
      } catch (error) {
        console.error('Error fetching attendance:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendance();
  }, [userProfile]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      return direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1);
    });
  };

  const getAttendanceForDate = (date: Date): Attendance | undefined => {
    return attendanceRecords.find(record => 
      isSameDay(record.date, date)
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <Check className="h-4 w-4 text-success-600" />;
      case 'absent':
        return <X className="h-4 w-4 text-error-600" />;
      case 'justified':
        return <ShieldCheck className="h-4 w-4 text-amber-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-success-100 text-success-800 border-success-200';
      case 'absent':
        return 'bg-error-100 text-error-800 border-error-200';
      case 'justified':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'present':
        return 'Presente';
      case 'absent':
        return 'Assente';
      case 'justified':
        return 'Giustificato';
      default:
        return status;
    }
  };

  // Get all weekend days in the current month (school days)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const schoolDays = allDaysInMonth.filter(date => isWeekend(date));

  // Calculate statistics for current month
  const currentMonthRecords = attendanceRecords.filter(record => 
    record.date >= monthStart && record.date <= monthEnd
  );
  
  const presentCount = currentMonthRecords.filter(r => r.status === 'present').length;
  const absentCount = currentMonthRecords.filter(r => r.status === 'absent').length;
  const justifiedCount = currentMonthRecords.filter(r => r.status === 'justified').length;
  const totalSchoolDays = schoolDays.length;
  const attendanceRate = totalSchoolDays > 0 ? Math.round((presentCount / totalSchoolDays) * 100) : 0;

  // Create calendar grid (6 weeks x 7 days)
  const calendarStart = startOfMonth(currentMonth);
  const firstDayOfWeek = calendarStart.getDay();
  const startDate = new Date(calendarStart);
  startDate.setDate(startDate.getDate() - (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1));

  const calendarDays = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    calendarDays.push(date);
  }

  if (!userProfile?.classId) {
    return (
      <PageContainer title="Le Mie Presenze">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">Non sei assegnato a nessuna classe.</p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Le Mie Presenze"
      description="Visualizza il tuo registro delle presenze"
    >
      {/* Month Navigation */}
      <Card variant="elevated" className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
              leftIcon={<ChevronLeft className="h-4 w-4" />}
            >
              Mese Precedente
            </Button>
            
            <h2 className="text-xl font-semibold text-gray-900">
              {format(currentMonth, 'MMMM yyyy', { locale: it })}
            </h2>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
              rightIcon={<ChevronRight className="h-4 w-4" />}
            >
              Mese Successivo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card variant="bordered">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-success-600">{presentCount}</div>
            <div className="text-sm text-gray-600">Presenze</div>
          </CardContent>
        </Card>
        
        <Card variant="bordered">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-error-600">{absentCount}</div>
            <div className="text-sm text-gray-600">Assenze</div>
          </CardContent>
        </Card>
        
        <Card variant="bordered">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{justifiedCount}</div>
            <div className="text-sm text-gray-600">Giustificate</div>
          </CardContent>
        </Card>
        
        <Card variant="bordered">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary-600">{attendanceRate}%</div>
            <div className="text-sm text-gray-600">Tasso di Presenza</div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar View */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Calendario Presenze
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Caricamento delle presenze...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Calendar Header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((date, index) => {
                  const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                  const isSchoolDay = isWeekend(date);
                  const attendance = getAttendanceForDate(date);
                  const isToday = isSameDay(date, new Date());
                  
                  return (
                    <div
                      key={index}
                      className={`
                        relative p-2 h-16 border border-gray-200 rounded-lg
                        ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'}
                        ${isToday ? 'ring-2 ring-primary-500' : ''}
                        ${isSchoolDay && isCurrentMonth ? 'bg-blue-50' : ''}
                      `}
                    >
                      <div className="text-sm font-medium">
                        {format(date, 'd')}
                      </div>
                      
                      {isSchoolDay && isCurrentMonth && (
                        <div className="absolute bottom-1 left-1 right-1">
                          {attendance ? (
                            <div className={`
                              flex items-center justify-center rounded-full text-xs font-medium border
                              ${getStatusColor(attendance.status)}
                            `}>
                              {getStatusIcon(attendance.status)}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center rounded-full text-xs bg-gray-200 text-gray-600 border border-gray-300">
                              ?
                            </div>
                          )}
                        </div>
                      )}
                      
                      {!isSchoolDay && isCurrentMonth && (
                        <div className="absolute bottom-1 left-1 right-1 text-center text-xs text-gray-400">
                          -
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-gray-200">
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-success-100 border border-success-200 mr-2 flex items-center justify-center">
                    <Check className="h-3 w-3 text-success-600" />
                  </div>
                  <span className="text-sm text-gray-600">Presente</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-error-100 border border-error-200 mr-2 flex items-center justify-center">
                    <X className="h-3 w-3 text-error-600" />
                  </div>
                  <span className="text-sm text-gray-600">Assente</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-amber-100 border border-amber-200 mr-2 flex items-center justify-center">
                    <ShieldCheck className="h-3 w-3 text-amber-600" />
                  </div>
                  <span className="text-sm text-gray-600">Giustificato</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-blue-50 border border-blue-200 mr-2"></div>
                  <span className="text-sm text-gray-600">Giorno di scuola</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-gray-200 border border-gray-300 mr-2 flex items-center justify-center">
                    <span className="text-xs text-gray-600">?</span>
                  </div>
                  <span className="text-sm text-gray-600">Non registrato</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Records */}
      {currentMonthRecords.length > 0 && (
        <Card variant="elevated" className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Dettagli Presenze - {format(currentMonth, 'MMMM yyyy', { locale: it })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentMonthRecords
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .map(record => (
                <div key={record.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">
                      {format(record.date, 'EEEE d MMMM yyyy', { locale: it })}
                    </div>
                    {record.notes && (
                      <div className="text-sm text-gray-500 mt-1">
                        Note: {record.notes}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(record.status)}`}>
                      {getStatusIcon(record.status)}
                      <span className="ml-1">{getStatusText(record.status)}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
};