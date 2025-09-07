import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Users, 
  Search,
  Filter,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

interface StudentLocation {
  id: string;
  displayName: string;
  city: string;
  postalCode: string;
  email: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface CityData {
  city: string;
  count: number;
  students: StudentLocation[];
  coordinates: {
    lat: number;
    lng: number;
  };
}

// Major Italian cities with coordinates for demonstration
const ITALIAN_CITIES_COORDS: Record<string, { lat: number; lng: number }> = {
  'roma': { lat: 41.9028, lng: 12.4964 },
  'milano': { lat: 45.4642, lng: 9.1900 },
  'napoli': { lat: 40.8518, lng: 14.2681 },
  'torino': { lat: 45.0703, lng: 7.6869 },
  'palermo': { lat: 38.1157, lng: 13.3613 },
  'genova': { lat: 44.4056, lng: 8.9463 },
  'bologna': { lat: 44.4949, lng: 11.3426 },
  'firenze': { lat: 43.7696, lng: 11.2558 },
  'bari': { lat: 41.1171, lng: 16.8719 },
  'catania': { lat: 37.5079, lng: 15.0830 },
  'venezia': { lat: 45.4408, lng: 12.3155 },
  'verona': { lat: 45.4384, lng: 10.9916 },
  'messina': { lat: 38.1938, lng: 15.5540 },
  'padova': { lat: 45.4064, lng: 11.8768 },
  'trieste': { lat: 45.6495, lng: 13.7768 },
  'brescia': { lat: 45.5416, lng: 10.2118 },
  'taranto': { lat: 40.4668, lng: 17.2725 },
  'prato': { lat: 43.8777, lng: 11.0955 },
  'reggio calabria': { lat: 38.1113, lng: 15.6619 },
  'modena': { lat: 44.6471, lng: 10.9252 },
  'reggio emilia': { lat: 44.6989, lng: 10.6307 },
  'perugia': { lat: 43.1122, lng: 12.3888 },
  'livorno': { lat: 43.5485, lng: 10.3106 },
  'ravenna': { lat: 44.4173, lng: 12.1965 },
  'cagliari': { lat: 39.2238, lng: 9.1217 },
  'foggia': { lat: 41.4621, lng: 15.5444 },
  'rimini': { lat: 44.0678, lng: 12.5695 },
  'salerno': { lat: 40.6824, lng: 14.7681 },
  'ferrara': { lat: 44.8381, lng: 11.6198 },
  'sassari': { lat: 40.7259, lng: 8.5590 }
};

export const StudentLocationMap: React.FC = () => {
  const [students, setStudents] = useState<StudentLocation[]>([]);
  const [cityData, setCityData] = useState<CityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<CityData | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 45.04416958064005, lng: 9.728283448330956 }); // Center of Italy
  const [zoomLevel, setZoomLevel] = useState(6);
  const [error, setError] = useState<string>('');

  // Fetch students with location data
  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      const studentsQuery = query(
        collection(db, 'students'),
        where('accountStatus', '==', 'active')
      );
      
      const snapshot = await getDocs(studentsQuery);
      const studentsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          displayName: data.displayName || '',
          city: data.city || '',
          postalCode: data.postalCode || '',
          email: data.email || '',
          coordinates: data.city ? getCityCoordinates(data.city.toLowerCase()) : undefined
        };
      }).filter(student => student.city) as StudentLocation[];
      
      setStudents(studentsData);
      
      // Group students by city
      const cityMap = new Map<string, CityData>();
      
      studentsData.forEach(student => {
        const cityKey = student.city.toLowerCase();
        const coordinates = getCityCoordinates(cityKey);
        
        if (coordinates) {
          if (cityMap.has(cityKey)) {
            const existing = cityMap.get(cityKey)!;
            existing.count++;
            existing.students.push(student);
          } else {
            cityMap.set(cityKey, {
              city: student.city,
              count: 1,
              students: [student],
              coordinates
            });
          }
        }
      });
      
      setCityData(Array.from(cityMap.values()));
    } catch (error) {
      console.error('Error fetching students:', error);
      setError('Errore nel caricamento dei dati degli studenti');
    } finally {
      setIsLoading(false);
    }
  };

  const getCityCoordinates = (city: string): { lat: number; lng: number } | undefined => {
    return ITALIAN_CITIES_COORDS[city.toLowerCase()];
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const filteredCityData = cityData.filter(city =>
    !searchQuery || city.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalStudents = cityData.reduce((sum, city) => sum + city.count, 0);

  const handleCityClick = (city: CityData) => {
    setSelectedCity(city);
    setMapCenter(city.coordinates);
    setZoomLevel(10);
  };

  const resetMapView = () => {
    setMapCenter({ lat: 41.8719, lng: 12.5674 });
    setZoomLevel(6);
    setSelectedCity(null);
  };

  const getMarkerSize = (count: number) => {
    if (count === 1) return 'w-4 h-4';
    if (count <= 5) return 'w-6 h-6';
    if (count <= 10) return 'w-8 h-8';
    return 'w-10 h-10';
  };

  const getMarkerColor = (count: number) => {
    if (count === 1) return 'bg-blue-500';
    if (count <= 5) return 'bg-green-500';
    if (count <= 10) return 'bg-yellow-500';
    return 'bg-red-500';
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
            <MapPin className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Mappa Studenti
            </h1>
          </motion.div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Visualizza la distribuzione geografica degli studenti in Italia
          </p>
        </div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Totale Studenti</p>
                <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 flex items-center justify-center">
                <MapPin className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Città Rappresentate</p>
                <p className="text-2xl font-bold text-gray-900">{cityData.length}</p>
              </div>
            </div>
          </Card>

          <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100 flex items-center justify-center">
                <Info className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Città Selezionata</p>
                <p className="text-lg font-semibold text-gray-900">
                  {selectedCity ? selectedCity.city : 'Nessuna'}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Map Area */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Mappa Italia</h2>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setZoomLevel(Math.min(12, zoomLevel + 1))}
                      className="rounded-xl"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setZoomLevel(Math.max(4, zoomLevel - 1))}
                      className="rounded-xl"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetMapView}
                      className="rounded-xl"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Simplified Map Visualization */}
                <div className="relative w-full h-96 bg-gradient-to-b from-blue-100 to-green-100 rounded-xl border-2 border-gray-200 overflow-hidden">
                  {/* Italy outline placeholder */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-gray-400 text-center">
                      <MapPin className="h-16 w-16 mx-auto mb-2" />
                      <p className="text-sm">Mappa Italia</p>
                      <p className="text-xs">Zoom: {zoomLevel}x</p>
                    </div>
                  </div>

                  {/* City markers */}
                  {filteredCityData.map((city, index) => (
                    <motion.div
                      key={city.city}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className={`absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 ${getMarkerSize(city.count)} ${getMarkerColor(city.count)} rounded-full border-2 border-white shadow-lg hover:scale-110 transition-transform`}
                      style={{
                        left: `${((city.coordinates.lng - 6.6) / (18.5 - 6.6)) * 100}%`,
                        top: `${(1 - (city.coordinates.lat - 36) / (47 - 36)) * 100}%`
                      }}
                      onClick={() => handleCityClick(city)}
                      title={`${city.city}: ${city.count} studenti`}
                    >
                      <div className="w-full h-full rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {city.count}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                    <span>1 studente</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-green-500 rounded-full"></div>
                    <span>2-5 studenti</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-yellow-500 rounded-full"></div>
                    <span>6-10 studenti</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-red-500 rounded-full"></div>
                    <span>10+ studenti</span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* City List */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Search */}
            <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  type="text"
                  placeholder="Cerca città..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </Card>

            {/* Cities List */}
            <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Città</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="p-4 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Caricamento...</p>
                  </div>
                ) : filteredCityData.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {filteredCityData.map((city) => (
                      <motion.div
                        key={city.city}
                        whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedCity?.city === city.city ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => handleCityClick(city)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{city.city}</h4>
                            <p className="text-sm text-gray-600">
                              {city.count} {city.count === 1 ? 'studente' : 'studenti'}
                            </p>
                          </div>
                          <div className={`w-8 h-8 ${getMarkerColor(city.count)} rounded-full flex items-center justify-center`}>
                            <span className="text-white text-xs font-bold">{city.count}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">
                      {searchQuery ? 'Nessuna città trovata' : 'Nessun dato di localizzazione'}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Selected City Details */}
            {selectedCity && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="bg-white/80 backdrop-blur-md border border-white/20 shadow-xl rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">{selectedCity.city}</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCity(null)}
                        className="rounded-xl"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-sm text-gray-600">
                      {selectedCity.count} {selectedCity.count === 1 ? 'studente' : 'studenti'}
                    </p>
                    <div className="space-y-2">
                      {selectedCity.students.map((student) => (
                        <div key={student.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                              {student.displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {student.displayName}
                            </p>
                            <p className="text-xs text-gray-500">
                              CAP: {student.postalCode}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
