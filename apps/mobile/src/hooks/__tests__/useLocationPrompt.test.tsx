import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// guest-location.tsx тянет location-native.ts, а он `expo`, которого в jsdom нет.
vi.mock("../../lib/geo/location-native", () => ({
  hasLocationModule: () => false,
  importLocation: () => Promise.reject(new Error("not used")),
}));
import { locationWrapper, makeLocation } from "../../lib/geo/__tests__/fake-location";

/**
 * Пре-промпт геопозиции (спека geolocation-permission.md, критерии 10-14, 28).
 * `react-native` по умолчанию в тестах это react-native-web, где Platform.OS ===
 * "web", поэтому нативную платформу задаём явно.
 */

const rn = vi.hoisted(() => ({ os: "ios" }));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return rn.os;
    },
  },
}));

const trackEvent = vi.fn();
vi.mock("../../lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

const store = (await import("expo-secure-store")) as unknown as { __store: Map<string, string> };
const { useLocationPrompt } = await import("../useLocationPrompt");
const { GEO_PROMPT_ANSWERED_KEY, GEO_PROMPT_AUTO_SHOWS_KEY } = await import("../../lib/geo/geo-prompt");

const ALMATY = { lat: 43.238, lng: 76.945 };

beforeEach(() => {
  store.__store.clear();
  trackEvent.mockClear();
  rn.os = "ios";
});

function render(loc = makeLocation(), active = true, onLocated = vi.fn()) {
  const ref = { current: loc };
  const hook = renderHook(() => useLocationPrompt({ active, onLocated }), {
    wrapper: locationWrapper(ref),
  });
  return { ref, onLocated, ...hook };
}

describe("когда карточка видна (кр. 11)", () => {
  it("undetermined, не отвечали, показов 0: видна, событие shown ушло", async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.visible).toBe(true));
    expect(trackEvent).toHaveBeenCalledWith("location_prompt_shown", { surface: "mobile_search_card" });
    expect(store.__store.get(GEO_PROMPT_AUTO_SHOWS_KEY)).toBe("1");
  });

  it("при тексте в строке поиска её нет", async () => {
    const { result } = render(makeLocation(), false);
    await waitFor(() => expect(store.__store.get(GEO_PROMPT_AUTO_SHOWS_KEY)).toBe("1"));
    expect(result.current.visible).toBe(false);
  });

  it.each(["granted", "denied", "unsupported"] as const)("статус %s: карточки нет", async (permission) => {
    const { result } = render(makeLocation({ permission }));
    await act(async () => {});
    expect(result.current.visible).toBe(false);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("на вебе карточки нет (кр. 21)", async () => {
    rn.os = "web";
    const { result } = render();
    await act(async () => {});
    expect(result.current.visible).toBe(false);
  });

  it("уже отвечали: нет", async () => {
    store.__store.set(GEO_PROMPT_ANSWERED_KEY, "1");
    const { result } = render();
    await act(async () => {});
    expect(result.current.visible).toBe(false);
  });

  it("три показа без ответа: на четвёртом визите нет (кр. 13)", async () => {
    for (let visit = 1; visit <= 3; visit += 1) {
      const { result, unmount } = render();
      await waitFor(() => expect(result.current.visible).toBe(true));
      await waitFor(() => expect(store.__store.get(GEO_PROMPT_AUTO_SHOWS_KEY)).toBe(String(visit)));
      unmount();
    }
    const { result } = render();
    await act(async () => {});
    expect(result.current.visible).toBe(false);
  });

  it("набрали и стёрли текст в одном визите: счётчик не растёт второй раз", async () => {
    const loc = makeLocation();
    const ref = { current: loc };
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useLocationPrompt({ active, onLocated: vi.fn() }),
      { wrapper: locationWrapper(ref), initialProps: { active: true } },
    );
    await waitFor(() => expect(result.current.visible).toBe(true));
    rerender({ active: false });
    rerender({ active: true });
    await act(async () => {});
    expect(result.current.visible).toBe(true);
    expect(store.__store.get(GEO_PROMPT_AUTO_SHOWS_KEY)).toBe("1");
    expect(trackEvent.mock.calls.filter(([n]) => n === "location_prompt_shown")).toHaveLength(1);
  });
});

describe("кнопки", () => {
  it("«Не сейчас»: системный диалог не вызывается, answered записан, событие later (кр. 12)", async () => {
    const loc = makeLocation();
    const { result } = render(loc);
    await waitFor(() => expect(result.current.visible).toBe(true));
    act(() => result.current.onLater());
    await waitFor(() => expect(result.current.visible).toBe(false));
    expect(loc.request).not.toHaveBeenCalled();
    expect(store.__store.get(GEO_PROMPT_ANSWERED_KEY)).toBe("1");
    expect(trackEvent).toHaveBeenCalledWith("location_permission_result", {
      surface: "mobile_search_card",
      result: "later",
      precise: null,
    });
  });

  it("«Разрешить» + granted: диалог один раз, координаты отданы экрану (кр. 14)", async () => {
    const request = vi.fn(async () => ({ result: "granted" as const, precise: true, point: ALMATY }));
    const { result, onLocated } = render(makeLocation({ request }));
    await waitFor(() => expect(result.current.visible).toBe(true));
    act(() => {
      result.current.onAllow();
      result.current.onAllow(); // двойной тап
    });
    expect(result.current.working).toBe(true);
    await waitFor(() => expect(onLocated).toHaveBeenCalledWith(ALMATY));
    expect(request).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith("location_permission_result", {
      surface: "mobile_search_card",
      result: "granted",
      precise: true,
    });
    await waitFor(() => expect(result.current.visible).toBe(false));
  });

  it("«Разрешить» + отказ: карточка исчезает, координат нет, ничего не падает", async () => {
    const { result, onLocated } = render(makeLocation());
    await waitFor(() => expect(result.current.visible).toBe(true));
    act(() => result.current.onAllow());
    await waitFor(() => expect(result.current.visible).toBe(false));
    expect(onLocated).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith("location_permission_result", {
      surface: "mobile_search_card",
      result: "denied",
      precise: null,
    });
  });

  it("в событиях нет координат и точности (кр. 28)", async () => {
    const request = vi.fn(async () => ({ result: "granted" as const, precise: false, point: ALMATY }));
    const { result } = render(makeLocation({ request }));
    await waitFor(() => expect(result.current.visible).toBe(true));
    act(() => result.current.onAllow());
    await waitFor(() => expect(result.current.visible).toBe(false));
    const keys = trackEvent.mock.calls.flatMap(([, props]) => Object.keys(props ?? {}));
    for (const forbidden of ["lat", "lng", "latitude", "longitude", "accuracy", "coords"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

it("системный диалог зовётся ТОЛЬКО из «Разрешить» (кр. 10)", async () => {
  const loc = makeLocation();
  const { result } = render(loc);
  await waitFor(() => expect(result.current.visible).toBe(true));
  act(() => result.current.onLater());
  await act(async () => {});
  expect(loc.request).not.toHaveBeenCalled();
});
