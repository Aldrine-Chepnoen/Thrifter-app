// R2 reachability canary. Some ISPs block specific Cloudflare IPs (collateral
// from IP-level blocking of unrelated sites sharing them). Before and after
// serving product images from images.thrifter-ug.com, this measures whether
// each user's network can actually reach it, without affecting anything they
// see. Results land in PostHog as 'r2_beacon' events; failing IPs are resolved
// to ISPs offline with backend/beacon_report.py.
import posthog from 'posthog-js';

const BEACON_URL = 'https://images.thrifter-ug.com/health/beacon.webp';
const TIMEOUT_MS = 10000;

export function runR2Beacon() {
  try {
    if (sessionStorage.getItem('r2_beacon_done')) return;
  } catch {
    return; // storage unavailable — skip rather than fire every render
  }

  const run = () => {
    // Delay so the feed's own images get the connection first
    setTimeout(() => {
      try { sessionStorage.setItem('r2_beacon_done', '1'); } catch { /* noop */ }
      const started = performance.now();
      const img = new Image();
      let settled = false;
      const report = (success, reason) => {
        if (settled) return;
        settled = true;
        posthog.capture('r2_beacon', {
          success,
          reason,
          duration_ms: Math.round(performance.now() - started),
        });
      };
      const timer = setTimeout(() => report(false, 'timeout'), TIMEOUT_MS);
      img.onload = () => { clearTimeout(timer); report(true, 'loaded'); };
      img.onerror = () => { clearTimeout(timer); report(false, 'error'); };
      // Cache-buster so a cached copy from a previous session can't fake success
      img.src = `${BEACON_URL}?cb=${Date.now()}`;
    }, 5000);
  };

  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}
