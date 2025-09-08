// Geocoding service using OpenStreetMap Nominatim API (free, no API key required)
// Alternative: OpenWeatherMap Geocoding API (requires free API key)

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  name: string;
  coordinates: Coordinates;
  country?: string;
  state?: string;
}

// Enhanced cache with localStorage persistence
const coordinatesCache = new Map<string, Coordinates>();

// Load cache from localStorage on initialization
const loadCacheFromStorage = () => {
  try {
    const stored = localStorage.getItem('geocoding_cache');
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([key, value]) => {
        coordinatesCache.set(key, value as Coordinates);
      });
    }
  } catch (error) {
    console.warn('Failed to load geocoding cache from localStorage:', error);
  }
};

// Save cache to localStorage
const saveCacheToStorage = () => {
  try {
    const cacheObject = Object.fromEntries(coordinatesCache);
    localStorage.setItem('geocoding_cache', JSON.stringify(cacheObject));
  } catch (error) {
    console.warn('Failed to save geocoding cache to localStorage:', error);
  }
};

// Initialize cache from storage
loadCacheFromStorage();

/**
 * Get coordinates for a city using OpenStreetMap Nominatim API (free)
 */
export async function getCityCoordinates(cityName: string, country = 'Italy'): Promise<Coordinates | null> {
  const cacheKey = `${cityName.toLowerCase()}_${country.toLowerCase()}`;
  
  // Check cache first
  if (coordinatesCache.has(cacheKey)) {
    return coordinatesCache.get(cacheKey)!;
  }

  try {
    const query = encodeURIComponent(`${cityName}, ${country}`);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Muallim-School-Management-System'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      const coordinates: Coordinates = {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      };
      
      // Cache the result
      coordinatesCache.set(cacheKey, coordinates);
      saveCacheToStorage(); // Persist to localStorage
      
      return coordinates;
    }
    
    return null;
  } catch (error) {
    console.error(`Error geocoding ${cityName}:`, error);
    return null;
  }
}

/**
 * Get coordinates for multiple cities in batch
 */
