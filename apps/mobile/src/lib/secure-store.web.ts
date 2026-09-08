import type { AuthSession } from "@bookeat/api";
import { SESSION_KEY } from "./session-key";

/**
 * Web (react-native-web) implementation.
 *
 * There is no Keychain / Keystore in a browser. `localStorage` is the closest
 * thing this platform has, and it is a DELIBERATE choice, not a silent
 * downgrade of the native comment in auth.tsx (that comment is about the
 * native build, which is untouched): ADR-046 (2026-09-07, "Mobile web is
 * Expo web behind a UA split") picks it so a session, the locale, the chosen
 * city and the notification preference all survive a reload on
 * book-eat.com's mobile view.
 *
 * Every call is wrapped: private browsing / a full quota can make
 * `localStorage` throw, and every call site here already treats a thrown
 * SecureStore call as "nothing stored" (see auth.tsx, locale.tsx,
 * preferred-city.ts, update-snooze.ts, notifications-pref.ts) — so a thrown
 * error here degrades exactly the same way it did before this file existed.
 *
 * MW-4: TWO different things get persisted through this one generic
 * key-value API, and ADR-046 treats them differently once mobile web and
 * `apps/web` share `book-eat.com`:
 *
 *  - THE SESSION (`SESSION_KEY`, one JSON blob on native) is a genuinely
 *    SHARED concept — signing in on the desktop site must not sign the
 *    mobile view out and vice versa. So it is NOT namespaced: it is stored
 *    field-by-field under `apps/web`'s own keys
 *    (`apps/web/src/lib/session-store.ts`), the exact format a guest
 *    switching between the two already gets served from the same origin.
 *  - EVERYTHING ELSE (locale, preferred city, notifications preference,
 *    update-snooze) is mobile-web-only device state that `apps/web` has no
 *    concept of, so it is namespaced under `bookeat.m.*` — this is the
 *    "namespacing left for later" MW-2's version of this file mentioned.
 */

/**
 * `apps/web`'s own session keys — duplicated here rather than imported.
 * `apps/web` is a separate Next.js app; nothing outside `packages/*` is
 * meant to be imported across app boundaries in this monorepo (see the root
 * CLAUDE.md). Keep in sync BY HAND with `apps/web/src/lib/session-store.ts`
 * if that file's key names or shape ever change.
 */
const WEB_SESSION_KEYS = {
  accessToken: "bookeat.web.access_token",
  refreshToken: "bookeat.web.refresh_token",
  /** RFC3339, same string the server sends — matches `AuthSession.expiresAt`
   * and `apps/web`'s `KEYS.expiresAt` exactly, no reformatting either way. */
  expiresAt: "bookeat.web.access_expires_at",
} as const;

/**
 * `apps/web` also owns `bookeat.web.user` (the cached profile, shown in its
 * header before `GET /users/me` answers). Mobile never WRITES it — the
 * guest's profile lives in the react-query `["me"]` cache here, not in
 * storage (see auth.tsx) — but sign-out still clears it: leaving a stale
 * name behind after the one shared session it belonged to is gone would
 * show it again the moment the guest switches to the desktop view, ahead of
 * `/users/me` catching the dead token.
 */
const WEB_USER_KEY = "bookeat.web.user";

/** Reads the three fanned-out fields back into the JSON blob shape
 * `auth.tsx`'s `readPersisted()` expects. `null` when there is no complete
 * session — `readPersisted()` treats that exactly like "nothing stored". */
function readSharedSession(): string | null {
  const accessToken = window.localStorage.getItem(WEB_SESSION_KEYS.accessToken);
  const refreshToken = window.localStorage.getItem(WEB_SESSION_KEYS.refreshToken);
  if (!accessToken || !refreshToken) return null;
  const session: AuthSession = {
    accessToken,
    refreshToken,
    expiresAt: window.localStorage.getItem(WEB_SESSION_KEYS.expiresAt) ?? "",
    // `apps/web`'s `storeSession` does not persist this either — it is only
    // read once, synchronously, right after a fresh sign-in (the onboarding
    // redirect), never off a rehydrated session. `null` here means the same
    // "not new" `auth.tsx` already treats an unknown value as.
    isNewUser: null,
  };
  return JSON.stringify(session);
}

/** Fans the JSON blob `auth.tsx`'s `persist()` writes out into `apps/web`'s
 * three keys. `isNewUser` is deliberately dropped, matching `storeSession`. */
function writeSharedSession(value: string): void {
  const session = JSON.parse(value) as AuthSession;
  window.localStorage.setItem(WEB_SESSION_KEYS.accessToken, session.accessToken);
  window.localStorage.setItem(WEB_SESSION_KEYS.refreshToken, session.refreshToken);
  if (session.expiresAt) {
    window.localStorage.setItem(WEB_SESSION_KEYS.expiresAt, session.expiresAt);
  } else {
    window.localStorage.removeItem(WEB_SESSION_KEYS.expiresAt);
  }
}

function clearSharedSession(): void {
  window.localStorage.removeItem(WEB_SESSION_KEYS.accessToken);
  window.localStorage.removeItem(WEB_SESSION_KEYS.refreshToken);
  window.localStorage.removeItem(WEB_SESSION_KEYS.expiresAt);
  window.localStorage.removeItem(WEB_USER_KEY);
}

/** Every OTHER key this module is asked for — mobile-web-only device state
 * `apps/web` has no concept of. `bookeat.` -> `bookeat.m.` so it can never
 * collide with a `bookeat.web.*` (or a future bare `bookeat.*`) key once
 * both fronts share `book-eat.com`. */
function deviceKey(key: string): string {
  return key.startsWith("bookeat.") ? `bookeat.m.${key.slice("bookeat.".length)}` : key;
}

export async function getItemAsync(key: string): Promise<string | null> {
  try {
    if (key === SESSION_KEY) return readSharedSession();
    return window.localStorage.getItem(deviceKey(key));
  } catch {
    return null;
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  try {
    if (key === SESSION_KEY) {
      writeSharedSession(value);
      return;
    }
    window.localStorage.setItem(deviceKey(key), value);
  } catch {
    // Storage unavailable (private mode, full quota) — the value just does
    // not survive a reload, the same failure mode SecureStore has natively.
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  try {
    if (key === SESSION_KEY) {
      clearSharedSession();
      return;
    }
    window.localStorage.removeItem(deviceKey(key));
  } catch {
    // Nothing to do — the key was either never written or is already gone.
  }
}
