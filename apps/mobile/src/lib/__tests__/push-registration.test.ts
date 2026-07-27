import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GuestPushRegistrar,
  type PushBackend,
  type PushGateway,
  type PushPermission,
} from "../push-registration";
import { describePushSupport } from "../push-support";

/**
 * WHAT BREAKS FOR THE GUEST IF THIS FILE GOES RED.
 *
 * Push exists so a guest learns that the venue confirmed (or cancelled) their
 * table without having to open the app and stare at it. Four ways that turns
 * into a defect, and one file holds all four:
 *
 *  1. The guest says NO to the system dialog and the app keeps behaving as if
 *     it can notify them — or worse, keeps asking. A refusal must be a full
 *     stop, and must never look like a broken app.
 *  2. The app posts the same token on every screen mount. Harmless on paper
 *     (the endpoint upserts), a burst of authenticated requests on a phone
 *     connection in practice.
 *  3. Two people share a phone. The second one signs in and the FIRST one goes
 *     on receiving pushes about the second one's dinner — a real privacy leak,
 *     and the reason the backend upserts on the token rather than on the pair.
 *     The client half of that fix is: an account change always re-registers.
 *  4. The app runs where push cannot work (web, simulator, Expo Go on Android,
 *     an unlinked EAS project) and throws, or shows the guest an error about
 *     an OS feature they never asked for.
 */

const SUPPORTED = describePushSupport({
  os: "ios",
  isDevice: true,
  isExpoGo: false,
  projectId: "eas-project-id",
});

interface Fakes {
  gateway: PushGateway;
  backend: PushBackend;
  register: ReturnType<typeof vi.fn>;
  unregister: ReturnType<typeof vi.fn>;
  getToken: ReturnType<typeof vi.fn>;
  requestPermission: ReturnType<typeof vi.fn>;
  setPermission(next: PushPermission): void;
  setToken(next: string | null): void;
}

function fakes(initial: { permission?: PushPermission; token?: string | null } = {}): Fakes {
  let permission: PushPermission = initial.permission ?? "granted";
  // `??` would be wrong here: `null` is a meaningful value (the provider
  // refused to mint a token), not "unset".
  let token: string | null = "token" in initial ? (initial.token ?? null) : "ExponentPushToken[aaa]";

  const requestPermission = vi.fn(async () => {
    // The fake behaves like the OS: asking does not by itself grant anything;
    // a test that wants a grant says so with setPermission.
    return permission;
  });
  const getToken = vi.fn(async () => token);
  const register = vi.fn(async () => {});
  const unregister = vi.fn(async () => {});

  return {
    gateway: {
      getPermission: async () => permission,
      requestPermission,
      getToken,
    },
    backend: { registerPushToken: register, unregisterPushToken: unregister },
    register,
    unregister,
    getToken,
    requestPermission,
    setPermission: (next) => {
      permission = next;
    },
    setToken: (next) => {
      token = next;
    },
  };
}

