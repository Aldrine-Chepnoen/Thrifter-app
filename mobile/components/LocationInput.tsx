// Mobile port of frontend/src/components/LocationPicker.jsx — text
// autocomplete + device geolocation, both resolved through Thrifter's own
// backend-proxied /geocode/* endpoints (no client-side Maps SDK or API key
// needed). The "pick on map" fallback is intentionally not ported — it
// needs a native maps package and is a rare-path fallback, so it's
// deferred; autocomplete + geolocation cover the primary flows.
import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';

const newSessionToken = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

type Prediction = { place_id: string; description: string };

type Props = {
  address: string;
  lat: number | null;
  lng: number | null;
  onChange: (v: { address: string; lat: number | null; lng: number | null }) => void;
};

export default function LocationInput({ address, lat, lng, onChange }: Props) {
  const { showToast } = useToast();
  const [inputValue, setInputValue] = useState(address || '');
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [locating, setLocating] = useState(false);
  const sessionTokenRef = useRef(newSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolved = lat != null && lng != null;

  useEffect(() => setInputValue(address || ''), [address]);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleTextChange = (next: string) => {
    setInputValue(next);
    // Any manual edit invalidates a previously-resolved location — must
    // re-resolve via a suggestion or geolocation before submitting.
    onChange({ address: next, lat: null, lng: null });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.post('/geocode/autocomplete', {
          input: next.trim(),
          session_token: sessionTokenRef.current,
        });
        setSuggestions(data.predictions || []);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  const handleSelectSuggestion = async (prediction: Prediction) => {
    setSuggestions([]);
    try {
      const { data } = await api.post('/geocode/place-details', {
        place_id: prediction.place_id,
        session_token: sessionTokenRef.current,
      });
      setInputValue(data.address);
      onChange({ address: data.address, lat: data.lat, lng: data.lng });
      sessionTokenRef.current = newSessionToken();
    } catch {
      showToast('Could not resolve that address. Please try another option.', 'error');
    }
  };

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast('Location permission is required to use this.', 'error');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = pos.coords;
      try {
        const { data } = await api.post('/geocode/reverse', { lat: latitude, lng: longitude });
        setInputValue(data.address);
        onChange({ address: data.address, lat: latitude, lng: longitude });
      } catch {
        const label = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        setInputValue(label);
        onChange({ address: label, lat: latitude, lng: longitude });
      }
    } catch {
      showToast('Could not get your location. Please try another option.', 'error');
    } finally {
      setLocating(false);
    }
  };

  return (
    <View>
      <TextInput
        className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 text-base"
        placeholder="Start typing your address..."
        placeholderTextColor="#9CA3AF"
        value={inputValue}
        onChangeText={handleTextChange}
        multiline
      />

      {suggestions.length > 0 && (
        <View className="border border-gray-200 dark:border-gray-700 rounded-xl mt-1 overflow-hidden">
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s.place_id}
              onPress={() => handleSelectSuggestion(s)}
              className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 dark:bg-gray-800"
            >
              <Text className="text-sm text-gray-700 dark:text-gray-300">{s.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        onPress={handleUseMyLocation}
        disabled={locating}
        className="flex-row items-center gap-1.5 mt-2"
      >
        {locating ? <ActivityIndicator size="small" color="#EAAD11" /> : <Ionicons name="location-outline" size={16} color="#EAAD11" />}
        <Text className="text-sm font-bold text-[#EAAD11]">{locating ? 'Locating…' : 'Use my location'}</Text>
      </TouchableOpacity>

      {resolved ? (
        <Text className="text-xs text-green-600 mt-1.5">Location confirmed ✓</Text>
      ) : (
        <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
          Select a suggestion or use your location to confirm your delivery point.
        </Text>
      )}
    </View>
  );
}
