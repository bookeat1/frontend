/**
 * Web (react-native-web) implementation.
 *
 * `push-support.ts` already answers `{ supported: false, reason: "web" }`
 * for `Platform.OS === "web"` BEFORE any other check, so
 * `GuestPushRegistrar` never reaches the gateway functions below on a real
 * web build (see `PushRegistrar.permission()` / `.enable()` — they
 * short-circuit on `support.supported`). This file exists only so
 * `push.tsx`'s import type-checks and Metro has a safe module to resolve if
 * that guard is ever bypassed — every function here is a quiet no-op,
 * matching ADR-046 ("expo-notifications → не вызывается").
 */

export interface NotificationPermissionsStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: "granted" | "denied" | "undetermined";
}

export interface ExpoPushToken {
  data: string;
  type: "expo";
}

export interface NotificationResponse {
  notification: {
    request: {
      identifier: string;
      content: { data: Record<string, unknown> };
    };
  };
}

export interface EventSubscription {
  remove(): void;
}

export const AndroidImportance = {
  UNKNOWN: 0,
  UNSPECIFIED: 1,
  NONE: 2,
  MIN: 3,
  LOW: 4,
  DEFAULT: 5,
  HIGH: 6,
  MAX: 7,
} as const;

export function setNotificationHandler(_handler: unknown): void {
  // No-op: never called on web (push.tsx gates this on `Platform.OS`).
}

export async function setNotificationChannelAsync(
  _channelId: string,
  _channel: unknown,
): Promise<null> {
  return null;
}

export async function getPermissionsAsync(): Promise<NotificationPermissionsStatus> {
  return { granted: false, canAskAgain: false, status: "denied" };
}

export async function requestPermissionsAsync(): Promise<NotificationPermissionsStatus> {
  return { granted: false, canAskAgain: false, status: "denied" };
}

export async function getExpoPushTokenAsync(_options: {
  projectId?: string;
}): Promise<ExpoPushToken> {
  throw new Error("expo-notifications is not supported on web");
}

export function addPushTokenListener(_listener: (token: ExpoPushToken) => void): EventSubscription {
  return { remove() {} };
}

export function addNotificationResponseReceivedListener(
  _listener: (response: NotificationResponse) => void,
): EventSubscription {
  return { remove() {} };
}

export async function getLastNotificationResponseAsync(): Promise<NotificationResponse | null> {
  return null;
}
