/**
 * Can this build get a push token at all?
 *
 * A pure function over four facts about the runtime, so the answer is testable
 * without a device and without mocking Expo. `push.tsx` collects the facts;
 * this file decides.
 *
 * Every "no" here is a NORMAL outcome, not a failure: the app must keep
 * working, and the guest must never see an error about it. The only thing an
 * unsupported runtime loses is the notification — the booking screen already
 * tells them what happens next.
 */

/** Why push is unavailable. Kept as a closed union so a new reason cannot be
 * added without every consumer seeing it. */
export type PushUnsupportedReason =
  /** Web build. Expo's push service issues tokens for iOS/Android only, and
   * this app has no service worker — see the admin panel for the web-push
   * story, which is a different mechanism entirely. */
  | "web"
  /** Simulator / emulator. Apple's APNs does not issue tokens to a simulator
   * at all; asking would throw. */
  | "simulator"
  /**
   * Expo Go on Android. Removed in SDK 53: Expo Go's Android client no longer
   * carries the FCM credentials, so `getExpoPushTokenAsync` throws there. A
   * development build or a store build works. On iOS Expo Go still issues a
   * token, so this is deliberately Android-only rather than "Expo Go".
   */
  | "expo-go-android"
  /**
   * No EAS project id. `getExpoPushTokenAsync` needs one to mint a token, and
   * this repo's app.json currently has no `extra.eas.projectId` — the project
   * has never been linked to an EAS account. Until it is, push cannot work in
   * ANY build, and this is the honest reason to report.
   */
  | "no-project-id";

export type PushSupport =
  | { supported: true; projectId: string }
  | { supported: false; reason: PushUnsupportedReason };

export interface PushRuntimeFacts {
  /** `Platform.OS`. */
  os: string;
  /** `Device.isDevice` — false on a simulator/emulator. */
  isDevice: boolean;
  /** True when running inside the Expo Go client (`Constants
   * .executionEnvironment === ExecutionEnvironment.StoreClient`). */
  isExpoGo: boolean;
  /** `Constants.expoConfig?.extra?.eas?.projectId`, or the EAS config's own
   * copy of it. Undefined when the project is not linked. */
  projectId: string | undefined;
}

/**
 * Order matters and is deliberate: the reason reported is the FIRST one a
 * developer would have to fix, so "no EAS project id" never hides behind
 * "simulator" on a machine where both are true.
 */
export function describePushSupport(facts: PushRuntimeFacts): PushSupport {
  if (facts.os === "web") return { supported: false, reason: "web" };
  if (!facts.isDevice) return { supported: false, reason: "simulator" };
  if (facts.isExpoGo && facts.os === "android") {
    return { supported: false, reason: "expo-go-android" };
  }
  const projectId = facts.projectId?.trim();
  if (!projectId) return { supported: false, reason: "no-project-id" };
  return { supported: true, projectId };
}

/** The value the backend's `platform` column accepts for this runtime, or
 * undefined when there is nothing to register (web). Kept next to the support
 * check because they read the same fact. */
export function devicePlatformFor(os: string): "ios" | "android" | undefined {
  if (os === "ios") return "ios";
  if (os === "android") return "android";
  return undefined;
}
