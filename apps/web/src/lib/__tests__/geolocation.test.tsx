import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GEO_TTL_MS, resetRememberedLocation, useBrowserGeolocation } from "@web/lib/geolocation";

/**
 * Память координат в браузере (спека geolocation-permission.md, раздел 5, «Веб,
 * в памяти»): 10 минут, и только пока разрешение не отозвано.
 */

const getCurrentPosition = vi.fn();
let permissionListener: (() => void) | null = null;
let permissionState: "prompt" | "granted" | "denied" = "granted";

function installBrowser() {
  permissionListener = null;
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
  const status = {
    get state() {
      return permissionState;
    },
    addEventListener: (_: string, fn: () => void) => {
      permissionListener = fn;
    },
    removeEventListener: () => {
      permissionListener = null;
    },
  };
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: { query: vi.fn(async () => status) },
  });
  getCurrentPosition.mockImplementation((ok: (p: unknown) => void) =>
    ok({ coords: { latitude: 43.238, longitude: 76.945 } }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  permissionState = "granted";
  getCurrentPosition.mockReset();
  resetRememberedLocation();
  installBrowser();
});

afterEach(() => {
  vi.useRealTimers();
});

async function located() {
  const hook = renderHook(() => useBrowserGeolocation());
  await act(async () => {});
  await act(async () => {
    await hook.result.current.locate();
  });
  expect(hook.result.current.point).toEqual({ lat: 43.238, lng: 76.945 });
  return hook;
}

describe("useBrowserGeolocation: срок жизни координат", () => {
  it("через 10 минут point в состоянии пропадает (не только в locate())", async () => {
    const { result } = await located();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(GEO_TTL_MS - 1000);
    });
    expect(result.current.point).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.point).toBeNull();
  });

  it("разрешение отозвали (change → denied): point сразу null, locate() не отдаёт старое", async () => {
    const { result } = await located();
    permissionState = "denied";
    await act(async () => {
      permissionListener?.();
    });
    expect(result.current.permission).toBe("denied");
    expect(result.current.point).toBeNull();

    getCurrentPosition.mockClear();
    getCurrentPosition.mockImplementation((_ok: unknown, fail: (e: { code: number }) => void) =>
      fail({ code: 1 }),
    );
    await act(async () => {
      await result.current.locate();
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(result.current.point).toBeNull();
  });

  it("новая вкладка-экран после отзыва: позиция из памяти модуля не подхватывается", async () => {
    await located();
    permissionState = "prompt";
    const second = renderHook(() => useBrowserGeolocation());
    await act(async () => {});
    expect(second.result.current.point).toBeNull();
  });
});
