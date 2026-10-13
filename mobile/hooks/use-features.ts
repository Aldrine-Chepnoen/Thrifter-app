// Shared GET /features fetch — delivery fee tiers + reservation window,
// needed by both the cart and checkout screens for the price breakdown.
import { useEffect, useState } from 'react';
import api from '@/lib/api';

export type Features = {
  promo_10k_enabled: boolean;
  delivery_base_fee_ugx: number;
  delivery_rate_per_km_ugx: number;
  delivery_max_radius_km: number;
  cod_rounding_ugx: number;
  collection_point_lat: number;
  collection_point_lng: number;
  reservation_minutes: number;
};

export function useFeatures() {
  const [features, setFeatures] = useState<Features | null>(null);

  useEffect(() => {
    api.get<Features>('/features').then(({ data }) => setFeatures(data)).catch(() => {});
  }, []);

  return features;
}
