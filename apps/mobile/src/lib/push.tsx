import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRootNavigationState, useRouter } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import { useAuth } from "./auth";
import {
  GuestPushRegistrar,
  type PushGateway,
  type PushOutcome,
  type PushPermission,
} from "./push-registration";
import { pushNavigationTarget } from "./push-routing";
import { setPushSignOutHook } from "./push-signout";
import { describePushSupport, devicePlatformFor, type PushSupport } from "./push-support";
import { useRepository } from "./repository";

/**
 * Guest push notifications: the Expo side of it.
 *
 * The backend sends exactly three things to a guest's phone — the venue
 * CONFIRMED the booking, the booking was CANCELLED by someone other than the
 * guest, and a pre-visit REMINDER (see GuestPushNotifier.Interested in
 * backend-core). All three are about one booking, and all three deep-link to
 * that booking's screen.
 *
 * WHEN PERMISSION IS ASKED FOR — right after the guest's first successful
 * booking, from a card on the reservation screen, never on cold start and
 * never at sign-in. Two reasons, and the second is the load-bearing one:
 *
 *   - the ask is self-explanatory at that moment. The guest has just created a
 *     booking that says «ждём подтверждения»; «сообщим, когда заведение
 *     подтвердит» is the answer to the question they already have. At app
 *     launch it is a demand from a stranger;
 *   - iOS shows the system dialog ONCE per install. Spending it on a cold
 *     start, before the guest has anything to be notified about, converts a
 *     reflexive "no" into a permanent one — there is no second chance, only
 *     Settings.
 *
 * REGISTRATION is a separate thing from the ASK and runs on its own schedule:
 * whenever there is a session and permission is already granted, the token is
 * synced (app start, sign-in, account change, token rotation). That is what
 * makes the feature survive a reinstall or a token roll without another
 * prompt.
 */

/**
 * The EAS project id `getExpoPushTokenAsync` needs, from either place Expo
 * puts it. `expoConfig.extra` is typed `any` by expo-constants, so it is
 * narrowed here rather than trusted — a non-string there would otherwise reach
 * the Expo SDK as a silent `any`.
 */
function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const fromExtra = extra?.eas?.projectId;
  if (typeof fromExtra === "string") return fromExtra;
  const fromEasConfig: unknown = Constants.easConfig?.projectId;
  return typeof fromEasConfig === "string" ? fromEasConfig : undefined;
}

/** Reads the runtime facts that decide whether push can work at all. */
function runtimeSupport(): PushSupport {
  return describePushSupport({
    os: Platform.OS,
    // On web `Device.isDevice` is true for a real browser; the `os === "web"`
    // check runs first anyway.
    isDevice: Device.isDevice,
    isExpoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
    projectId: easProjectId(),
  });
}

/**
 * Foreground behaviour. A booking notification arriving while the app is open
 * IS shown: the guest may be on the search screen, or on a different booking,
 * and silently swallowing «Бронь подтверждена» would mean the one message they
 * were waiting for is the one they never see. The badge is left alone — this
 * app has no unread count to keep honest.
 *
 * Set at module load rather than in an effect so a notification arriving
 * during the first render is already handled. On web `setNotificationHandler`
 * is a no-op in expo-notifications, but the guard keeps the intent explicit.
 */
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Android needs a channel before a notification can be shown with any
 * importance at all; without one the system files everything as "low". */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("bookings", {
      name: "Бронирования",
      importance: Notifications.AndroidImportance.HIGH,
      // Brand red, the same value app.json uses for the adaptive icon.
      lightColor: "#B33036",
    });
  } catch {
    // A channel that cannot be created costs importance, not delivery.
  }
}

/** expo-notifications, narrowed to the three things the registrar needs. */
function createGateway(support: PushSupport): PushGateway {
  return {
    async getPermission(): Promise<PushPermission> {
      const status = await Notifications.getPermissionsAsync();
      if (status.granted) return "granted";
      return status.canAskAgain ? "undetermined" : "denied";
    },
    async requestPermission(): Promise<PushPermission> {
      const status = await Notifications.requestPermissionsAsync();
      if (status.granted) return "granted";
      // After the system dialog has been answered `canAskAgain` is false on
      // iOS, so "not granted" here really is a refusal.
      return status.canAskAgain ? "undetermined" : "denied";
    },
    async getToken(): Promise<string | null> {
      if (!support.supported) return null;
      await ensureAndroidChannel();
      const token = await Notifications.getExpoPushTokenAsync({ projectId: support.projectId });
      return token.data || null;
    },
  };
}

