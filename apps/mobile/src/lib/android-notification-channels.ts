/**
 * Android notification channels this app creates ahead of time, before the
 * first push token is ever requested (push.tsx calls `getToken` right after
 * these are created — see `ensureAndroidChannels`).
 *
 * "offers" is new (push-campaigns spec, §4 criterion 33): a guest can mute
 * campaign pushes in the SYSTEM channel settings without touching
 * "bookings" — the two matter differently (a booking confirmation is
 * operational, a campaign is marketing), so they get separate importance and
 * a separate on/off switch the OS itself renders.
 *
 * Deliberately data-only (no `expo-notifications` import): the actual
 * `Notifications.setNotificationChannelAsync` call — and its
 * `AndroidImportance` enum — lives in push.tsx, which is native-module-heavy
 * and awkward to unit test. This file is the one thing about channel setup
 * worth pinning with a plain test: which channels exist, and that "offers" is
 * not the same channel as "bookings".
 *
 * NOT verified by this test: that the OS call itself succeeds on a real
 * device (see bugs/bookeat-android-push-devicenotregistered).
 */
export type AndroidChannelImportance = "high" | "default";

export interface AndroidChannelSpec {
  id: string;
  name: string;
  importance: AndroidChannelImportance;
  /** Brand red, the same value app.json uses for the adaptive icon. */
  lightColor: string;
}

export const ANDROID_NOTIFICATION_CHANNELS: readonly AndroidChannelSpec[] = [
  { id: "bookings", name: "Бронирования", importance: "high", lightColor: "#B33036" },
  { id: "offers", name: "Акции и события", importance: "default", lightColor: "#B33036" },
];
