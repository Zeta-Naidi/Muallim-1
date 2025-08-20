import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Plus, 
  Edit, 
  Trash2, 
  MapPin, 
  Clock, 
  Users, 
  Search,
  Filter,
  X,
  Save,
  AlertCircle
} from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  maxParticipants?: number;
  currentParticipants: number;
  category: 'academic' | 'social' | 'cultural' | 'sports' | 'other';
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  createdAt: string;
  createdBy: string;
}

interface EventFormData {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  maxParticipants: string;
  category: Event['category'];
}

const INITIAL_FORM_DATA: EventFormData = {
  title: '',
  description: '',
  date: '',
  time: '',
  location: '',
  maxParticipants: '',
  category: 'academic'
};

const CATEGORY_OPTIONS = [
  { value: 'academic', label: 'Accademico', color: 'bg-blue-100 text-blue-800' },
  { value: 'social', label: 'Sociale', color: 'bg-green-100 text-green-800' },
  { value: 'cultural', label: 'Culturale', color: 'bg-purple-100 text-purple-800' },
  { value: 'sports', label: 'Sport', color: 'bg-orange-100 text-orange-800' },
  { value: 'other', label: 'Altro', color: 'bg-gray-100 text-gray-800' }
];

const STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Prossimo', color: 'bg-blue-100 text-blue-800' },
  { value: 'ongoing', label: 'In corso', color: 'bg-green-100 text-green-800' },
  { value: 'completed', label: 'Completato', color: 'bg-gray-100 text-gray-800' },
  { value: 'cancelled', label: 'Annullato', color: 'bg-red-100 text-red-800' }
];

