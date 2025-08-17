import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  Star, 
  TrendingUp, 
  BarChart3, 
  Award,
  Target,
  Calendar,
  BookOpen,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Homework, HomeworkSubmission } from '../../types';

interface GradeStats {
  average: number;
  highest: number;
  lowest: number;
  total: number;
  trend: 'up' | 'down' | 'stable';
}

export const GradeTracker: React.FC = () => {
  const { userProfile } = useAuth();
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [homework, setHomework] = useState<Record<string, Homework>>({});
  const [gradeStats, setGradeStats] = useState<GradeStats>({
    average: 0,
    highest: 0,
    lowest: 0,
    total: 0,
    trend: 'stable'
  });
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGradeData = async () => {
      if (!userProfile || userProfile.role !== 'student') return;
      
      setIsLoading(true);
      try {
        // Fetch student's graded submissions
        const submissionsQuery = query(
          collection(db, 'homeworkSubmissions'),
          where('studentId', '==', userProfile.id),
          where('status', '==', 'graded'),
          orderBy('gradedAt', 'desc')
        );
        const submissionsDocs = await getDocs(submissionsQuery);
        const gradedSubmissions = submissionsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            submittedAt: data.submittedAt?.toDate() || new Date(),
            gradedAt: data.gradedAt?.toDate() || new Date()
          } as HomeworkSubmission;
        });
        setSubmissions(gradedSubmissions);

        // Fetch homework details
        if (gradedSubmissions.length > 0) {
          const homeworkIds = [...new Set(gradedSubmissions.map(sub => sub.homeworkId))];
          const homeworkPromises = homeworkIds.map(async (id) => {
            const homeworkQuery = query(collection(db, 'homework'), where('__name__', '==', id));
            const homeworkDocs = await getDocs(homeworkQuery);
            if (!homeworkDocs.empty) {
              const data = homeworkDocs.docs[0].data();
              return {
                ...data,
                id: homeworkDocs.docs[0].id,
                dueDate: data.dueDate?.toDate() || null
              } as Homework;
            }
            return null;
          });

          const homeworkResults = await Promise.all(homeworkPromises);
          const homeworkMap: Record<string, Homework> = {};
          homeworkResults.forEach(hw => {
            if (hw) {
              homeworkMap[hw.id] = hw;
            }
          });
          setHomework(homeworkMap);
        }

        // Calculate statistics
        if (gradedSubmissions.length > 0) {
          const grades = gradedSubmissions.map(sub => sub.grade!).filter(grade => grade !== undefined);
          const average = grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
          const highest = Math.max(...grades);
          const lowest = Math.min(...grades);

          // Calculate trend (compare last 3 grades with previous 3)
          let trend: 'up' | 'down' | 'stable' = 'stable';
          if (grades.length >= 6) {
            const recent = grades.slice(0, 3);
            const previous = grades.slice(3, 6);
            const recentAvg = recent.reduce((sum, grade) => sum + grade, 0) / recent.length;
            const previousAvg = previous.reduce((sum, grade) => sum + grade, 0) / previous.length;
            
            if (recentAvg > previousAvg + 0.5) trend = 'up';
            else if (recentAvg < previousAvg - 0.5) trend = 'down';
          }

          setGradeStats({
            average: Math.round(average * 10) / 10,
            highest,
            lowest,
            total: grades.length,
            trend
          });
        }

      } catch (error) {
        console.error('Error fetching grade data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGradeData();
  }, [userProfile]);

  const formatDate = (date: Date): string => {
    return format(date, 'd MMMM yyyy', { locale: it });
  };

  const getGradeColor = (grade: number): string => {
    if (grade >= 8) return 'text-success-600';
    if (grade >= 6) return 'text-amber-600';
    return 'text-error-600';
  };

  const getGradeBgColor = (grade: number): string => {
    if (grade >= 8) return 'bg-success-100';
    if (grade >= 6) return 'bg-amber-100';
    return 'bg-error-100';
  };

  const getTrendIcon = () => {
    switch (gradeStats.trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-success-600" />;
      case 'down':
        return <TrendingUp className="h-4 w-4 text-error-600 transform rotate-180" />;
      default:
        return <BarChart3 className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendText = () => {
    switch (gradeStats.trend) {
      case 'up':
        return 'In miglioramento';
      case 'down':
        return 'In calo';
      default:
        return 'Stabile';
    }
  };

  if (!userProfile || userProfile.role !== 'student') {
    return (
      <PageContainer title="Accesso non autorizzato">
        <p>Non hai i permessi per accedere a questa pagina.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Le Mie Valutazioni"
      description="Monitora i tuoi progressi e le tue valutazioni"
    >
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Caricamento valutazioni...</p>
        </div>
      ) : (
        <>
          {/* Grade Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card variant="elevated" className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center">
                  <Star className="h-6 w-6 text-primary-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {gradeStats.average > 0 ? gradeStats.average : '--'}
                </div>
                <div className="text-sm text-gray-600">Media Generale</div>
              </CardContent>
            </Card>

            <Card variant="elevated" className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-success-100 flex items-center justify-center">
                  <Award className="h-6 w-6 text-success-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {gradeStats.highest > 0 ? gradeStats.highest : '--'}
                </div>
                <div className="text-sm text-gray-600">Voto Più Alto</div>
              </CardContent>
            </Card>

            <Card variant="elevated" className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-secondary-100 flex items-center justify-center">
                  <Target className="h-6 w-6 text-secondary-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {gradeStats.lowest > 0 ? gradeStats.lowest : '--'}
                </div>
                <div className="text-sm text-gray-600">Voto Più Basso</div>
              </CardContent>
            </Card>

            <Card variant="elevated" className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent-100 flex items-center justify-center">
                  {getTrendIcon()}
                </div>
                <div className="text-2xl font-bold text-gray-900">{gradeStats.total}</div>
                <div className="text-sm text-gray-600">Valutazioni Totali</div>
                <div className="text-xs text-gray-500 mt-1">{getTrendText()}</div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Overview */}
          {gradeStats.total > 0 && (
            <Card variant="elevated" className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-primary-600" />
                  Panoramica Prestazioni
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-success-600 mb-2">
                      {submissions.filter(sub => sub.grade! >= 8).length}
                    </div>
                    <div className="text-sm text-gray-600">Eccellenti (8-10)</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-success-600 h-2 rounded-full" 
                        style={{ width: `${(submissions.filter(sub => sub.grade! >= 8).length / gradeStats.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-600 mb-2">
                      {submissions.filter(sub => sub.grade! >= 6 && sub.grade! < 8).length}
                    </div>
                    <div className="text-sm text-gray-600">Buoni (6-7.9)</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-amber-600 h-2 rounded-full" 
                        style={{ width: `${(submissions.filter(sub => sub.grade! >= 6 && sub.grade! < 8).length / gradeStats.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-3xl font-bold text-error-600 mb-2">
                      {submissions.filter(sub => sub.grade! < 6).length}
                    </div>
                    <div className="text-sm text-gray-600">Da Migliorare (&lt;6)</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-error-600 h-2 rounded-full" 
                        style={{ width: `${(submissions.filter(sub => sub.grade! < 6).length / gradeStats.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Grades */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="h-5 w-5 mr-2 text-secondary-600" />
                Storico Valutazioni ({submissions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submissions.length > 0 ? (
                <div className="space-y-4">
                  {submissions.map((submission) => {
                    const homeworkData = homework[submission.homeworkId];
                    const isExpanded = expandedSubmission === submission.id;
                    
                    return (
                      <div key={submission.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div 
                          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedSubmission(isExpanded ? null : submission.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">
                                {homeworkData?.title || 'Compito non trovato'}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {homeworkData?.className} • Valutato il {formatDate(submission.gradedAt!)}
                              </p>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className={`flex items-center px-3 py-2 rounded-full ${getGradeBgColor(submission.grade!)}`}>
                                <Star className={`h-4 w-4 mr-1 ${getGradeColor(submission.grade!)}`} />
                                <span className={`font-bold ${getGradeColor(submission.grade!)}`}>
                                  {submission.grade}/10
                                </span>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-gray-200 p-4 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h5 className="font-medium text-gray-900 mb-2">Dettagli Compito</h5>
                                <p className="text-sm text-gray-600 mb-2">
                                  <strong>Descrizione:</strong> {homeworkData?.description || 'Non disponibile'}
                                </p>
                                <p className="text-sm text-gray-600 mb-2">
                                  <strong>Scadenza:</strong> {homeworkData?.dueDate ? formatDate(homeworkData.dueDate) : 'Non disponibile'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  <strong>Consegnato il:</strong> {formatDate(submission.submittedAt)}
                                </p>
                              </div>
                              
                              {submission.feedback && (
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-2">Feedback dell'Insegnante</h5>
                                  <div className="p-3 bg-blue-50 rounded-lg">
                                    <p className="text-sm text-blue-900">{submission.feedback}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Star className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="mt-2 text-gray-600">Caricamento delle valutazioni...</p>
                  <p className="text-gray-500">
                    Non hai ancora ricevuto valutazioni. Continua a consegnare i compiti per vedere i tuoi progressi!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  );
};