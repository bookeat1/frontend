"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient } from "./api";
import {
  ensureServiceWorker,
  getExistingSubscription,
  isPushSupported,
  subscribeToPush,
  toBackendSubscription,
} from "./push";

/**
 * Push-notification state for the current browser + selected restaurant.
 *
 * - `unsupported` — no service worker / PushManager / VAPID key: hide/disable.
 * - `denied`      — the user blocked notifications at the browser level.
 * - `disabled`    — supported, permission not denied, not currently subscribed.
 * - `enabled`     — an active subscription exists in this browser.
 * - `error`       — the last enable/disable attempt failed (message in `error`).
 */
export type PushStatus = "loading" | "unsupported" | "denied" | "disabled" | "enabled" | "error";

interface UsePush {
  status: PushStatus;
  busy: boolean;
  error: string | null;
  enable(): Promise<void>;
  disable(): Promise<void>;
}

export function usePushNotifications(restaurantId: string | null): UsePush {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the initial status once on the client.
  useEffect(() => {
    let cancelled = false;
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    void (async () => {
      try {
        const existing = await getExistingSubscription();
        if (!cancelled) setStatus(existing ? "enabled" : "disabled");
      } catch {
        if (!cancelled) setStatus("disabled");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    if (!restaurantId || !isPushSupported()) return;
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setStatus("denied");
        return;
      }
      if (permission !== "granted") {
        // User dismissed the prompt without deciding — stay actionable.
        setStatus("disabled");
        return;
      }
      const registration = await ensureServiceWorker();
      const subscription = await subscribeToPush(registration);
      await apiClient.registerPushSubscription(
        toBackendSubscription(subscription, restaurantId),
      );
      setStatus("enabled");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "unknown error");
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }, [restaurantId]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const subscription = await getExistingSubscription();
      if (subscription) {
        // Tell the backend first (endpoint still available), then drop it
        // locally. A failed server call still unsubscribes the browser so the
        // user isn't stuck "enabled" with a dead button.
        try {
          await apiClient.unregisterPushSubscription(subscription.endpoint);
        } finally {
          await subscription.unsubscribe();
        }
      }
      setStatus("disabled");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "unknown error");
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, error, enable, disable };
}