export const ManageEvents: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<EventFormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // Fetch events
  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const eventsQuery = query(
        collection(db, 'events'),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(eventsQuery);
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Event[];
      
      setEvents(eventsData);
      setFilteredEvents(eventsData);
    } catch (error) {
      console.error('Error fetching events:', error);
      setError('Errore nel caricamento degli eventi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Filter events
  useEffect(() => {
    let filtered = events;

    if (searchQuery) {
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.location.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(event => event.category === selectedCategory);
    }

    if (selectedStatus) {
      filtered = filtered.filter(event => event.status === selectedStatus);
    }

    setFilteredEvents(filtered);
  }, [events, searchQuery, selectedCategory, selectedStatus]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.time) {
      setError('Compila tutti i campi obbligatori');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const eventData = {
        title: formData.title,
        description: formData.description,
        date: formData.date,
        time: formData.time,
        location: formData.location,
        maxParticipants: formData.maxParticipants ? parseInt(formData.maxParticipants) : undefined,
        category: formData.category,
        currentParticipants: 0,
        status: 'upcoming' as const,
        createdAt: new Date().toISOString(),
        createdBy: 'admin' // Replace with actual user ID
      };

      if (editingEvent) {
        await updateDoc(doc(db, 'events', editingEvent.id), eventData);
      } else {
        await addDoc(collection(db, 'events'), eventData);
      }

      await fetchEvents();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving event:', error);
      setError('Errore nel salvare l\'evento');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete event
  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo evento?')) return;

    try {
      await deleteDoc(doc(db, 'events', eventId));
      await fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      setError('Errore nell\'eliminazione dell\'evento');
    }
  };

  // Dialog handlers
  const handleOpenCreateDialog = () => {
    setFormData(INITIAL_FORM_DATA);
    setEditingEvent(null);
    setError('');
    setIsCreateDialogOpen(true);
  };

  const handleOpenEditDialog = (event: Event) => {
    setFormData({
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      location: event.location,
      maxParticipants: event.maxParticipants?.toString() || '',
      category: event.category
    });
    setEditingEvent(event);
    setError('');
    setIsEditDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    setIsEditDialogOpen(false);
    setEditingEvent(null);
    setFormData(INITIAL_FORM_DATA);
    setError('');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedStatus('');
  };

  const getCategoryInfo = (category: Event['category']) => {
    return CATEGORY_OPTIONS.find(opt => opt.value === category) || CATEGORY_OPTIONS[0];
  };

  const getStatusInfo = (status: Event['status']) => {
    return STATUS_OPTIONS.find(opt => opt.value === status) || STATUS_OPTIONS[0];
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-3 px-6 py-3 bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20"
          >
            <Calendar className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Gestione Eventi
            </h1>
          </motion.div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Crea e gestisci eventi per studenti e docenti
          </p>
        </div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl p-6"
        >
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  type="text"
                  placeholder="Cerca eventi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white"
              >
                <option value="">Tutte le categorie</option>
                {CATEGORY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white"
              >
                <option value="">Tutti gli stati</option>
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* Clear Filters */}
              {(searchQuery || selectedCategory || selectedStatus) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="rounded-xl"
                  leftIcon={<X className="h-4 w-4" />}
                >
                  Pulisci
                </Button>
              )}
            </div>

            {/* Create Event Button */}
            <Button
              onClick={handleOpenCreateDialog}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
              leftIcon={<Plus className="h-5 w-5" />}
            >
              Nuovo Evento
            </Button>
          </div>
        </motion.div>

        {/* Events List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Caricamento eventi...</p>
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full bg-white/80 backdrop-blur-md border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl overflow-hidden">
                  <div className="p-6 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getCategoryInfo(event.category).color}`}>
                            {getCategoryInfo(event.category).label}
                          </span>
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusInfo(event.status).color}`}>
                            {getStatusInfo(event.status).label}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                          {event.title}
                        </h3>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditDialog(event)}
                          className="rounded-xl text-blue-600 hover:bg-blue-50"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteEvent(event.id)}
                          className="rounded-xl text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Description */}
                    {event.description && (
                      <p className="text-gray-600 text-sm line-clamp-3">
                        {event.description}
                      </p>
                    )}

                    {/* Event Details */}
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        <span>{formatDate(event.date)} alle {event.time}</span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-green-500" />
                          <span>{event.location}</span>
                        </div>
                      )}
                      {event.maxParticipants && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-purple-500" />
                          <span>{event.currentParticipants}/{event.maxParticipants} partecipanti</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              {searchQuery || selectedCategory || selectedStatus ? 'Nessun evento trovato' : 'Nessun evento'}
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              {searchQuery || selectedCategory || selectedStatus 
                ? 'Nessun risultato per i filtri selezionati.'
                : 'Non ci sono ancora eventi nel sistema. Crea il primo evento!'}
            </p>
          </div>
        )}

        {/* Create/Edit Event Dialog */}
        <AnimatePresence>
          {(isCreateDialogOpen || isEditDialogOpen) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              onClick={handleCloseDialog}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {editingEvent ? 'Modifica Evento' : 'Nuovo Evento'}
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCloseDialog}
                      className="rounded-xl"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>

                  {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
                      <AlertCircle className="h-5 w-5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Titolo *
                      </label>
                      <Input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="rounded-xl"
                        placeholder="Inserisci il titolo dell'evento"
                        required
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Descrizione
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500 resize-none"
                        rows={3}
                        placeholder="Descrizione dell'evento"
                      />
                    </div>

                    {/* Date and Time */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Data *
                        </label>
                        <Input
                          type="date"
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          className="rounded-xl"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Ora *
                        </label>
                        <Input
                          type="time"
                          value={formData.time}
                          onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                          className="rounded-xl"
                          required
                        />
                      </div>
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Luogo
                      </label>
                      <Input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="rounded-xl"
                        placeholder="Luogo dell'evento"
                      />
                    </div>

                    {/* Category and Max Participants */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Categoria
                        </label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value as Event['category'] })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500"
                        >
                          {CATEGORY_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Partecipanti
                        </label>
                        <Input
                          type="number"
                          value={formData.maxParticipants}
                          onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
                          className="rounded-xl"
                          placeholder="Illimitato"
                          min="1"
                        />
                      </div>
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleCloseDialog}
                        className="flex-1 rounded-xl"
                      >
                        Annulla
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        leftIcon={isSubmitting ? undefined : <Save className="h-4 w-4" />}
                      >
                        {isSubmitting ? 'Salvando...' : (editingEvent ? 'Aggiorna' : 'Crea Evento')}
                      </Button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
