import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Building, Loader2, MapPin } from 'lucide-react';

export interface AddressSuggestion {
  display_name: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country: string;
    country_code: string;
    postcode?: string;
  };
  lat: string;
  lon: string;
}

// Debounce function to limit API calls
const debounce = <F extends (...args: any[]) => any>(func: F, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<F>): Promise<ReturnType<F>> => {
    clearTimeout(timeout);
    return new Promise((resolve) => {
      timeout = setTimeout(() => resolve(func(...args)), wait);
    });
  };
};

interface AddressAutocompleteProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: { city: string; province: string; region: string; provinceCode?: string; cityCode?: string }) => void;
  className?: string;
  error?: string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  label,
  placeholder,
  value,
  onChange,
  onSelect,
  className = '',
  error,
}) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const fetchSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&countrycodes=it,fr,de,es,pt,ch,at,be,nl,lu,uk,ie,se,no,fi,dk,is,ee,lv,lt,pl,cz,sk,hu,si,hr,ba,rs,me,al,mk,gr,cy,mt,ro,bg,md,ua,by&q=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent': 'MuallimApp/1.0 (your@email.com)' // Required by Nominatim
          }
        }
      );

      if (!response.ok) throw new Error('Error fetching suggestions');
      
      const data = await response.json();
      setSuggestions(data);
      setIsOpen(data.length > 0);
    } catch (error) {
      console.error('Error fetching cities:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Create a debounced version of fetchSuggestions
  const debouncedFetch = useMemo(
    () => debounce(fetchSuggestions, 500), // 500ms debounce
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    debouncedFetch(newValue);
  };

  const handleSelect = (suggestion: AddressSuggestion) => {
    if (!suggestion) return;
    
    const { address } = suggestion;
    const selectedAddress = {
      city: address.city || address.town || address.village || address.municipality || '',
      province: address.county || address.state || '',
      region: address.state || '',
      country: address.country || '',
      postalCode: address.postcode || '',
      coordinates: {
        lat: parseFloat(suggestion.lat),
        lng: parseFloat(suggestion.lon)
      }
    };
    
    onSelect(selectedAddress);
    setIsOpen(false);
    onChange(selectedAddress.city); // Update the input with the selected city
  };

  const renderSuggestion = (suggestion: AddressSuggestion) => {
    const { address } = suggestion;
    const city = address.city || address.town || address.village || address.municipality || 'Unknown';
    const region = address.state || address.county || '';
    const country = address.country_code ? address.country_code.toUpperCase() : '';
    
    return (
      <div className="flex items-center p-2 hover:bg-gray-100 cursor-pointer">
        <MapPin className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
        <div className="min-w-0">
          <div className="font-medium truncate">{city}</div>
          <div className="text-sm text-gray-500 truncate">
            {[region, country].filter(Boolean).join(', ')}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Building className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/70"
          onFocus={() => value.length >= 3 && setSuggestions.length > 0 && setIsOpen(true)}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion) => (
            <li
              key={`${suggestion.lat},${suggestion.lon}-${suggestion.address.postcode || ''}`}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => handleSelect(suggestion)}
            >
              {renderSuggestion(suggestion)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AddressAutocomplete;