interface PushContextValue {
  /** False on web, on a simulator, in Expo Go on Android and until the
   * project has an EAS id. Screens use it to hide the opt-in card entirely —
   * an unsupported runtime shows the guest nothing, not an error. */
  supported: boolean;
  /** Current OS permission without prompting. "denied" on an unsupported
   * runtime, so a caller that only checks this cannot show a dead card. */
  permission(): Promise<PushPermission>;
  /** Prompts and registers. Safe to call twice — concurrent calls share one
   * result. */
  enable(): Promise<PushOutcome>;
}

const PushContext = createContext<PushContextValue | null>(null);

export function PushProvider({ children }: { children: React.ReactNode }) {
  const repository = useRepository();
  const { status, user } = useAuth();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const navigationReady = Boolean(navigationState?.key);

  const support = useMemo(runtimeSupport, []);
  const platform = devicePlatformFor(Platform.OS);

  const registrar = useMemo(() => {
    // `platform` is undefined only on web, where `support.supported` is false
    // too; "web" is passed so the object is constructible and every call
    // short-circuits on the support check instead of on a null registrar.
    return new GuestPushRegistrar({
      gateway: createGateway(support),
      backend: repository,
      support,
      platform: platform ?? "web",
    });
  }, [platform, repository, support]);

  const userId = user?.id;

  /**
   * Keep the server's copy of this device's token pointed at the CURRENT
   * account. Runs on sign-in and on every account change; never prompts.
   *
   * Keyed on `user.id` rather than on `status`, because the account is what
   * the token has to follow. The consequence, stated plainly: if `/users/me`
   * fails, this run registers nothing. That is preferable to registering
   * against an account we cannot name — on a shared phone the two are the
   * same token and the wrong person gets the notifications.
   */
  useEffect(() => {
    if (status !== "signed-in" || !userId) return;
    let cancelled = false;
    void (async () => {
      const outcome = await registrar.sync(userId);
      if (cancelled) return;
      logOutcome("sync", outcome);
    })();
    return () => {
      cancelled = true;
    };
  }, [registrar, status, userId]);

  /**
   * The provider may roll the token while the app is running. Expo's listener
   * hands back the NATIVE token; the registrar re-reads the Expo one and
   * re-registers only if it actually changed.
   */
  useEffect(() => {
    if (!support.supported || status !== "signed-in" || !userId) return;
    const subscription = Notifications.addPushTokenListener(() => {
      void registrar.sync(userId).then((outcome) => logOutcome("token-change", outcome));
    });
    return () => subscription.remove();
  }, [registrar, status, support.supported, userId]);

  /** Deregister before the session is dropped — see push-signout.ts. */
  useEffect(() => {
    setPushSignOutHook(() => registrar.unregister());
    return () => setPushSignOutHook(null);
  }, [registrar]);

  /* --- taps --- */

  // Notification ids already acted on. A cold-start response stays available
  // from `getLastNotificationResponseAsync` and would otherwise re-navigate
  // every time this effect re-runs.
  const handledResponses = useRef(new Set<string>());

  const openFromResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handledResponses.current.has(id)) return;
      const target = pushNavigationTarget(response.notification.request.content.data);
      // No usable booking id: do nothing at all. The guest is left where they
      // are rather than being thrown at a screen the payload never named.
      if (!target) return;
      handledResponses.current.add(id);
      router.push(target);
    },
    [router],
  );

  useEffect(() => {
    if (!support.supported || !navigationReady) return;
    let cancelled = false;
    // The app was launched (or resumed from killed) BY the tap: the response
    // is waiting rather than arriving as an event.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (cancelled || !response) return;
      openFromResponse(response);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [navigationReady, openFromResponse, support.supported]);

  const value = useMemo<PushContextValue>(
    () => ({
      supported: support.supported,
      permission: () => registrar.permission(),
      enable: async () => {
        if (!userId) return { state: "permission-undetermined" } as const;
        const outcome = await registrar.enable(userId);
        logOutcome("enable", outcome);
        return outcome;
      },
    }),
    [registrar, support.supported, userId],
  );

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export function usePush(): PushContextValue {
  const value = useContext(PushContext);
  if (!value) {
    throw new Error("usePush must be used within a PushProvider");
  }
  return value;
}

/**
 * Development-only breadcrumb. The token is NEVER logged — it is a device
 * credential, the same discipline the backend applies (it logs the row id, not
 * the token).
 */
function logOutcome(where: string, outcome: PushOutcome): void {
  if (!__DEV__) return;
  const detail =
    outcome.state === "unsupported"
      ? `unsupported (${outcome.reason})`
      : outcome.state === "failed"
        ? `failed (${String(outcome.error)})`
        : outcome.state;
  // eslint-disable-next-line no-console
  console.log(`[push] ${where}: ${detail}`);
}
