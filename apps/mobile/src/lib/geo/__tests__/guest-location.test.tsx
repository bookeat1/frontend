import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Провайдер геопозиции (спека geolocation-permission.md, M2; критерии 10, 16,
 * 17, 20, 21). Нативный слой подменён целиком: тест видит, КТО и КОГДА его зовёт.
 */

const native = vi.hoisted(() => ({
  hasModule: true,
  importCalls: 0,
  perm: {
    status: "undetermined",
    granted: false,
    canAskAgain: true,
  } as Record<string, unknown>,
  location: {
    getForegroundPermissionsAsync: vi.fn(),
    requestForegroundPermissionsAsync: vi.fn(),
    getLastKnownPositionAsync: vi.fn(),
    getCurrentPositionAsync: vi.fn(),
    hasServicesEnabledAsync: vi.fn(),
    Accuracy: { Balanced: 3 },
  },
}));

vi.mock("../location-native", () => ({
  hasLocationModule: () => native.hasModule,
  importLocation: () => {
    native.importCalls += 1;
    return Promise.resolve(native.location);
  },
}));

const rn = vi.hoisted(() => ({
  os: "ios",
  appStateHandler: null as null | ((s: string) => void),
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return rn.os;
    },
  },
  AppState: {
    addEventListener: (_: string, handler: (s: string) => void) => {
      rn.appStateHandler = handler;
      return { remove: () => (rn.appStateHandler = null) };
    },
  },
}));

const { GuestLocationProvider, useGuestLocation, LOCATION_TTL_MS, LOCATION_TIMEOUT_MS, STATUS_TIMEOUT_MS } =
  await import("../guest-location");
const { useSearchNear, NEAR_WAIT_MS } = await import("../../../hooks/useSearchNear");

const position = (lat: number, lng: number) => ({ coords: { latitude: lat, longitude: lng } });

function setup() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <GuestLocationProvider>{children}</GuestLocationProvider>
  );
  return renderHook(() => useGuestLocation(), { wrapper });
}

beforeEach(() => {
  native.hasModule = true;
  native.importCalls = 0;
  rn.os = "ios";
  rn.appStateHandler = null;
  native.perm = { status: "undetermined", granted: false, canAskAgain: true };
  native.location.getForegroundPermissionsAsync.mockReset();
  native.location.getForegroundPermissionsAsync.mockImplementation(async () => native.perm);
  native.location.requestForegroundPermissionsAsync.mockReset();
  native.location.requestForegroundPermissionsAsync.mockImplementation(async () => native.perm);
  native.location.getLastKnownPositionAsync.mockReset();
  native.location.getLastKnownPositionAsync.mockResolvedValue(null);
  native.location.getCurrentPositionAsync.mockReset();
  native.location.getCurrentPositionAsync.mockResolvedValue(position(43.2381, 76.9452));
  native.location.hasServicesEnabledAsync.mockReset();
  native.location.hasServicesEnabledAsync.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("гейт модуля и платформы", () => {
  it("без нативного модуля: unsupported, пакет не подтягивается, диалога нет (кр. 20)", async () => {
    native.hasModule = false;
    const { result } = setup();
    expect(result.current.permission).toBe("unsupported");
    await act(async () => {
      await result.current.refresh();
    });
    const outcome = await result.current.request();
    expect(outcome.result).toBe("unavailable");
    expect(native.importCalls).toBe(0);
    expect(native.location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("на вебе: unsupported и ничего не зовёт (кр. 21)", async () => {
    rn.os = "web";
    const { result } = setup();
    expect(result.current.permission).toBe("unsupported");
    expect(native.importCalls).toBe(0);
    expect(await result.current.locate()).toBeNull();
  });
});

describe("статус и диалог", () => {
  it("на старте только читает статус, системный диалог не вызывает (кр. 10)", async () => {
    const { result } = setup();
    expect(result.current.permission).toBe("pending");
    await waitFor(() => expect(result.current.permission).toBe("undetermined"));
    expect(native.location.getForegroundPermissionsAsync).toHaveBeenCalled();
    expect(native.location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("request(): granted (iOS, точная) → берёт позицию, precise = true", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.permission).toBe("undetermined"));
    native.perm = {
      status: "granted",
      granted: true,
      canAskAgain: true,
      ios: { scope: "whenInUse", accuracy: "full" },
    };
    let outcome: Awaited<ReturnType<typeof result.current.request>> | undefined;
    await act(async () => {
      outcome = await result.current.request();
    });
    expect(outcome).toEqual({ result: "granted", precise: true, point: { lat: 43.2381, lng: 76.9452 } });
    expect(result.current.permission).toBe("granted");
  });

  it("приблизительная геопозиция (Android coarse) тоже принимается, precise = false", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.permission).toBe("undetermined"));
    native.perm = { status: "granted", granted: true, canAskAgain: true, android: { accuracy: "coarse" } };
    let outcome: Awaited<ReturnType<typeof result.current.request>> | undefined;
    await act(async () => {
      outcome = await result.current.request();
    });
    expect(outcome?.result).toBe("granted");
    expect(outcome?.precise).toBe(false);
    expect(outcome?.point).not.toBeNull();
  });

  it("отказ: denied, без координат, canAskAgain из ответа ОС", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.permission).toBe("undetermined"));
    native.perm = { status: "denied", granted: false, canAskAgain: false };
    let outcome: Awaited<ReturnType<typeof result.current.request>> | undefined;
    await act(async () => {
      outcome = await result.current.request();
    });
    expect(outcome).toEqual({ result: "denied", precise: null, point: null });
    expect(result.current.permission).toBe("denied");
    expect(result.current.canAskAgain).toBe(false);
    expect(native.location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("диалог закрыли без ответа: это не отказ, статус остаётся undetermined", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.permission).toBe("undetermined"));
    let outcome: Awaited<ReturnType<typeof result.current.request>> | undefined;
    await act(async () => {
      outcome = await result.current.request();
    });
    expect(outcome?.result).toBe("unavailable");
    expect(result.current.permission).toBe("undetermined");
  });
});

