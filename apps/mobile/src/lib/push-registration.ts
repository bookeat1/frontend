import type { DevicePlatform } from "@bookeat/api";
import type { PushSupport, PushUnsupportedReason } from "./push-support";

/**
 * The decision logic of guest push, with no Expo and no React in it.
 *
 * Everything that can go wrong here — permission refused, token unobtainable,
 * the guest switching accounts on a shared phone, a double-tap on «Включить» —
 * is decided in this file, against injected ports. `push.tsx` supplies the
 * real ports (expo-notifications, the repository); the tests supply fakes.
 *
 * INVARIANTS THIS FILE OWNS
 *
 *  1. One POST per (account, token). Re-running the sync after the token and
 *     the account are both unchanged does nothing — the endpoint is a cheap
 *     upsert, but a request per screen mount on a phone connection is not.
 *  2. A CHANGED ACCOUNT always re-registers, even with the same token. The
 *     backend upserts on the token alone and re-points it to the caller
 *     (devicetokens.go), so this is precisely what stops the previous person
 *     on a shared phone from receiving the new person's bookings.
 *  3. Nothing here ever throws at the caller. Push is an enhancement; a guest
 *     who cannot get it must still be able to book. Every outcome is a value.
 */

export type PushPermission = "granted" | "denied" | "undetermined";

/** The OS/provider side. One method per thing that can independently fail. */
export interface PushGateway {
  /** Current permission, without prompting. */
  getPermission(): Promise<PushPermission>;
  /** Prompts. On iOS the system dialog appears at most once in the app's
   * lifetime — after a denial this resolves "denied" with no dialog. */
  requestPermission(): Promise<PushPermission>;
  /** The Expo push token for this install, or null when the provider refused
   * to mint one. */
  getToken(): Promise<string | null>;
}

/** The backend side — the two repository methods, narrowed to what is used. */
export interface PushBackend {
  registerPushToken(input: { token: string; platform: DevicePlatform }): Promise<void>;
  unregisterPushToken(token: string): Promise<void>;
}

/**
 * The guest's «Уведомления» switch, as the registrar sees it.
 *
 * Only the SILENT path (`sync`) consults it: a guest who turned the switch off
 * must stay off across restarts, and re-registering the token on the next cold
 * start is exactly how a switch becomes decorative. `enable` deliberately does
 * NOT consult it — that call IS the guest turning it on.
 */
export interface PushPreference {
  /** False when the guest switched notifications off. Never throws: an
   * unreadable store answers with the default, not with a crash. */
  enabled(): Promise<boolean>;
}

export type PushOutcome =
  /** This runtime cannot do push at all. Never surfaced to the guest. */
  | { state: "unsupported"; reason: PushUnsupportedReason }
  /** Permission has not been granted and we did not ask (sync path). */
  | { state: "permission-undetermined" }
  /** The guest switched notifications off in Settings, so the silent sync did
   * nothing. Not an error and never shown as one. */
  | { state: "disabled-by-guest" }
  /** Permission was granted, but there is no account to register it against
   * yet (the settings toggle can be reached before `/users/me` answers). The
   * token goes out on the next sign-in sync. */
  | { state: "permission-granted" }
  /** The guest said no — now or at some earlier point. */
  | { state: "denied" }
  /** Permission is granted but the provider gave us no token. */
  | { state: "no-token" }
  /** A POST went out and succeeded. */
  | { state: "registered"; token: string }
  /** Nothing to do: this exact token is already registered to this account. */
  | { state: "unchanged"; token: string }
  /** The POST failed. `error` is carried for logs, never for the guest. */
  | { state: "failed"; error: unknown };

interface Registered {
  userId: string;
  token: string;
}

export interface PushRegistrarOptions {
  gateway: PushGateway;
  backend: PushBackend;
  support: PushSupport;
  platform: DevicePlatform;
  preference: PushPreference;
}

export class GuestPushRegistrar {
  private readonly gateway: PushGateway;
  private readonly backend: PushBackend;
  private readonly support: PushSupport;
  private readonly platform: DevicePlatform;
  private readonly preference: PushPreference;

  /**
   * What the SERVER is believed to know, for this process only. Deliberately
   * not persisted: after a cold start one extra upsert is a far smaller price
   * than a stale "already registered" belief that silences a phone whose token
   * the server dropped (Expo reports DeviceNotRegistered and the backend
   * deactivates the row — see GuestPushNotifier).
   */
  private registered: Registered | null = null;

  /** De-duplicates concurrent calls (opt-in card tapped twice, a token-change
   * event arriving while the sign-in sync is still in flight). */
  private inFlight: Promise<unknown> | null = null;

  constructor(options: PushRegistrarOptions) {
    this.gateway = options.gateway;
    this.backend = options.backend;
    this.support = options.support;
    this.platform = options.platform;
    this.preference = options.preference;
  }

  /**
   * Bring the server up to date for `userId` WITHOUT ever prompting.
   *
   * This is the one that runs on sign-in, on a token change and on an account
   * change. A guest who has not granted permission is left alone: the ask has
   * its own moment (see `enable`).
   */
  sync(userId: string): Promise<PushOutcome> {
    return this.run(userId, false);
  }

  /**
   * Ask for permission and register — the opt-in path, called from the card
   * shown right after a booking is created.
   */
  enable(userId: string): Promise<PushOutcome> {
    return this.run(userId, true);
  }

