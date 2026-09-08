/**
 * Web (react-native-web) implementation.
 *
 * There is no Keychain / Keystore in a browser. `localStorage` is the closest
 * thing this platform has, and it is a DELIBERATE choice, not a silent
 * downgrade of the native comment in auth.tsx (that comment is about the
 * native build, which is untouched): ADR-046 (2026-09-07, "Mobile web is
 * Expo web behind a UA split") picks it so a session, the locale, the chosen
 * city and the notification preference all survive a reload on
 * book-eat.com's mobile view, the same way `apps/web` already persists its
 * own session in `localStorage` (`apps/web/src/lib/session-store.ts`).
 *
 * Every call is wrapped: private browsing / a full quota can make
 * `localStorage` throw, and every call site here already treats a thrown
 * SecureStore call as "nothing stored" (see auth.tsx, locale.tsx,
 * preferred-city.ts, update-snooze.ts, notifications-pref.ts) — so a thrown
 * error here degrades exactly the same way it did before this file existed.
 *
 * NOT namespaced with a `bookeat.m.*` prefix yet (ADR-046 calls for one, to
 * avoid collisions on the shared `book-eat.com` origin once the mobile web
 * and `apps/web` share a domain) — left for the UA-routing follow-up task,
 * this file is scoped to "does not crash / does not lose the persisted
 * value", not to the final key layout.
 */
export async function getItemAsync(key: string): Promise<string | null> {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode, full quota) — the value just does
    // not survive a reload, the same failure mode SecureStore has natively.
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do — the key was either never written or is already gone.
  }
}
