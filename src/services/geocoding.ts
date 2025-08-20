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

// Cache to avoid repeated API calls
const coordinatesCache = new Map<string, Coordinates>();

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
 * Fallback coordinates for major Italian cities (in case API fails)
 */
export const FALLBACK_ITALIAN_CITIES: Record<string, Coordinates> = {
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
  'trieste': { lat: 45.6495, lng: 13.7768 }
};

/**
 * Get coordinates with fallback to hardcoded values
 */
export async function getCityCoordinatesWithFallback(
  cityName: string, 
  country = 'Italy'
): Promise<Coordinates | null> {
  // Try API first
  const apiResult = await getCityCoordinates(cityName, country);
  if (apiResult) {
    return apiResult;
  }
  
  // Fallback to hardcoded coordinates
  const fallback = FALLBACK_ITALIAN_CITIES[cityName.toLowerCase()];
  if (fallback) {
    console.log(`Using fallback coordinates for ${cityName}`);
    return fallback;
  }
  
  return null;
}