describe("позиция: свежесть и порядок источников (кр. 17)", () => {
  async function granted() {
    native.perm = { status: "granted", granted: true, canAskAgain: true, ios: { scope: "whenInUse", accuracy: "full" } };
    const hook = setup();
    await waitFor(() => expect(hook.result.current.permission).toBe("granted"));
    return hook;
  }

  it("сначала last-known с maxAge 10 минут и точностью 5 км", async () => {
    const { result } = await granted();
    native.location.getLastKnownPositionAsync.mockResolvedValue(position(1.5, 2.5));
    const point = await result.current.locate();
    expect(point).toEqual({ lat: 1.5, lng: 2.5 });
    expect(native.location.getLastKnownPositionAsync).toHaveBeenCalledWith({
      maxAge: 600000,
      requiredAccuracy: 5000,
    });
    expect(native.location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("нет last-known → getCurrentPosition с Balanced", async () => {
    const { result } = await granted();
    await result.current.locate();
    expect(native.location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 3 });
  });

  it("в пределах 10 минут повторно из памяти, потом заново", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { result } = await granted();
    await result.current.locate();
    expect(native.location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    expect(result.current.peekFresh()).not.toBeNull();

    vi.setSystemTime(Date.now() + LOCATION_TTL_MS - 1000);
    await result.current.locate();
    expect(native.location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 2000);
    expect(result.current.peekFresh()).toBeNull();
    await result.current.locate();
    expect(native.location.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
  });

  it("параллельные запросы делят один вызов нативного слоя", async () => {
    const { result } = await granted();
    await Promise.all([result.current.locate(), result.current.locate()]);
    expect(native.location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it("таймаут 8 с: null, без исключения", async () => {
    const { result } = await granted();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    native.location.getCurrentPositionAsync.mockReturnValue(new Promise(() => {}));
    const pending = result.current.locate();
    await vi.advanceTimersByTimeAsync(LOCATION_TIMEOUT_MS + 10);
    await expect(pending).resolves.toBeNull();
  });

  it("геолокация на телефоне выключена: null и servicesOff", async () => {
    const { result } = await granted();
    native.location.getCurrentPositionAsync.mockRejectedValue(new Error("Location services are disabled"));
    native.location.hasServicesEnabledAsync.mockResolvedValue(false);
    await act(async () => {
      await expect(result.current.locate()).resolves.toBeNull();
    });
    expect(result.current.servicesOff).toBe(true);
  });

  it("без разрешения не обращается к нативному слою за позицией", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.permission).toBe("undetermined"));
    expect(await result.current.locate()).toBeNull();
    expect(native.location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });
});

describe("возврат из фона (кр. 16)", () => {
  it("разрешение отозвали в настройках: статус перечитан, позиция забыта", async () => {
    native.perm = { status: "granted", granted: true, canAskAgain: true, ios: { scope: "whenInUse", accuracy: "full" } };
    const { result } = setup();
    await waitFor(() => expect(result.current.permission).toBe("granted"));
    await act(async () => {
      await result.current.locate();
    });
    expect(result.current.peekFresh()).not.toBeNull();

    native.perm = { status: "denied", granted: false, canAskAgain: false };
    await act(async () => {
      rn.appStateHandler?.("active");
    });
    await waitFor(() => expect(result.current.permission).toBe("denied"));
    expect(result.current.peekFresh()).toBeNull();
    expect(await result.current.locate()).toBeNull();
  });

  it("уход в фон ничего не перечитывает", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.permission).toBe("undetermined"));
    const before = native.location.getForegroundPermissionsAsync.mock.calls.length;
    await act(async () => {
      rn.appStateHandler?.("background");
    });
    expect(native.location.getForegroundPermissionsAsync.mock.calls.length).toBe(before);
  });
});

/**
 * Сломанная геопозиция = обычный порядок (главное правило спеки). Раньше ошибка
 * или зависание чтения статуса при старте оставляли `permission = pending`
 * навсегда, `settled = false`, и «Поиск» вечно показывал загрузку.
 */
describe("статус при старте не прочитался", () => {
  function setupWithSearch() {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <GuestLocationProvider>{children}</GuestLocationProvider>
    );
    return renderHook(() => ({ geo: useGuestLocation(), near: useSearchNear() }), { wrapper });
  }

  it("чтение бросает: unsupported, «Поиск» отпущен без координат", async () => {
    native.location.getForegroundPermissionsAsync.mockRejectedValue(new Error("native failure"));
    const { result } = setupWithSearch();
    await waitFor(() => expect(result.current.geo.permission).toBe("unsupported"));
    expect(result.current.near.settled).toBe(true);
    expect(result.current.near.near).toBeUndefined();
  });

  it("чтение никогда не отвечает: по таймауту unsupported, «Поиск» отпущен", async () => {
    vi.useFakeTimers();
    native.location.getForegroundPermissionsAsync.mockReturnValue(new Promise(() => {}));
    const { result } = setupWithSearch();
    expect(result.current.near.settled).toBe(false);
    // «Поиск» ждёт не дольше NEAR_WAIT_MS, не дожидаясь таймаута провайдера.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NEAR_WAIT_MS + 5);
    });
    expect(result.current.near.settled).toBe(true);
    expect(result.current.geo.permission).toBe("pending");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATUS_TIMEOUT_MS);
    });
    expect(result.current.geo.permission).toBe("unsupported");
  });

  it("нативный вызов бросает синхронно: unsupported, «Поиск» отпущен", async () => {
    native.location.getForegroundPermissionsAsync.mockImplementation(() => {
      throw new Error("sync native failure");
    });
    const { result } = setupWithSearch();
    await waitFor(() => expect(result.current.near.settled).toBe(true));
    expect(result.current.geo.permission).toBe("unsupported");
  });

  it("возврат из фона после сбоя: следующее чтение выводит из unsupported", async () => {
    native.location.getForegroundPermissionsAsync.mockRejectedValueOnce(new Error("boom"));
    const { result } = setup();
    await waitFor(() => expect(result.current.permission).toBe("unsupported"));
    await act(async () => {
      rn.appStateHandler?.("active");
    });
    await waitFor(() => expect(result.current.permission).toBe("undetermined"));
  });

  it("сбой перечитывания при уже известном статусе статус не стирает", async () => {
    native.perm = { status: "granted", granted: true, canAskAgain: true };
    const { result } = setup();
    await waitFor(() => expect(result.current.permission).toBe("granted"));
    native.location.getForegroundPermissionsAsync.mockRejectedValue(new Error("boom"));
    await act(async () => {
      rn.appStateHandler?.("active");
    });
    expect(result.current.permission).toBe("granted");
  });
});
