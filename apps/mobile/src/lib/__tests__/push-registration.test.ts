import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GuestPushRegistrar,
  type PushBackend,
  type PushGateway,
  type PushPermission,
  type PushPreference,
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
  preference: PushPreference;
  register: ReturnType<typeof vi.fn>;
  unregister: ReturnType<typeof vi.fn>;
  getToken: ReturnType<typeof vi.fn>;
  requestPermission: ReturnType<typeof vi.fn>;
  setPermission(next: PushPermission): void;
  setToken(next: string | null): void;
  setPreference(next: boolean): void;
}

function fakes(
  initial: { permission?: PushPermission; token?: string | null; pref?: boolean } = {},
): Fakes {
  let permission: PushPermission = initial.permission ?? "granted";
  // The settings switch, as the registrar sees it. Default ON — that is what
  // a guest who never touched it has.
  let pref = initial.pref ?? true;
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
    preference: { enabled: async () => pref },
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
    setPreference: (next) => {
      pref = next;
    },
  };
}

function registrar(f: Fakes, support = SUPPORTED) {
  return new GuestPushRegistrar({
    gateway: f.gateway,
    backend: f.backend,
    preference: f.preference,
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

/**
 * НИ ОДНОГО ТОКЕНА НА СЕРВЕР БЕЗ РАЗРЕШЕНИЯ.
 *
 * Проверка по прямому вопросу владельца: в боевой `device_push_tokens`
 * копятся получатели, которым ничего не доходит. Здесь закрывается клиентская
 * половина — ни один путь регистратора не отправляет `registerPushToken`,
 * пока система не сказала «granted», и ни один даже не спрашивает токен
 * (сам вызов `getExpoPushTokenAsync` на iOS запускает регистрацию в APNs).
 */
describe("токен не уходит на сервер без системного разрешения", () => {
  const withoutPermission: PushPermission[] = ["denied", "undetermined"];

  for (const permission of withoutPermission) {
    it(`не отправляет ничего при permission=${permission} ни одним из путей`, async () => {
      const f = fakes({ permission });
      const r = registrar(f);

      await r.sync("user-1");
      await r.enable("user-1");
      await r.requestPermissionOnly();

      expect(f.register).not.toHaveBeenCalled();
      expect(f.getToken).not.toHaveBeenCalled();
      expect(r.registration).toBeNull();
    });
  }

  it("отправляет ровно тогда, когда разрешение появилось", async () => {
    const f = fakes({ permission: "undetermined" });
    const r = registrar(f);

    await r.sync("user-1");
    expect(f.register).not.toHaveBeenCalled();

    f.setPermission("granted");
    expect(await r.sync("user-1")).toEqual({
      state: "registered",
      token: "ExponentPushToken[aaa]",
    });
    expect(f.register).toHaveBeenCalledTimes(1);
  });
});

/**
 * ТУМБЛЕР «УВЕДОМЛЕНИЯ» УПРАВЛЯЕТ ТИХОЙ СИНХРОНИЗАЦИЕЙ.
 *
 * Без этого выключение живёт до первого перезапуска: `sync` на старте
 * регистрирует токен заново, и гость снова получает пуши, которые выключал.
 */
describe("гость выключил уведомления в настройках", () => {
  it("тихая синхронизация не регистрирует и даже не трогает систему", async () => {
    const f = fakes({ pref: false });
    const r = registrar(f);

    expect(await r.sync("user-1")).toEqual({ state: "disabled-by-guest" });
    expect(f.getToken).not.toHaveBeenCalled();
    expect(f.register).not.toHaveBeenCalled();
  });

  it("а включение тумблера регистрирует сразу — оно и есть согласие", async () => {
    // Сохранённый выбор ещё «выключено» (его пишет экран настроек), но нажатие
    // на тумблер идёт через enable, и оно не должно упереться в собственный
    // флаг: иначе включить уведомления было бы невозможно.
    const f = fakes({ pref: false });

    expect(await registrar(f).enable("user-1")).toEqual({
      state: "registered",
      token: "ExponentPushToken[aaa]",
    });
    expect(f.register).toHaveBeenCalledTimes(1);
  });

  it("нечитаемое хранилище не выдаётся за отказ гостя", async () => {
    const f = fakes();
    f.preference.enabled = async () => {
      throw new Error("keychain locked");
    };

    expect((await registrar(f).sync("user-1")).state).toBe("registered");
  });
});

/**
 * ВЫКЛЮЧЕНИЕ ТУМБЛЕРА СНИМАЕТ РЕГИСТРАЦИЮ.
 *
 * Отдельно от `unregister` (выход из аккаунта): тот опирается на память
 * процесса, а тумблер жмут и на второй день после установки, когда память
 * процесса пуста, а токен на сервере лежит с прошлого запуска.
 */
describe("выключение уведомлений тумблером", () => {
  it("снимает регистрацию токена, зарегистрированного в этом же запуске", async () => {
    const f = fakes();
    const r = registrar(f);
    await r.sync("user-1");

    await r.disable();

    expect(f.unregister).toHaveBeenCalledWith("ExponentPushToken[aaa]");
    expect(r.registration).toBeNull();
  });

  it("снимает регистрацию и после перезапуска, когда процесс ничего не помнит", async () => {
    const f = fakes();
    const r = registrar(f);

    // Ничего не синхронизировали: свежий процесс, токен на сервере с прошлого
    // раза. Токен перечитывается у провайдера.
    await r.disable();

    expect(f.getToken).toHaveBeenCalledTimes(1);
    expect(f.unregister).toHaveBeenCalledWith("ExponentPushToken[aaa]");
  });

  it("без системного разрешения не запрашивает токен и не шлёт запрос", async () => {
    const f = fakes({ permission: "denied" });

    await registrar(f).disable();

    expect(f.getToken).not.toHaveBeenCalled();
    expect(f.unregister).not.toHaveBeenCalled();
  });

  it("упавший запрос не оставляет процесс с верой в регистрацию", async () => {
    const f = fakes();
    f.unregister.mockRejectedValueOnce(new Error("offline"));
    const r = registrar(f);
    await r.sync("user-1");

    await expect(r.disable()).resolves.toBeUndefined();
    expect(r.registration).toBeNull();
  });
});

/**
 * РАЗРЕШЕНИЕ БЕЗ АККАУНТА.
 *
 * Экран настроек открывается раньше, чем отвечает `/users/me`; тумблер,
 * который в этом окне молча ничего не делает, — тот же дефект, только тише.
 */
describe("запрос разрешения без аккаунта", () => {
  it("спрашивает систему и сообщает о согласии, ничего не отправляя", async () => {
    const f = fakes({ permission: "undetermined" });
    const r = registrar(f);
    // Согласие даётся именно в системном диалоге.
    f.requestPermission.mockImplementationOnce(async () => {
      f.setPermission("granted");
      return "granted";
    });

    expect(await r.requestPermissionOnly()).toEqual({ state: "permission-granted" });
    expect(f.requestPermission).toHaveBeenCalledTimes(1);
    expect(f.register).not.toHaveBeenCalled();

    // Токен уходит на сервер при первой же синхронизации после входа.
    expect(await r.sync("user-1")).toEqual({
      state: "registered",
      token: "ExponentPushToken[aaa]",
    });
  });

  it("отказ остаётся отказом", async () => {
    const f = fakes({ permission: "denied" });
    expect(await registrar(f).requestPermissionOnly()).toEqual({ state: "denied" });
  });
});