export async function getBatchCityCoordinates(
  cities: string[], 
  country = 'Italy'
): Promise<Record<string, Coordinates>> {
  const results: Record<string, Coordinates> = {};
  
  // Process cities with a small delay to be respectful to the API
  for (const city of cities) {
    const coordinates = await getCityCoordinates(city, country);
    if (coordinates) {
      results[city.toLowerCase()] = coordinates;
    }
    
    // Small delay between requests (Nominatim usage policy)
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

/**
 * Alternative: OpenWeatherMap Geocoding (requires API key but more reliable)
 * Uncomment and use this if you have an OpenWeatherMap API key
 */
export async function getCityCoordinatesOpenWeather(
  cityName: string, 
  apiKey: string,
  country = 'IT'
): Promise<Coordinates | null> {
  const cacheKey = `${cityName.toLowerCase()}_${country.toLowerCase()}_ow`;
  
  if (coordinatesCache.has(cacheKey)) {
    return coordinatesCache.get(cacheKey)!;
  }

  try {
    const query = encodeURIComponent(`${cityName},${country}`);
    const response = await fetch(
      `http://api.openweathermap.org/geo/1.0/direct?q=${query}&limit=1&appid=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      const coordinates: Coordinates = {
        lat: result.lat,
        lng: result.lon
      };
      
      coordinatesCache.set(cacheKey, coordinates);
      return coordinates;
    }
    
    return null;
  } catch (error) {
    console.error(`Error geocoding ${cityName} with OpenWeather:`, error);
    return null;
  }
}

/**
 * Extended fallback coordinates for Italian cities (covers ~95% of common cities)
 */
export const FALLBACK_ITALIAN_CITIES: Record<string, Coordinates> = {
  // Major cities
  'roma': { lat: 41.9028, lng: 12.4964 },
  'milano': { lat: 45.4642, lng: 9.1900 },
  'napoli': { lat: 40.8518, lng: 14.2681 },
  'torino': { lat: 45.0703, lng: 7.6869 },
  'palermo': { lat: 38.1157, lng: 13.3615 },
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
  
  // Additional common cities
  'brescia': { lat: 45.5416, lng: 10.2118 },
  'taranto': { lat: 40.4668, lng: 17.2725 },
  'prato': { lat: 43.8777, lng: 11.0955 },
  'parma': { lat: 44.8015, lng: 10.3279 },
  'modena': { lat: 44.6471, lng: 10.9252 },
  'reggio calabria': { lat: 38.1113, lng: 15.6619 },
  'reggio emilia': { lat: 44.6989, lng: 10.6307 },
  'perugia': { lat: 43.1122, lng: 12.3888 },
  'livorno': { lat: 43.5485, lng: 10.3106 },
  'ravenna': { lat: 44.4184, lng: 12.2035 },
  'cagliari': { lat: 39.2238, lng: 9.1217 },
  'foggia': { lat: 41.4621, lng: 15.5444 },
  'rimini': { lat: 44.0678, lng: 12.5695 },
  'salerno': { lat: 40.6824, lng: 14.7681 },
  'ferrara': { lat: 44.8378, lng: 11.6196 },
  'sassari': { lat: 40.7259, lng: 8.5590 },
  'latina': { lat: 41.4677, lng: 12.9037 },
  'giugliano in campania': { lat: 40.9289, lng: 14.1934 },
  'monza': { lat: 45.5845, lng: 9.2744 },
  'siracusa': { lat: 37.0755, lng: 15.2866 },
  'pescara': { lat: 42.4584, lng: 14.2081 },
  'bergamo': { lat: 45.6983, lng: 9.6773 },
  'forlì': { lat: 44.2226, lng: 12.0407 },
  'trento': { lat: 46.0748, lng: 11.1217 },
  'vicenza': { lat: 45.5455, lng: 11.5353 },
  'terni': { lat: 42.5635, lng: 12.6433 },
  'bolzano': { lat: 46.4983, lng: 11.3548 },
  'novara': { lat: 45.4469, lng: 8.6226 },
  'piacenza': { lat: 45.0526, lng: 9.6934 },
  'ancona': { lat: 43.6158, lng: 13.5189 },
  'andria': { lat: 41.2277, lng: 16.2967 },
  'arezzo': { lat: 43.4633, lng: 11.8796 },
  'udine': { lat: 46.0569, lng: 13.2371 },
  'cesena': { lat: 44.1391, lng: 12.2431 },
  'lecce': { lat: 40.3515, lng: 18.1750 },
  'pesaro': { lat: 43.9102, lng: 12.9130 },
  'como': { lat: 45.8081, lng: 9.0852 },
  'brindisi': { lat: 40.6384, lng: 17.9446 }
};

/**
 * Get coordinates with fallback to hardcoded values
 */
export async function getCityCoordinatesWithFallback(
  cityName: string, 
  country = 'Italy'
): Promise<Coordinates | null> {
  const cacheKey = `${cityName.toLowerCase()}_${country.toLowerCase()}`;
  
  // Check cache first (including fallback cache)
  if (coordinatesCache.has(cacheKey)) {
    return coordinatesCache.get(cacheKey)!;
  }
  
  // Check fallback coordinates first (faster than API)
  const fallback = FALLBACK_ITALIAN_CITIES[cityName.toLowerCase()];
  if (fallback) {
    coordinatesCache.set(cacheKey, fallback);
    saveCacheToStorage();
    return fallback;
  }
  
  // Try API call with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const query = encodeURIComponent(`${cityName}, ${country}`);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Muallim-School-Management-System'
        },
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      const coordinates: Coordinates = {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      };
      
      // Cache the result
      coordinatesCache.set(cacheKey, coordinates);
      saveCacheToStorage();
      
      return coordinates;
    }
    
    return null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`Geocoding timeout for ${cityName}`);
    } else {
      console.error(`Error geocoding ${cityName}:`, error);
    }
    return null;
  }
}
