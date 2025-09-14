import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Users, 
  Calendar, 
  Filter, 
  Download,
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Clock,
  User,
  Shield,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { actionLogger, ActionLog, ActionType } from '../../services/actionLogger';
import { Timestamp } from 'firebase/firestore';

export const ActionLogs: React.FC = () => {
  const { userProfile } = useAuth();
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<ActionType | ''>('');
  const [selectedUser, setSelectedUser] = useState('');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [statsGroupBy, setStatsGroupBy] = useState<'user' | 'action' | 'day'>('action');
  const [showFilters, setShowFilters] = useState(false);

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [selectedAction, selectedUser, dateRange]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const options: any = {
        limitCount: 100
      };

      if (selectedAction) options.action = selectedAction;
      if (selectedUser) options.userId = selectedUser;
      if (dateRange.start) options.startDate = new Date(dateRange.start);
      if (dateRange.end) options.endDate = new Date(dateRange.end);

      const fetchedLogs = await actionLogger.getActionLogs(options);
      setLogs(fetchedLogs);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const options: any = {
        groupBy: statsGroupBy
      };

      if (dateRange.start) options.startDate = new Date(dateRange.start);
      if (dateRange.end) options.endDate = new Date(dateRange.end);

      const fetchedStats = await actionLogger.getActionStats(options);
      setStats(fetchedStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.userEmail.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.targetName?.toLowerCase().includes(query) ||
        log.targetType?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatTimestamp = (timestamp: Timestamp | Date) => {
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('it-IT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const getActionIcon = (action: string) => {
    if (action.includes('user')) return <Users className="h-4 w-4" />;
    if (action.includes('student')) return <User className="h-4 w-4" />;
    if (action.includes('login') || action.includes('logout')) return <Shield className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('created')) return 'text-green-600 bg-green-50';
    if (action.includes('updated')) return 'text-blue-600 bg-blue-50';
    if (action.includes('deleted')) return 'text-red-600 bg-red-50';
    if (action.includes('approved')) return 'text-emerald-600 bg-emerald-50';
    if (action.includes('rejected')) return 'text-orange-600 bg-orange-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'user_created': 'Utente Creato',
      'user_updated': 'Utente Modificato',
      'user_deleted': 'Utente Eliminato',
      'user_approved': 'Utente Approvato',
      'user_rejected': 'Utente Rifiutato',
      'user_role_changed': 'Ruolo Cambiato',
      'student_created': 'Studente Creato',
      'student_updated': 'Studente Modificato',
      'student_deleted': 'Studente Eliminato',
      'login': 'Accesso',
      'logout': 'Disconnessione',
      'password_reset': 'Reset Password'
    };
    return labels[action] || action.replace('_', ' ').toUpperCase();
  };

  const exportLogs = () => {
    const csvContent = [
      ['Data/Ora', 'Utente', 'Ruolo', 'Azione', 'Target', 'Dettagli'].join(','),
      ...filteredLogs.map(log => [
        formatTimestamp(log.timestamp),
        log.userEmail,
        log.userRole,
        getActionLabel(log.action),
        log.targetName || log.targetType || '',
        JSON.stringify(log.details || {})
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `action-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (userProfile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex items-center justify-center">
        <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl p-8">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h2>
            <p className="text-gray-600">Solo gli amministratori possono visualizzare i log delle azioni.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-white/5" />
        
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-6">
                <Activity className="h-8 w-8" />
              </div>
              <h1 className="text-4xl font-bold mb-4">Log delle Azioni</h1>
              <p className="text-xl text-blue-100 max-w-2xl mx-auto">
                Monitora tutte le attività degli utenti sulla piattaforma
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Azioni Totali</p>
                  <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Utenti Attivi</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {new Set(logs.map(log => log.userId)).size}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Oggi</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {logs.filter(log => {
                      const logDate = log.timestamp instanceof Timestamp 
                        ? log.timestamp.toDate() 
                        : new Date(log.timestamp);
                      const today = new Date();
                      return logDate.toDateString() === today.toDateString();
                    }).length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-gray-900">
                <Filter className="h-5 w-5 mr-2" />
                Filtri
              </CardTitle>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="text-sm"
              >
                {showFilters ? 'Nascondi' : 'Mostra'} Filtri
              </Button>
            </div>
          </CardHeader>
          
          {showFilters && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cerca
                  </label>
                  <Input
                    placeholder="Email, azione, target..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="h-4 w-4" />}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Azione
                  </label>
                  <select
                    className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-2 px-3"
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value as ActionType)}
                  >
                    <option value="">Tutte le azioni</option>
                    <option value="user_created">Utente Creato</option>
                    <option value="user_updated">Utente Modificato</option>
                    <option value="user_deleted">Utente Eliminato</option>
                    <option value="user_approved">Utente Approvato</option>
                    <option value="user_rejected">Utente Rifiutato</option>
                    <option value="login">Accesso</option>
                    <option value="logout">Disconnessione</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Inizio
                  </label>
                  <input
                    type="date"
                    className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-2 px-3"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Fine
                  </label>
                  <input
                    type="date"
                    className="block w-full rounded-xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white py-2 px-3"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end mt-4 gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedAction('');
                    setSelectedUser('');
                    setDateRange({ start: '', end: '' });
                  }}
                >
                  Pulisci Filtri
                </Button>
                <Button onClick={exportLogs} leftIcon={<Download className="h-4 w-4" />}>
                  Esporta CSV
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Logs Table */}
        <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900">
              <Activity className="h-5 w-5 mr-2" />
              Log delle Azioni ({filteredLogs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Caricamento log...</p>
              </div>
            ) : paginatedLogs.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                          Data/Ora
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                          Utente
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                          Azione
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                          Target
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                          Dettagli
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginatedLogs.map((log) => (
                        <motion.tr
                          key={log.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-blue-50/30 transition-colors"
                        >
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatTimestamp(log.timestamp)}
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {log.userEmail}
                              </div>
                              <div className="text-xs text-gray-500">
                                {log.userRole}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                              {getActionIcon(log.action)}
                              <span className="ml-1">{getActionLabel(log.action)}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {log.targetName || log.targetType || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {log.details && Object.keys(log.details).length > 0 ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                leftIcon={<Eye className="h-3 w-3" />}
                                onClick={() => {
                                  alert(JSON.stringify(log.details, null, 2));
                                }}
                              >
                                Visualizza
                              </Button>
                            ) : (
                              '-'
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      leftIcon={<ChevronLeft className="h-4 w-4" />}
                    >
                      Precedente
                    </Button>
                    
                    <span className="text-sm text-gray-600">
                      Pagina {currentPage} di {totalPages}
                    </span>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      rightIcon={<ChevronRight className="h-4 w-4" />}
                    >
                      Successiva
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Activity className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  Nessun log trovato
                </h3>
                <p className="text-gray-600">
                  Non ci sono azioni registrate con i filtri selezionati.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