function registrar(f: Fakes, support = SUPPORTED) {
  return new GuestPushRegistrar({
    gateway: f.gateway,
    backend: f.backend,
    support,
    platform: "ios",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("a guest who refuses notifications", () => {
  it("is not registered, and the refusal is reported as a refusal", async () => {
    const f = fakes({ permission: "denied" });
    const outcome = await registrar(f).enable("user-1");

    expect(outcome).toEqual({ state: "denied" });
    expect(f.register).not.toHaveBeenCalled();
    // The token is never even asked for: on iOS that call is what triggers the
    // APNs registration, and a guest who said no must not be touched again.
    expect(f.getToken).not.toHaveBeenCalled();
  });

  it("is never prompted by the background sync — only by the opt-in card", async () => {
    const f = fakes({ permission: "undetermined" });
    const outcome = await registrar(f).sync("user-1");

    expect(outcome).toEqual({ state: "permission-undetermined" });
    expect(f.requestPermission).not.toHaveBeenCalled();
    expect(f.register).not.toHaveBeenCalled();
  });

  it("is prompted exactly once by the card, and a refusal there is final", async () => {
    const f = fakes({ permission: "undetermined" });
    const r = registrar(f);

    f.setPermission("denied");
    expect(await r.enable("user-1")).toEqual({ state: "denied" });
    expect(f.requestPermission).toHaveBeenCalledTimes(1);

    // Tapping again asks the OS again but still registers nothing — and, on a
    // real device, shows no second system dialog.
    expect(await r.enable("user-1")).toEqual({ state: "denied" });
    expect(f.register).not.toHaveBeenCalled();
  });

  it("a permission read that throws is a failure, not a refusal the guest made", async () => {
    const f = fakes();
    f.gateway.getPermission = async () => {
      throw new Error("permission module unavailable");
    };
    const outcome = await registrar(f).sync("user-1");

    expect(outcome.state).toBe("failed");
    expect(f.register).not.toHaveBeenCalled();
  });
});

describe("one registration per token", () => {
  it("posts once, no matter how many times the sync runs", async () => {
    const f = fakes();
    const r = registrar(f);

    expect(await r.sync("user-1")).toEqual({
      state: "registered",
      token: "ExponentPushToken[aaa]",
    });
    expect(await r.sync("user-1")).toEqual({
      state: "unchanged",
      token: "ExponentPushToken[aaa]",
    });
    expect(await r.sync("user-1")).toEqual({
      state: "unchanged",
      token: "ExponentPushToken[aaa]",
    });

    expect(f.register).toHaveBeenCalledTimes(1);
    expect(f.register).toHaveBeenCalledWith({
      token: "ExponentPushToken[aaa]",
      platform: "ios",
    });
  });

  it("posts again when the provider rolls the token", async () => {
    const f = fakes();
    const r = registrar(f);
    await r.sync("user-1");

    f.setToken("ExponentPushToken[bbb]");
    expect(await r.sync("user-1")).toEqual({
      state: "registered",
      token: "ExponentPushToken[bbb]",
    });
    expect(f.register).toHaveBeenCalledTimes(2);
    expect(f.register).toHaveBeenLastCalledWith({
      token: "ExponentPushToken[bbb]",
      platform: "ios",
    });
  });

  it("two simultaneous calls produce one POST, not two", async () => {
    const f = fakes();
    const r = registrar(f);

    const [first, second] = await Promise.all([r.sync("user-1"), r.sync("user-1")]);

    expect(f.register).toHaveBeenCalledTimes(1);
    // Both callers get a truthful answer; the second one simply learns that
    // the token was already up to date by the time it ran.
    expect([first.state, second.state].sort()).toEqual(["registered", "unchanged"]);
  });

  it("a failed POST is not remembered as success, so the next sync retries", async () => {
    const f = fakes();
    f.register.mockRejectedValueOnce(new Error("network"));
    const r = registrar(f);

    expect((await r.sync("user-1")).state).toBe("failed");
    expect(await r.sync("user-1")).toEqual({
      state: "registered",
      token: "ExponentPushToken[aaa]",
    });
    expect(f.register).toHaveBeenCalledTimes(2);
  });

  it("granted permission but no token from the provider is its own outcome", async () => {
    const f = fakes({ token: null });
    expect(await registrar(f).sync("user-1")).toEqual({ state: "no-token" });
    expect(f.register).not.toHaveBeenCalled();
  });
});

describe("a phone that changes hands", () => {
  it("re-registers the same token when the account changes", async () => {
    const f = fakes();
    const r = registrar(f);

    await r.sync("user-1");
    expect(f.register).toHaveBeenCalledTimes(1);

    // Same device, same token, different person. The POST MUST go out: the
    // backend upserts on the token and re-points it at the caller, which is
    // the only thing that stops user-1 from receiving user-2's bookings.
    expect(await r.sync("user-2")).toEqual({
      state: "registered",
      token: "ExponentPushToken[aaa]",
    });
    expect(f.register).toHaveBeenCalledTimes(2);
    expect(r.registration).toEqual({ userId: "user-2", token: "ExponentPushToken[aaa]" });
  });

  it("signing out deregisters the device and forgets it locally", async () => {
    const f = fakes();
    const r = registrar(f);
    await r.sync("user-1");

    await r.unregister();

    expect(f.unregister).toHaveBeenCalledWith("ExponentPushToken[aaa]");
    expect(r.registration).toBeNull();
    // …and the next account starts from scratch rather than from a stale
    // "already registered" belief.
    await r.sync("user-2");
    expect(f.register).toHaveBeenCalledTimes(2);
  });

  it("signing out with nothing registered makes no request at all", async () => {
    const f = fakes();
    await registrar(f).unregister();
    expect(f.unregister).not.toHaveBeenCalled();
  });

  it("a failing deregister still signs the guest out", async () => {
    const f = fakes();
    f.unregister.mockRejectedValueOnce(new Error("offline"));
    const r = registrar(f);
    await r.sync("user-1");

    await expect(r.unregister()).resolves.toBeUndefined();
    expect(r.registration).toBeNull();
  });
});

describe("a runtime that cannot do push", () => {
  const unsupported = describePushSupport({
    os: "android",
    isDevice: true,
    isExpoGo: true,
    projectId: "eas-project-id",
  });

  it("never touches the OS or the network, and says why", async () => {
    const f = fakes();
    const r = registrar(f, unsupported);

    expect(await r.sync("user-1")).toEqual({
      state: "unsupported",
      reason: "expo-go-android",
    });
    expect(await r.enable("user-1")).toEqual({
      state: "unsupported",
      reason: "expo-go-android",
    });
    expect(f.requestPermission).not.toHaveBeenCalled();
    expect(f.getToken).not.toHaveBeenCalled();
    expect(f.register).not.toHaveBeenCalled();
  });

  it("reports permission as denied, so no screen offers a card that cannot work", async () => {
    const r = registrar(fakes(), unsupported);
    expect(await r.permission()).toBe("denied");
  });

  it("deregistering is a no-op instead of an error", async () => {
    const f = fakes();
    await expect(registrar(f, unsupported).unregister()).resolves.toBeUndefined();
    expect(f.unregister).not.toHaveBeenCalled();
  });
});
