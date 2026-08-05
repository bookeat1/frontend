import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";

/**
 * The guest's client-side "push notifications" preference.
 *
 * A genuinely stored on/off setting, persisted to expo-secure-store — the only
 * key-value storage this app carries (the same module locale.tsx uses for the
 * language, see its note on why we don't add AsyncStorage just for one value).
 * On web SecureStore no-ops, so the choice simply lasts the session there.
 *
 * It records the guest's intent NOW; it does not yet change what the server
 * sends. Nothing besides the settings toggle reads it.
 *
 * TODO(track-C): gate push registration on this once the push pref has a
 * backend.
 */
const NOTIFICATIONS_KEY = "bookeat.notifications.v1";
const DEFAULT_ENABLED = true;

export function useNotificationsPref(): {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
} {
  const [enabled, setEnabledState] = useState<boolean>(DEFAULT_ENABLED);

  // Hydrate once from storage. A missing value keeps the default; a failed read
  // (e.g. web) does the same rather than throwing.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await SecureStore.getItemAsync(NOTIFICATIONS_KEY);
        if (!cancelled && stored != null) {
          setEnabledState(stored === "true");
        }
      } catch {
        // Storage unavailable — keep the default.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    // Optimistic: reflect the tap immediately so the switch never feels laggy.
    // A failed write only means the choice does not survive a restart, not a
    // blocked toggle.
    setEnabledState(next);
    void (async () => {
      try {
        await SecureStore.setItemAsync(NOTIFICATIONS_KEY, next ? "true" : "false");
      } catch {
        // Storage unavailable (e.g. web) — proceed anyway.
      }
    })();
  }, []);

  return { enabled, setEnabled };
}
