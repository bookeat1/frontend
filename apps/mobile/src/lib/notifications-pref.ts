import * as SecureStore from "expo-secure-store";

/**
 * Where the guest's «Уведомления» choice is stored, and nothing else.
 *
 * The value means ONE thing: «этот гость хочет получать пуши». It is half of
 * the switch and never the whole of it — the other half is the OS permission,
 * which this app cannot store and must always re-read (see
 * notification-settings.ts). A stored `true` with permission denied is not
 * "on", it is "хотел бы, но система не даёт".
 *
 * WHO READS IT: the settings screen (through usePushNotificationsSetting) and the
 * push registrar's silent sync, which skips registration entirely when the
 * answer is `false`. That gate is what makes switching off survive a restart.
 *
 * WHY A NEW KEY (v2). v1 held a boolean that nothing ever acted on: the
 * toggle wrote it and no other code read it, so `true` there was a wish, not a
 * subscription. v2 has consequences — it gates a real token registration — so
 * the key is bumped rather than silently repurposed. The one v1 value that
 * carries the guest's actual intent is carried over: someone who switched
 * notifications OFF in an earlier build must not find them back on after an
 * update. The migration copies whatever v1 held and deletes v1, so it happens
 * exactly once per install.
 *
 * Storage is expo-secure-store — the only key-value store this app carries
 * (locale.tsx explains why we do not add AsyncStorage for one value). On web
 * it no-ops, so the choice lasts the session there.
 */
export const NOTIFICATIONS_PREF_KEY = "bookeat.notifications.v2";
export const LEGACY_NOTIFICATIONS_PREF_KEY = "bookeat.notifications.v1";

/**
 * A guest who never touched the switch is treated as willing. This is not the
 * app deciding for them: nothing is sent until the OS permission is granted,
 * and that is asked for explicitly (the post-booking card or this switch).
 */
export const NOTIFICATIONS_PREF_DEFAULT = true;

/** The three SecureStore calls this module needs, so tests can supply their
 * own store instead of mocking a native module. */
export interface PrefStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export async function readNotificationsPref(
  storage: PrefStorage = SecureStore,
): Promise<boolean> {
  let legacy: string | null = null;
  try {
    const stored = await storage.getItemAsync(NOTIFICATIONS_PREF_KEY);
    if (stored != null) return stored === "true";
    legacy = await storage.getItemAsync(LEGACY_NOTIFICATIONS_PREF_KEY);
  } catch {
    // Store unavailable (web, a locked keychain) — the default, never a crash.
    return NOTIFICATIONS_PREF_DEFAULT;
  }
  if (legacy == null) return NOTIFICATIONS_PREF_DEFAULT;

  const value = legacy === "true";
  try {
    await storage.setItemAsync(NOTIFICATIONS_PREF_KEY, legacy === "true" ? "true" : "false");
    await storage.deleteItemAsync(LEGACY_NOTIFICATIONS_PREF_KEY);
  } catch {
    // A migration that could not be written is retried on the next read; the
    // value we return is right either way.
  }
  return value;
}

export async function writeNotificationsPref(
  next: boolean,
  storage: PrefStorage = SecureStore,
): Promise<void> {
  try {
    await storage.setItemAsync(NOTIFICATIONS_PREF_KEY, next ? "true" : "false");
  } catch {
    // A failed write costs the choice its survival across restarts, not the
    // switch itself.
  }
}
