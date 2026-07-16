// Decides, once per page load, whether this session can reach the R2 image
// domain (images.thrifter-ug.com). Some ISPs block the Cloudflare IPs it
// resolves to (collateral from IP-level blocking of unrelated sites), and a
// blocked request hangs for 30s+ — so instead of letting every <img> discover
// that individually, one tiny probe settles it up front and getImageSrc()
// switches the whole session to each image's Cloudinary fallback_url.
//
// The verdict is remembered in localStorage so returning users on a blocked
// network render correctly from the first paint; every page load re-probes to
// pick up network changes (wifi -> mobile data, ISP unblocks the IP).
//
// Reporting: emits the same 'r2_beacon' event the standalone beacon did
// (backend/beacon_report.py reads it unchanged), plus 'fallback_activated'
// when the verdict actually flips the session to Cloudinary.
import posthog from 'posthog-js';

const PROBE_URL = 'https://images.thrifter-ug.com/health/beacon.webp';
// Blocked = TCP hang, so a timeout is the signal. 4s is generous for a
// 68-byte fetch even on slow mobile data, without stalling blocked users.
const PROBE_TIMEOUT_MS = 4000;
const HINT_KEY = 'r2_blocked_hint';

let blocked = false;
const listeners = new Set();

export const isR2Blocked = () => blocked;

// Subscribe to verdict changes (returns an unsubscribe fn). App.jsx uses this
// to force a re-render so already-mounted <img> tags pick up the new host.
export const onImageHostChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const setBlocked = (next) => {
  if (next === blocked) return;
  blocked = next;
  listeners.forEach((fn) => { try { fn(blocked); } catch { /* noop */ } });
};

// PostHog discards client IPs (EU privacy default), so events can't be
// attributed to an ISP after the fact. Ask ipwho.is which network this
// client is on and attach it to the event directly.
const lookupIsp = () => new Promise((resolve) => {
  const bail = setTimeout(() => resolve(null), 4000);
  fetch('https://ipwho.is/?fields=connection')
    .then((r) => r.json())
    .then((d) => { clearTimeout(bail); resolve(d && d.connection ? d.connection : null); })
    .catch(() => { clearTimeout(bail); resolve(null); });
});

export function initImageHost() {
  // Apply the last verdict instantly so a returning user on a blocked network
  // doesn't stare at hanging images for PROBE_TIMEOUT_MS on every visit.
  try { blocked = localStorage.getItem(HINT_KEY) === '1'; } catch { /* noop */ }

  const started = performance.now();
  const img = new Image();
  let settled = false;

  const settle = async (success, reason) => {
    if (settled) return;
    settled = true;
    const duration_ms = Math.round(performance.now() - started);
    setBlocked(!success);
    try { localStorage.setItem(HINT_KEY, success ? '0' : '1'); } catch { /* noop */ }

    // Report once per session (same guard key as the old standalone beacon)
    let alreadyReported = false;
    try {
      alreadyReported = !!sessionStorage.getItem('r2_beacon_done');
      sessionStorage.setItem('r2_beacon_done', '1');
    } catch {
      return; // storage unavailable — skip rather than fire every load
    }
    if (alreadyReported) return;

    const conn = await lookupIsp();
    const net = { isp: (conn && conn.isp) || 'unknown', asn: (conn && conn.asn) || 0 };
    posthog.capture('r2_beacon', { success, reason, duration_ms, beacon_v: 3, ...net });
    if (!success) {
      posthog.capture('fallback_activated', { reason, duration_ms, ...net });
    }
  };

  const timer = setTimeout(() => settle(false, 'timeout'), PROBE_TIMEOUT_MS);
  img.onload = () => { clearTimeout(timer); settle(true, 'loaded'); };
  img.onerror = () => { clearTimeout(timer); settle(false, 'error'); };
  // Cache-buster so a cached copy from a previous session can't fake success
  img.src = `${PROBE_URL}?cb=${Date.now()}`;
}