  /**
   * Ask for permission with NO account to register against.
   *
   * The settings toggle can be tapped before `/users/me` has answered, and a
   * switch that silently does nothing in that window is the defect this file
   * exists to prevent. The permission is real; the token goes out on the next
   * sign-in sync.
   */
  requestPermissionOnly(): Promise<PushOutcome> {
    return this.enqueue(() => this.requestExclusive());
  }

  /**
   * The settings toggle turned OFF: stop this device receiving pushes.
   *
   * Unlike `unregister` (the sign-out path) this does not rely on a belief
   * formed in THIS process. The guest may have registered on an earlier
   * launch, so when the belief is empty the token is re-read from the
   * provider — otherwise turning the switch off after a restart would silence
   * nothing at all.
   */
  disable(): Promise<void> {
    return this.enqueue(() => this.disableExclusive());
  }

  /** Current permission, for deciding whether the opt-in card is worth
   * showing. Unsupported runtimes answer "denied" so no card ever appears. */
  async permission(): Promise<PushPermission> {
    if (!this.support.supported) return "denied";
    try {
      return await this.gateway.getPermission();
    } catch {
      return "denied";
    }
  }

  /**
   * Silence this device server-side. Called BEFORE the session is dropped on
   * sign-out — the endpoint is authenticated, so afterwards would be a 401.
   *
   * Never throws and never blocks sign-out on the network: a guest tapping
   * «Выйти» on a dead connection must still be signed out. The local belief is
   * cleared either way, so the next account on this phone re-registers.
   */
  async unregister(): Promise<void> {
    const current = this.registered;
    this.registered = null;
    if (!current) return;
    try {
      await this.backend.unregisterPushToken(current.token);
    } catch {
      // The token stays active server-side until Expo reports the device gone.
      // Nothing better can be done from a phone that is going offline anyway.
    }
  }

  /** Test/diagnostic view of what this process believes the server knows. */
  get registration(): Readonly<Registered> | null {
    return this.registered;
  }

  private run(userId: string, prompt: boolean): Promise<PushOutcome> {
    return this.enqueue(() => this.runExclusive(userId, prompt));
  }

  /**
   * One job at a time, in order. Serialise rather than reject: the second
   * caller gets the first call's answer, which is the truth by the time it
   * resolves. A failed job must not wedge the queue, hence the same task on
   * both branches of `then`.
   */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = (this.inFlight ?? Promise.resolve()).then(task, task);
    this.inFlight = next;
    void next.finally(() => {
      if (this.inFlight === next) this.inFlight = null;
    });
    return next;
  }

  private async runExclusive(userId: string, prompt: boolean): Promise<PushOutcome> {
    if (!this.support.supported) {
      return { state: "unsupported", reason: this.support.reason };
    }

    // The silent path obeys the switch. Asked BEFORE the permission read so a
    // guest who turned notifications off is not even touched — no permission
    // probe, no token, no request.
    if (!prompt && !(await this.readPreference())) {
      return { state: "disabled-by-guest" };
    }

    let permission: PushPermission;
    try {
      permission = await this.gateway.getPermission();
      if (permission !== "granted" && prompt) {
        permission = await this.gateway.requestPermission();
      }
    } catch (error) {
      // A permission read that throws is not a "no" — it is an unknown, and
      // the honest report is a failure rather than a denial the guest never
      // made.
      return { state: "failed", error };
    }
    if (permission === "denied") return { state: "denied" };
    if (permission !== "granted") return { state: "permission-undetermined" };

    let token: string | null;
    try {
      token = await this.gateway.getToken();
    } catch (error) {
      return { state: "failed", error };
    }
    if (!token) return { state: "no-token" };

    const current = this.registered;
    if (current && current.token === token && current.userId === userId) {
      return { state: "unchanged", token };
    }

    try {
      await this.backend.registerPushToken({ token, platform: this.platform });
    } catch (error) {
      // The belief is NOT updated on failure, so the next sync retries.
      return { state: "failed", error };
    }
    this.registered = { userId, token };
    return { state: "registered", token };
  }

  private async requestExclusive(): Promise<PushOutcome> {
    if (!this.support.supported) {
      return { state: "unsupported", reason: this.support.reason };
    }
    let permission: PushPermission;
    try {
      permission = await this.gateway.getPermission();
      if (permission !== "granted") {
        permission = await this.gateway.requestPermission();
      }
    } catch (error) {
      return { state: "failed", error };
    }
    if (permission === "granted") return { state: "permission-granted" };
    if (permission === "denied") return { state: "denied" };
    return { state: "permission-undetermined" };
  }

  private async disableExclusive(): Promise<void> {
    const believed = this.registered;
    this.registered = null;
    let token = believed?.token ?? null;
    if (!token) {
      if (!this.support.supported) return;
      try {
        // No permission means no token to ask for — and nothing this app can
        // do about a token the server may still hold from before the guest
        // revoked permission in the system settings.
        if ((await this.gateway.getPermission()) !== "granted") return;
        token = await this.gateway.getToken();
      } catch {
        return;
      }
    }
    if (!token) return;
    try {
      await this.backend.unregisterPushToken(token);
    } catch {
      // Same as sign-out: the token stays active server-side until Expo
      // reports the device gone. The local switch is off either way, so the
      // next sync will not put it back.
    }
  }

  /** Never lets an unreadable store look like a refusal: the default is the
   * same "yes" the settings screen shows. */
  private async readPreference(): Promise<boolean> {
    try {
      return await this.preference.enabled();
    } catch {
      return true;
    }
  }
}
