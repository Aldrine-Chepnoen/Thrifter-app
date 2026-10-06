// Thin wrapper around @react-native-google-signin/google-signin's configure()
// call. NOTE: this package requires native code — it does NOT work in Expo
// Go, only in a custom dev client / EAS build (mobile already builds via EAS,
// see eas.json). A `require()` of this package throws synchronously
// (TurboModuleRegistry invariant violation) the moment it's evaluated if the
// native module isn't linked into the running binary — so it's loaded lazily
// here, behind a try/catch, instead of a static top-level import. A static
// import would crash every screen that imports this file (Login, Register)
// the instant Expo Go tries to load them, not just when Google Sign-In is
// actually used.
//
// webClientId's audience is what /auth/google verifies server-side — it must
// be the SAME "Web application" OAuth client ID already configured as the
// backend's GOOGLE_CLIENT_ID (and the web app's VITE_GOOGLE_CLIENT_ID), not a
// new one. iosClientId is a separate "iOS" OAuth client used only to drive
// the native sign-in sheet on iOS; it does not appear in the resulting ID
// token's audience. Android needs no client ID passed here at all — it's
// matched in Google Cloud Console via package name + SHA-1 fingerprint.
// Placeholders below must be swapped for real values (from the Google Cloud
// Console project the other work session is setting up) before shipping.
import type * as GoogleSigninModule from '@react-native-google-signin/google-signin';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? 'REPLACE_WITH_GOOGLE_WEB_CLIENT_ID';
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? 'REPLACE_WITH_GOOGLE_IOS_CLIENT_ID';

let mod: typeof GoogleSigninModule | null | undefined;

// Returns null when the native module isn't linked into this binary (Expo
// Go, or a dev build made before this dependency was added) instead of
// throwing — callers use that to show a "needs a dev build" state.
export function getGoogleSignInModule(): typeof GoogleSigninModule | null {
  if (mod === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      mod = require('@react-native-google-signin/google-signin') as typeof GoogleSigninModule;
    } catch {
      mod = null;
    }
  }
  return mod ?? null;
}

let configured = false;

export function ensureGoogleSignInConfigured(): boolean {
  const m = getGoogleSignInModule();
  if (!m) return false;
  if (!configured) {
    m.GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      iosClientId: IOS_CLIENT_ID,
      offlineAccess: false,
    });
    configured = true;
  }
  return true;
}
