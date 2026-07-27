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

export type PushOutcome =
  /** This runtime cannot do push at all. Never surfaced to the guest. */
  | { state: "unsupported"; reason: PushUnsupportedReason }
  /** Permission has not been granted and we did not ask (sync path). */
  | { state: "permission-undetermined" }
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
}

export class GuestPushRegistrar {
  private readonly gateway: PushGateway;
  private readonly backend: PushBackend;
  private readonly support: PushSupport;
  private readonly platform: DevicePlatform;

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
  private inFlight: Promise<PushOutcome> | null = null;

  constructor(options: PushRegistrarOptions) {
    this.gateway = options.gateway;
    this.backend = options.backend;
    this.support = options.support;
    this.platform = options.platform;
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
    // Serialise rather than reject: the second caller gets the first call's
    // answer, which is the truth by the time it resolves.
    const next = (this.inFlight ?? Promise.resolve()).then(
      () => this.runExclusive(userId, prompt),
      () => this.runExclusive(userId, prompt),
    );
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
}
