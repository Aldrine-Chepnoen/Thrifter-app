// Mobile port of frontend/src/imageHost.js — decides, once per app launch,
// whether this device can reach the R2 image domain (images.thrifter-ug.com).
// Some ISPs block the Cloudflare IPs it resolves to, and a blocked request
// hangs for seconds — so a tiny probe settles it up front and getImageSrc()
// switches the whole session to each image's Cloudinary fallback_url.
//
// Differences from the web version: uses fetch()+AbortController instead of
// an <img> load/error probe (no DOM here), expo-secure-store instead of
// localStorage for the remembered verdict, and drops the PostHog analytics
// reporting (no RN PostHog SDK installed yet) — the reachability logic itself
// is unchanged.
import * as SecureStore from 'expo-secure-store';

const PROBE_URL = 'https://images.thrifter-ug.com/health/beacon.webp';
// Blocked = TCP hang, so a timeout is the signal. Generous for a tiny fetch
// even on slow mobile data, without stalling blocked users too long.
const PROBE_TIMEOUT_MS = 4000;
const HINT_KEY = 'r2_blocked_hint';

let blocked = false;
const listeners = new Set<(blocked: boolean) => void>();

export const isR2Blocked = () => blocked;

// Subscribe to verdict changes (returns an unsubscribe fn) so already-mounted
// screens can re-render once the probe (or the remembered hint) resolves.
export const onImageHostChange = (fn: (blocked: boolean) => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const setBlocked = (next: boolean) => {
  if (next === blocked) return;
  blocked = next;
  listeners.forEach((fn) => { try { fn(blocked); } catch { /* noop */ } });
};

export async function initImageHost() {
  // Apply the last verdict instantly so a returning user on a blocked
  // network doesn't render broken images while the fresh probe is in flight.
  try {
    const hint = await SecureStore.getItemAsync(HINT_KEY);
    if (hint !== null) setBlocked(hint === '1');
  } catch { /* noop */ }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${PROBE_URL}?cb=${Date.now()}`, { signal: controller.signal });
    setBlocked(!res.ok);
    try { await SecureStore.setItemAsync(HINT_KEY, res.ok ? '0' : '1'); } catch { /* noop */ }
  } catch {
    setBlocked(true);
    try { await SecureStore.setItemAsync(HINT_KEY, '1'); } catch { /* noop */ }
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Image URL resolution — mobile port of frontend/src/utils.js's
// getOptimizedCloudinaryUrl/getImageSrc, kept here (rather than a separate
// utils file) to match this codebase's existing convention (item/[id].tsx
// and vendor/[name].tsx already import getImageSrc from this module).
// ---------------------------------------------------------------------------

const R2_VARIANT_WIDTHS = [200, 400, 600, 800];

export const getOptimizedCloudinaryUrl = (url: string | null | undefined, width = 400) => {
  if (!url) return url ?? null;

  if (/\/w\d+\.webp$/.test(url)) {
    const target = R2_VARIANT_WIDTHS.find((w) => w >= width)
      ?? R2_VARIANT_WIDTHS[R2_VARIANT_WIDTHS.length - 1];
    return url.replace(/\/w\d+\.webp$/, `/w${target}.webp`);
  }

  if (!url.includes('cloudinary.com')) return url;

  return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto,c_limit/`);
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://thrifter-app-production.up.railway.app';

// Very old rows store a bare filename served from the backend's /images dir
const toAbsoluteUrl = (path: string) => {
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}/images/${path.split(/[\\/]/).pop()}`;
};

export type ImageLike = { image_path?: string | null; fallback_url?: string | null } | string | null | undefined;

// Resolves the URL to render for an image, honouring this device's R2
// reachability verdict: sessions that can't reach the R2 domain get the
// image's Cloudinary fallback_url instead.
export const getImageSrc = (image: ImageLike, width = 400): string | null => {
  if (!image) return null;
  if (typeof image === 'string') return getOptimizedCloudinaryUrl(toAbsoluteUrl(image), width);
  if (!image.image_path) return null;
  if (isR2Blocked() && image.fallback_url) {
    return getOptimizedCloudinaryUrl(image.fallback_url, width);
  }
  return getOptimizedCloudinaryUrl(toAbsoluteUrl(image.image_path), width);
};
