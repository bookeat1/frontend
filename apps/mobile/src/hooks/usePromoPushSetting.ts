import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationPreferences } from "@bookeat/api";
import { useRepository } from "../lib/repository";

/**
 * The «Акции и события» toggle in Settings (push-campaigns spec, §4
 * criterion 34). Unlike the master «Уведомления» row
 * (`usePushNotificationsSetting.ts`), this preference has NO local half — it
 * is entirely server state (`GET/PUT /notification-preferences`), because
 * there is no OS permission attached to "which topics", only to "notifications
 * at all". The server is always the source of truth: this hook reads on
 * mount and, on every flip, sends the FULL four-field body (never a partial
 * PATCH), so a write here can never leave `notifications_enabled` /
 * `push_enabled` / `email_enabled` at a value this screen never showed.
 *
 * The screen decides visibility (rendered only when the master row reads
 * "on" — see settings/index.tsx); this hook does not know about the master
 * row at all, so it stays correct if that gating logic ever changes shape.
 *
 * A network failure on toggle rolls the switch back to what it was BEFORE the
 * tap (not to whatever the server might have raced back with) and reuses the
 * existing `settings.notificationsError` copy — the same "не получилось,
 * попробуйте ещё раз" message the master toggle already shows for the same
 * kind of failure.
 *
 * The INITIAL `GET` can fail too (network/500) — that is `unavailable`, not
 * `failed`: `failed` means "we know the real value, a flip just didn't save
 * it"; `unavailable` means "we never learned the real value at all", so
 * showing the switch as off would be a guess, not a fact. The screen must
 * check `unavailable` itself (via `disabled`/the description) — this hook
 * cannot disable anything on its own, it only exposes state.
 */
export interface PromoPushSetting {
  /** Preferences not read yet: the row should render without a value rather
   * than guess one. */
  loading: boolean;
  value: boolean;
  /** A PUT is in flight — the switch should ignore further taps. */
  working: boolean;
  /** The last flip did not reach the server; the switch is back to its
   * previous position and `settings.notificationsError` should show. */
  failed: boolean;
  /** The initial read never reached the server: there is no known value to
   * show, and `setEnabled` is a no-op until a future mount succeeds. The
   * screen must disable the row and show an error itself — `loading` is
   * `false` by then, so it will NOT gate the row on its own. */
  unavailable: boolean;
  setEnabled(next: boolean): void;
}

export function usePromoPushSetting(): PromoPushSetting {
  const repository = useRepository();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const mounted = useRef(true);
  // A ref, not just the `working` state: two synchronous taps (e.g. a fast
  // double-tap) both fire before React re-renders with `working: true`, so a
  // check against the STATE value alone would let both calls through — the
  // same reason `usePushNotificationsSetting` guards with `busy.current`.
  const busy = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setUnavailable(false);
    void repository
      .getNotificationPreferences()
      .then((next) => {
        if (cancelled) return;
        setPrefs(next);
        setUnavailable(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Could not read: there is no known value, so `value` below would
        // otherwise fall back to `false` and look like a real "off" — flag
        // it explicitly so the screen can disable the row and show an error
        // instead of a silently wrong, tappable-but-inert switch.
        setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const setEnabled = useCallback(
    (next: boolean) => {
      if (!prefs || busy.current) return;
      busy.current = true;
      const previous = prefs;
      setFailed(false);
      setWorking(true);
      // Optimistic: the switch moves at once, and rolls back only on failure.
      setPrefs({ ...prefs, promoPushEnabled: next });
      void repository
        .setNotificationPreferences({
          notificationsEnabled: prefs.notificationsEnabled,
          pushEnabled: prefs.pushEnabled,
          emailEnabled: prefs.emailEnabled,
          promoPushEnabled: next,
        })
        .then((saved) => {
          if (!mounted.current) return;
          setPrefs(saved);
        })
        .catch(() => {
          if (!mounted.current) return;
          // Roll back to what it was BEFORE this tap — not to whatever the
          // server might answer from a stale concurrent read.
          setPrefs(previous);
          setFailed(true);
        })
        .finally(() => {
          busy.current = false;
          if (mounted.current) setWorking(false);
        });
    },
    [prefs, repository],
  );

  return {
    loading,
    value: prefs?.promoPushEnabled ?? false,
    working,
    failed,
    unavailable,
    setEnabled,
  };
}
