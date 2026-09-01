// Shared GET /features fetch — delivery fee tiers + reservation window,
// needed by both the cart and checkout screens for the price breakdown.
import { useEffect, useState } from 'react';
import api from '@/lib/api';

export type Features = {
  delivery_fee_single_vendor_ugx: number;
  delivery_fee_multi_vendor_ugx: number;
  reservation_minutes: number;
};

export function useFeatures() {
  const [features, setFeatures] = useState<Features | null>(null);

  useEffect(() => {
    api.get<Features>('/features').then(({ data }) => setFeatures(data)).catch(() => {});
  }, []);

  return features;
}
