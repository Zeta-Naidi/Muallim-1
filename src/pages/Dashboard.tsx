import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit, addDoc } from 'firebase/firestore';
import { Euro, UserCheck, Users, School, CreditCard, User as UserIcon, CalendarDays, ClipboardList, BookOpenText, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Map as MapboxMap, Marker, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { PageContainer } from '../components/layout/PageContainer';
import { ProfessionalDataTable } from '../components/ui/ProfessionalDataTable';
import { getCityCoordinatesWithFallback, Coordinates } from '../services/geocoding';
import { Homework, Lesson, Class, User, Attendance } from '../types';

// Event interface
interface Event {
  id: string;
  title: string;
  description: string;
  date: Date;
  time: string;
  location: string;
  maxParticipants: number;
  category: string;
  status: 'active' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: Date;
}

// EventsList Component
const EventsList: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsQuery = query(
          collection(db, 'events'),
          orderBy('date', 'desc'),
          limit(5)
        );
        const eventsDocs = await getDocs(eventsQuery);
        const fetchedEvents = eventsDocs.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            date: data.date?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
          } as Event;
        });
        setEvents(fetchedEvents);
      } catch (error) {
        console.error('Error fetching events:', error);
        // Set empty events array if collection doesn't exist or no permissions
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (isLoading) {
    return <div className="text-center py-4">Caricamento eventi...</div>;
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>Nessun evento trovato</p>
        <p className="text-sm">Clicca "Crea Evento" per aggiungere il primo evento</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div key={event.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">{event.title}</h4>
              <p className="text-sm text-gray-600 mt-1">{event.description}</p>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500">
                <span>📅 {format(event.date, 'd MMMM yyyy', { locale: it })}</span>
                <span>🕐 {event.time}</span>
                <span>📍 {event.location}</span>
              </div>
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              event.status === 'active' ? 'bg-green-100 text-green-800' :
              event.status === 'completed' ? 'bg-blue-100 text-blue-800' :
              'bg-red-100 text-red-800'
            }`}>
              {event.status === 'active' ? 'Attivo' : 
               event.status === 'completed' ? 'Completato' : 'Annullato'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// CreateEventForm Component
interface CreateEventFormProps {
  onClose: () => void;
}

const CreateEventForm: React.FC<CreateEventFormProps> = ({ onClose }) => {
  const { userProfile } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    maxParticipants: 50,
    category: 'generale'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    setIsSubmitting(true);
    try {
      // Now we can create real events since Firestore rules are updated
      const eventData = {
        title: formData.title,
        description: formData.description,
        date: new Date(formData.date + 'T' + formData.time),
        time: formData.time,
        location: formData.location,
        maxParticipants: formData.maxParticipants,
        category: formData.category,
        status: 'active',
        createdBy: userProfile.id,
        createdAt: new Date()
      };

      await addDoc(collection(db, 'events'), eventData);
      console.log('Event would be created:', eventData);
      
      alert('Evento creato con successo!');
      onClose();
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Errore nella creazione dell\'evento. Riprova più tardi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Titolo</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          rows={3}
          required
        />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ora</label>
          <input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Luogo</label>
        <input
          type="text"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Max Partecipanti</label>
        <input
          type="number"
          value={formData.maxParticipants}
          onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          min="1"
          required
        />
      </div>
      
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Annulla
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Creazione...' : 'Crea Evento'}
        </button>
      </div>
    </form>
  );
};

// MapboxStudentMap Component
const MapboxStudentMap: React.FC = () => {
  const [studentsByCity, setStudentsByCity] = useState<{ [key: string]: User[] }>({});
  const [cityCoordinates, setCityCoordinates] = useState<{ [key: string]: Coordinates }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [viewState, setViewState] = useState({
    longitude: 12.4964,
    latitude: 41.9028,
    zoom: 5.5
  });

  useEffect(() => {
    const fetchStudentLocations = async () => {
      try {
        // Fetch only city field to minimize data transfer
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        const cityData: { [key: string]: number } = {};
        const studentsByCity: { [key: string]: User[] } = {};
        
        studentsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const city = data.city;
          if (city) {
            const cityKey = city.toLowerCase().trim();
            cityData[cityKey] = (cityData[cityKey] || 0) + 1;
            
            if (!studentsByCity[cityKey]) {
              studentsByCity[cityKey] = [];
            }
            studentsByCity[cityKey].push({
              id: doc.id,
              city: data.city,
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              displayName: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim()
            } as User);
          }
        });

        // Set students data immediately to show partial results
        setStudentsByCity(studentsByCity);
        
        const uniqueCities = Object.keys(cityData);

        // Fetch coordinates with aggressive optimization
        const coordinates: { [key: string]: Coordinates } = {};

        // Process all cities in parallel (no sequential batching)
        const allPromises = uniqueCities.map(async (city) => {
          const coords = await getCityCoordinatesWithFallback(city, 'Italy');
          if (coords) {
            return { city, coords };
          }
          return null;
        });

        // Wait for all coordinates with a race condition for faster UI updates
        const results = await Promise.allSettled(allPromises);
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            coordinates[result.value.city] = result.value.coords;
          }
        });

        // Single update with all coordinates
        setCityCoordinates(coordinates);

      } catch (error) {
        console.error('Error fetching student locations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudentLocations();
  }, []);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-gray-600">Caricamento distribuzione studenti...</p>
      </div>
    );
  }

  // Use a public Mapbox token or fallback to simple visualization
  const MAPBOX_TOKEN = 'pk.eyJ1IjoiaGFtemEwOCIsImEiOiJja2kwMjhieWcwcHZsMnVvYW03cXJiZG11In0.5l8xGTkypU7DZMUfee4cXA'; // Replace with actual token

  return (
    <div className="space-y-4">
      <div className="h-64 sm:h-80 lg:h-[400px] rounded-lg overflow-hidden border-2 border-blue-100">
        {MAPBOX_TOKEN && MAPBOX_TOKEN.startsWith('pk.') && !MAPBOX_TOKEN.includes('example') ? (
          <MapboxMap
            {...viewState}
            onMove={(evt: any) => setViewState(evt.viewState)}
            style={{width: '100%', height: '100%'}}
            mapStyle="mapbox://styles/mapbox/light-v11"
            mapboxAccessToken={MAPBOX_TOKEN}
          >
            {Object.entries(studentsByCity).map(([city, students]) => {
              const coords = cityCoordinates[city];
              if (!coords) return null;
              
              return (
                <Marker
                  key={city}
                  longitude={coords.lng}
                  latitude={coords.lat}
                  onClick={() => setSelectedCity(selectedCity === city ? null : city)}
                >
                  <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold cursor-pointer hover:bg-blue-600 transition-colors">
                    {students.length}
                  </div>
                </Marker>
              );
            })}
            
            {selectedCity && cityCoordinates[selectedCity] && (
              <Popup
                longitude={cityCoordinates[selectedCity].lng}
                latitude={cityCoordinates[selectedCity].lat}
                onClose={() => setSelectedCity(null)}
                closeButton={true}
                closeOnClick={false}
              >
                <div className="p-2">
                  <h3 className="font-semibold capitalize">{selectedCity}</h3>
                  <p className="text-sm text-gray-600">
                    {studentsByCity[selectedCity].length} studenti
                  </p>
                </div>
              </Popup>
            )}
          </MapboxMap>
        ) : (
          // Fallback to simple visualization if no Mapbox token
          <div className="relative bg-gradient-to-br from-blue-50 to-green-50 h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">🇮🇹</div>
              <div className="text-lg font-semibold text-gray-700 mb-4">Italia</div>
              <div className="text-sm text-gray-500 mb-4">
                Configura il token Mapbox per visualizzare la mappa interattiva
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm max-w-md">
                {Object.entries(studentsByCity).map(([city, students]) => (
                  <div key={city} className="flex items-center justify-between bg-white/80 rounded px-3 py-2 shadow-sm">
                    <span className="capitalize font-medium">{city}</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                      {students.length}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface PaymentRecord {
  id: string;
  parentContact: string;
  parentName: string;
  amount: number;
  date: Date;
  notes: string;
  createdBy: string;
  createdAt: Date;
}

interface ParentGroup {
  parentContact: string;
  parentName: string;
  children: User[];
  totalAmount: number;
  paidAmount: number;
  isExempted: boolean;
}

export const Dashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [recentHomework, setRecentHomework] = useState<Homework[]>([]);
  const [recentLessons, setRecentLessons] = useState<Lesson[]>([]);
  const [userClass, setUserClass] = useState<Class | null>(null);
  
  // Admin statistics
  const [paymentStats, setPaymentStats] = useState({
    totalFamilies: 0,
    paidFamilies: 0,
    totalRevenue: 0,
    pendingAmount: 0,
    exemptedFamilies: 0
  });
  const [attendanceStats, setAttendanceStats] = useState({
    totalClasses: 0,
    recentAttendanceRate: 0,
    totalStudents: 0,
    presentRecords: 0
  });
  
  // Event creation modal state
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!userProfile) return;
      
      try {
        if (userProfile.role === 'admin') {
          await fetchAdminStats();
        } else {
          await fetchUserData();
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };
    
    fetchDashboardData();
  }, [userProfile]);

  const fetchAdminStats = async () => {
    try {
      // Fetch enrolled students from students collection
      const studentsQuery = query(
        collection(db, 'students'),
        where('isEnrolled', '==', true)
      );
      const studentsDocs = await getDocs(studentsQuery);
      const students = studentsDocs.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
      // Students data fetched for statistics calculation

      // Calculate payment statistics
      const paymentRecordsQuery = query(collection(db, 'paymentRecords'), orderBy('date', 'desc'));
      const paymentsDocs = await getDocs(paymentRecordsQuery);
      const paymentRecords = paymentsDocs.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          date: data.date?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
        } as PaymentRecord;
      });

      // Group students by parent contact
      const parentGroupsMap = new Map<string, ParentGroup>();
      students.forEach(student => {
        const parentContact = student.parentContact?.trim();
        const parentName = student.parentName?.trim() || 'Nome non specificato';
        
        if (!parentContact) return;
        
        if (!parentGroupsMap.has(parentContact)) {
          parentGroupsMap.set(parentContact, {
            parentContact,
            parentName,
            children: [],
            totalAmount: 0,
            paidAmount: 0,
            isExempted: false,
          });
        }
        
        const group = parentGroupsMap.get(parentContact)!;
        group.children.push(student);
        
        if (student.paymentExempted) {
          group.isExempted = true;
        }
      });

      // Calculate payment stats
      const parentGroups = Array.from(parentGroupsMap.values());
      let totalRevenue = 0;
      let pendingAmount = 0;
      let paidFamilies = 0;
      let exemptedFamilies = 0;

      parentGroups.forEach(group => {
        const childrenCount = group.children.length;
        const totalAmount = group.isExempted ? 0 : getPricing(childrenCount);
        const paidAmount = paymentRecords
          .filter(payment => payment.parentContact === group.parentContact)
          .reduce((sum, payment) => sum + payment.amount, 0);

        group.totalAmount = totalAmount;
        group.paidAmount = paidAmount;

        if (group.isExempted) {
          exemptedFamilies++;
        } else {
          totalRevenue += paidAmount;
          pendingAmount += Math.max(0, totalAmount - paidAmount);
          if (paidAmount >= totalAmount) {
            paidFamilies++;
          }
        }
      });

      setPaymentStats({
        totalFamilies: parentGroups.length,
        paidFamilies,
        totalRevenue,
        pendingAmount,
        exemptedFamilies
      });

      // Calculate attendance statistics
      const classesQuery = query(collection(db, 'classes'));
      const classesDocs = await getDocs(classesQuery);
      const totalClasses = classesDocs.docs.length;

      // Get attendance data from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('date', '>=', thirtyDaysAgo),
        orderBy('date', 'desc')
      );
      const attendanceDocs = await getDocs(attendanceQuery);
      const attendanceRecords = attendanceDocs.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          date: data.date?.toDate() || new Date()
        } as Attendance;
      });

      // Calculate attendance rate from real data
      const presentCount = attendanceRecords.filter(record => record.status === 'present').length;
      const totalRecords = attendanceRecords.length;
      const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

      setAttendanceStats({
        totalClasses,
        recentAttendanceRate: attendanceRate,
        totalStudents: students.length,
        presentRecords: presentCount
      });

    } catch (error) {
      console.error('Error fetching admin stats:', error);
    }
  };

  const fetchUserData = async () => {
    // Ensure userProfile is defined for TS safety
    if (!userProfile) return;

    if (userProfile.classId) {
      const classDoc = await getDocs(query(
        collection(db, 'classes'),
        where('id', '==', userProfile.classId),
        limit(1)
      ));
      
      if (!classDoc.empty) {
        setUserClass(classDoc.docs[0].data() as Class);
      }
    }
    
    let homeworkQuery;
    if (userProfile.role === 'student' && userProfile.classId) {
      homeworkQuery = query(
        collection(db, 'homework'),
        where('classId', '==', userProfile.classId),
        orderBy('dueDate', 'desc'),
        limit(3)
      );
    } else if (userProfile.role === 'teacher') {
      homeworkQuery = query(
        collection(db, 'homework'),
        where('createdBy', '==', userProfile.id),
        orderBy('dueDate', 'desc'),
        limit(3)
      );
    }
    
    if (homeworkQuery) {
      const homeworkDocs = await getDocs(homeworkQuery);
      const fetchedHomework = homeworkDocs.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          dueDate: data.dueDate?.toDate() || null
        } as Homework;
      });
      setRecentHomework(fetchedHomework);
    }
    
    let lessonQuery;
    if (userProfile.role === 'student' && userProfile.classId) {
      lessonQuery = query(
        collection(db, 'lessons'),
        where('classId', '==', userProfile.classId),
        orderBy('date', 'desc'),
        limit(3)
      );
    } else if (userProfile.role === 'teacher') {
      lessonQuery = query(
        collection(db, 'lessons'),
        where('createdBy', '==', userProfile.id),
        orderBy('date', 'desc'),
        limit(3)
      );
    }
    
    if (lessonQuery) {
      const lessonDocs = await getDocs(lessonQuery);
      const fetchedLessons = lessonDocs.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          date: data.date?.toDate() || null
        } as Lesson;
      });
      setRecentLessons(fetchedLessons);
    }
  };

  const getPricing = (childrenCount: number): number => {
    switch (childrenCount) {
      case 1: return 120;
      case 2: return 220;
      case 3: return 300;
      case 4: return 360;
      default: return 360;
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date || isNaN(date.getTime())) {
      return 'Data non valida';
    }
    return format(date, 'd MMMM yyyy', { locale: it });
  };

  if (!userProfile) return null;

  return (
    <PageContainer
      title={`Benvenuto, ${userProfile.displayName}`}
      description={`${
        userProfile.role === 'admin' ? 'Amministratore' : 
        userProfile.role === 'teacher' ? 'Insegnante' : 'Studente'
      }${userClass ? ` - ${userClass.name}` : ''}`}
    >
      {userProfile.role === 'admin' ? (
        // Redesigned Admin Dashboard (vibrant theme)
        <>
          {/* Key Metrics Overview (custom cards) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-indigo-50" />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <School className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-indigo-700">Classi Attive</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{attendanceStats.totalClasses}</div>
                <div className="mt-1 text-sm text-slate-500">In corso</div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-50" />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-emerald-700">Studenti Iscritti</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{attendanceStats.totalStudents}</div>
                <div className="mt-1 text-sm text-slate-500">Totale</div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-50" />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-amber-700">Tasso Presenze</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{`${attendanceStats.recentAttendanceRate}%`}</div>
                <div className="mt-1 text-sm text-slate-500">Media mensile</div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-fuchsia-200 bg-white shadow-sm">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-fuchsia-50" />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center">
                    <Euro className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-fuchsia-700">Ricavi Totali</div>
                </div>
                <div className="mt-4 text-3xl font-bold text-slate-900">{`€${paymentStats.totalRevenue.toFixed(0)}`}</div>
                <div className="mt-1 text-sm text-slate-500">Incassati</div>
              </div>
            </div>
          </div>

          {/* Management Sections (colorful cards) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="rounded-2xl border border-sky-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-sky-50 to-indigo-50 border-b border-sky-100">
                <h3 className="text-slate-900 font-semibold">Gestione Didattica</h3>
                <p className="text-slate-500 text-sm">Strumenti per classi e studenti</p>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Link to="/admin/classes" className="group">
                  <div className="rounded-xl border border-sky-100 p-4 hover:bg-sky-50 transition-all">
                    <div className="h-10 w-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center mb-3">
                      <School className="w-5 h-5" />
                    </div>
                    <div className="font-medium text-slate-900">Gestione Classi</div>
                    <div className="text-sm text-slate-600">Visualizza e modifica classi</div>
                  </div>
                </Link>
                <Link to="/admin/students" className="group">
                  <div className="rounded-xl border border-emerald-100 p-4 hover:bg-emerald-50 transition-all">
                    <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="font-medium text-slate-900">Gestione Studenti</div>
                    <div className="text-sm text-slate-600">Amministra studenti iscritti</div>
                  </div>
                </Link>
                <div className="group cursor-pointer" onClick={() => setShowCreateEventModal(true)}>
                  <div className="rounded-xl border border-purple-100 p-4 hover:bg-purple-50 transition-all">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="font-medium text-slate-900">Crea Evento</div>
                    <div className="text-sm text-slate-600">Aggiungi nuovo evento</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-violet-50 to-fuchsia-50 border-b border-violet-100">
                <h3 className="text-slate-900 font-semibold">Amministrazione Sistema</h3>
                <p className="text-slate-500 text-sm">Utenti, docenti e pagamenti</p>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Link to="/admin/users" className="group">
                  <div className="rounded-xl border border-violet-100 p-4 hover:bg-violet-50 transition-all">
                    <div className="h-10 w-10 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center mb-3">
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <div className="font-medium text-slate-900">Gestione Utenti</div>
                    <div className="text-sm text-slate-600">Permessi e accessi</div>
                  </div>
                </Link>
                <Link to="/admin/teachers" className="group">
                  <div className="rounded-xl border border-indigo-100 p-4 hover:bg-indigo-50 transition-all">
                    <div className="h-10 w-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3">
                      <UserIcon className="w-5 h-5" />
                    </div>
                    <div className="font-medium text-slate-900">Gestione Insegnanti</div>
                    <div className="text-sm text-slate-600">Corpo docente</div>
                  </div>
                </Link>
                <Link to="/admin/payments" className="group">
                  <div className="rounded-xl border border-fuchsia-100 p-4 hover:bg-fuchsia-50 transition-all">
                    <div className="h-10 w-10 rounded-lg bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center mb-3">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="font-medium text-slate-900">Sistema Pagamenti</div>
                    <div className="text-sm text-slate-600">Monitoraggio e incassi</div>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Events and Map Sections - Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Events Section */}
            <div className="rounded-2xl border border-purple-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-slate-900 font-semibold">Eventi Recenti</h3>
                    <p className="text-slate-500 text-sm">Gestione eventi e attività</p>
                  </div>
                  <button
                    onClick={() => setShowCreateEventModal(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Crea Evento
                  </button>
                </div>
              </div>
              <div className="p-6">
                <EventsList />
              </div>
            </div>

            {/* Geographic Distribution Section */}
            <div className="rounded-2xl border border-orange-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
                <h3 className="text-slate-900 font-semibold">Distribuzione Geografica</h3>
                <p className="text-slate-500 text-sm">Mappa studenti per città</p>
              </div>
              <div className="p-6">
                <MapboxStudentMap />
              </div>
            </div>
          </div>
        </>
      ) : (
        // Student/Teacher Dashboard (original)
        <>
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {userProfile.role === 'teacher' && (
              <Link to="/attendance" className="block">
                <div className="bg-white border border-slate-200 rounded-lg p-6 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mr-4">
                      <CalendarDays className="w-6 h-6 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Presenze</h3>
                      <p className="text-sm text-slate-600">Gestisci presenze giornaliere</p>
                    </div>
                  </div>
                </div>
              </Link>
            )}
            
            <Link to="/homework" className="block">
              <div className="bg-white border border-slate-200 rounded-lg p-6 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mr-4">
                    <ClipboardList className="w-6 h-6 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">Compiti</h3>
                      {recentHomework.length > 0 && (
                        <span className="bg-slate-100 text-slate-700 text-xs font-medium px-2 py-1 rounded-full">
                          {recentHomework.length}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      {userProfile.role === 'student' ? 'Visualizza compiti assegnati' : 'Gestisci compiti studenti'}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
            
            <Link to="/lessons" className="block">
              <div className="bg-white border border-slate-200 rounded-lg p-6 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mr-4">
                    <BookOpenText className="w-6 h-6 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">Lezioni</h3>
                      {recentLessons.length > 0 && (
                        <span className="bg-slate-100 text-slate-700 text-xs font-medium px-2 py-1 rounded-full">
                          {recentLessons.length}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      {userProfile.role === 'student' ? 'Consulta registro lezioni' : 'Gestisci registro lezioni'}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
            
            <Link to="/materials" className="block">
              <div className="bg-white border border-slate-200 rounded-lg p-6 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mr-4">
                    <BookOpenText className="w-6 h-6 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Materiali</h3>
                    <p className="text-sm text-slate-600">
                      {userProfile.role === 'student' ? 'Accedi ai materiali' : 'Gestisci materiali didattici'}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Recent Activity Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ProfessionalDataTable
              title="Compiti Recenti"
              columns={[
                { key: 'title', label: 'Titolo' },
                { key: 'dueDate', label: 'Scadenza', align: 'right' },
                { key: 'status', label: 'Stato', align: 'center' }
              ]}
              data={recentHomework.map(homework => ({
                title: homework.title,
                dueDate: formatDate(homework.dueDate),
                status: <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">In corso</span>
              }))}
              emptyMessage={userProfile.role === 'student' && !userProfile.classId 
                ? 'Non sei assegnato a nessuna classe.'
                : 'Nessun compito recente trovato.'}
            />
            
            <ProfessionalDataTable
              title="Lezioni Recenti"
              columns={[
                { key: 'title', label: 'Titolo' },
                { key: 'date', label: 'Data', align: 'right' },
                { key: 'status', label: 'Stato', align: 'center' }
              ]}
              data={recentLessons.map(lesson => ({
                title: lesson.title,
                date: formatDate(lesson.date),
                status: <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full">Completata</span>
              }))}
              emptyMessage={userProfile.role === 'student' && !userProfile.classId 
                ? 'Non sei assegnato a nessuna classe.'
                : 'Nessuna lezione recente trovata.'}
            />
          </div>
        </>
      )}

      {/* Create Event Modal */}
      {showCreateEventModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Crea Nuovo Evento</h2>
              <button
                onClick={() => setShowCreateEventModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
              <CreateEventForm onClose={() => setShowCreateEventModal(false)} />
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};