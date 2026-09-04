import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Map as MapIcon, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import api from '../api';
import { useToast } from '../context/ToastContext';

// Leaflet's default marker icon references relative image paths that don't
// resolve under Vite's bundling — point it at the bundled assets instead.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const newSessionToken = () => (
  crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

/**
 * Resolves a buyer's delivery point to real coordinates via three methods,
 * in priority order: (1) a Places Autocomplete dropdown, (2) device
 * geolocation, (3) dropping a pin on a map. The delivery fee is
 * distance-based, so `lat`/`lng` are cleared whenever the resolved address is
 * hand-edited — the parent should block submission until they're set again.
 */
const LocationPicker = ({ address, lat, lng, onChange, collectionPointLat, collectionPointLng }) => {
  const { showToast } = useToast();
  const [inputValue, setInputValue] = useState(address || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locating, setLocating] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const sessionTokenRef = useRef(newSessionToken());
  const debounceRef = useRef(null);
  const resolved = lat != null && lng != null;

  useEffect(() => {
    setInputValue(address || '');
  }, [address]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleTextChange = (e) => {
    const next = e.target.value;
    setInputValue(next);
    // Any manual edit invalidates a previously-resolved location — must
    // re-resolve via a suggestion, geolocation, or the map before submitting.
    onChange({ address: next, lat: null, lng: null });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.post('/geocode/autocomplete', {
          input: next.trim(),
          session_token: sessionTokenRef.current,
        });
        setSuggestions(res.data.predictions || []);
        setShowSuggestions(true);
      } catch {
        // Places API (New) not enabled yet, or a transient failure — fail
        // silently, geolocation and the map picker still work.
        setSuggestions([]);
      }
    }, 300);
  };

  const handleSelectSuggestion = async (prediction) => {
    setShowSuggestions(false);
    try {
      const res = await api.post('/geocode/place-details', {
        place_id: prediction.place_id,
        session_token: sessionTokenRef.current,
      });
      setInputValue(res.data.address);
      onChange({ address: res.data.address, lat: res.data.lat, lng: res.data.lng });
      sessionTokenRef.current = newSessionToken();
    } catch {
      showToast('Could not resolve that address. Please try another option.');
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await api.post('/geocode/reverse', { lat: latitude, lng: longitude });
          setInputValue(res.data.address);
          onChange({ address: res.data.address, lat: latitude, lng: longitude });
        } catch {
          // A failed reverse-geocode shouldn't block using the raw coordinates.
          const label = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          setInputValue(label);
          onChange({ address: label, lat: latitude, lng: longitude });
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        showToast('Could not get your location. Please try another option.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleMapPick = async (pickedLat, pickedLng) => {
    setShowMap(false);
    try {
      const res = await api.post('/geocode/reverse', { lat: pickedLat, lng: pickedLng });
      setInputValue(res.data.address);
      onChange({ address: res.data.address, lat: pickedLat, lng: pickedLng });
    } catch {
      const label = `${pickedLat.toFixed(5)}, ${pickedLng.toFixed(5)}`;
      setInputValue(label);
      onChange({ address: label, lat: pickedLat, lng: pickedLng });
    }
  };

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleTextChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Start typing your address..."
          className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#EAAD11]"
          required
          minLength={5}
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-56 overflow-auto">
            {suggestions.map((s) => (
              <li key={s.place_id}>
                <button
                  type="button"
                  onMouseDown={() => handleSelectSuggestion(s)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {s.description}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-4 mt-2">
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          className="flex items-center gap-1.5 text-sm font-bold text-[#EAAD11] hover:underline disabled:opacity-50"
        >
          <MapPin className="w-4 h-4" />
          {locating ? 'Locating…' : 'Use my location'}
        </button>
        <button
          type="button"
          onClick={() => setShowMap(true)}
          className="flex items-center gap-1.5 text-sm font-bold text-[#EAAD11] hover:underline"
        >
          <MapIcon className="w-4 h-4" />
          Pick on map
        </button>
      </div>

      {resolved ? (
        <p className="text-xs text-green-600 mt-1.5">Location confirmed ✓</p>
      ) : (
        <p className="text-xs text-gray-400 mt-1.5">
          Select a suggestion, use your location, or pick on the map to confirm your delivery point.
        </p>
      )}

      {showMap && (
        <MapPickerModal
          initialLat={lat ?? collectionPointLat}
          initialLng={lng ?? collectionPointLng}
          onPick={handleMapPick}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
};

const MapPickerModal = ({ initialLat, initialLng, onPick, onClose }) => {
  const containerRef = useRef(null);
  const [position, setPosition] = useState({ lat: initialLat, lng: initialLng });

  useEffect(() => {
    const map = L.map(containerRef.current).setView([initialLat, initialLng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      setPosition({ lat, lng });
    });
    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-sm">Drop a pin at your delivery location</h3>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div ref={containerRef} className="w-full h-80" />
        <div className="p-4">
          <button
            type="button"
            onClick={() => onPick(position.lat, position.lng)}
            className="w-full bg-[#EAAD11] text-black py-3 rounded-xl font-bold hover:opacity-90 transition-colors"
          >
            Confirm this location
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPicker;
