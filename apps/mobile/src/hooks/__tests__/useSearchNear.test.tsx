import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// guest-location.tsx тянет location-native.ts, а он `expo`, которого в jsdom нет.
vi.mock("../../lib/geo/location-native", () => ({
  hasLocationModule: () => false,
  importLocation: () => Promise.reject(new Error("not used")),
}));
const focus = vi.hoisted(() => ({ count: 1 }));
vi.mock("../../lib/screen-focus", () => ({ useScreenFocusCount: () => focus.count }));
import { locationWrapper, makeLocation } from "../../lib/geo/__tests__/fake-location";
import { NEAR_WAIT_MS, useSearchNear } from "../useSearchNear";

/**
 * Откуда «Поиск» берёт координаты (спека geolocation-permission.md, 3.8, 3.9,
 * критерии 16 и 18).
 */

const ALMATY = { lat: 43.238, lng: 76.945 };

afterEach(() => {
  focus.count = 1;
  vi.useRealTimers();
});

function render(initial = makeLocation({ permission: "granted" })) {
  const ref = { current: initial };
  const hook = renderHook(() => useSearchNear(), { wrapper: locationWrapper(ref) });
  return { ref, ...hook };
}

describe("useSearchNear", () => {
  it("web/unsupported: сразу settled и без координат", () => {
    const { result } = render(makeLocation({ permission: "unsupported" }));
    expect(result.current.settled).toBe(true);
    expect(result.current.near).toBeUndefined();
  });

  it("пока статус читается (pending), запрос не отпускается", () => {
    const { result } = render(makeLocation({ permission: "pending" }));
    expect(result.current.settled).toBe(false);
  });

  it("статус не прочитался за NEAR_WAIT_MS: запрос отпущен без координат, опоздавший статус не перестраивает список", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const pending = makeLocation({ permission: "pending" });
    const { result, ref, rerender } = render(pending);
    expect(result.current.settled).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NEAR_WAIT_MS + 5);
    });
    expect(result.current.settled).toBe(true);
    expect(result.current.near).toBeUndefined();

    ref.current = makeLocation({ permission: "granted", peekFresh: vi.fn(() => ALMATY) });
    rerender();
    expect(result.current.near).toBeUndefined();
  });

  it("новый фокус экрана: координаты, опоздавшие в прошлый раз, применяются (3.8)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const loc = makeLocation({ permission: "granted", locate: vi.fn(() => new Promise<never>(() => {})) });
    const { result, ref, rerender } = render(loc);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NEAR_WAIT_MS + 5);
    });
    expect(result.current.settled).toBe(true);
    expect(result.current.near).toBeUndefined();

    // Пока гость был на экране заведения, позиция добралась до памяти.
    ref.current = makeLocation({ permission: "granted", peekFresh: vi.fn(() => ALMATY) });
    rerender();
    expect(result.current.near).toBeUndefined();
    focus.count = 2;
    rerender();
    expect(result.current.near).toEqual(ALMATY);
  });

  it("первый фокус (0 → 1) не считается новым визитом: позиция запрашивается один раз", async () => {
    focus.count = 0;
    const loc = makeLocation({ permission: "granted", locate: vi.fn(async () => ALMATY) });
    const { result, rerender } = render(loc);
    focus.count = 1;
    rerender();
    await act(async () => {});
    expect(result.current.near).toEqual(ALMATY);
    expect(loc.locate).toHaveBeenCalledTimes(1);
  });

  it("нет разрешения: settled, координат нет, позицию не запрашивает", () => {
    const loc = makeLocation({ permission: "undetermined" });
    const { result } = render(loc);
    expect(result.current.settled).toBe(true);
    expect(result.current.near).toBeUndefined();
    expect(loc.locate).not.toHaveBeenCalled();
  });

  it("свежая позиция в памяти берётся сразу, без ожидания", () => {
    const loc = makeLocation({ permission: "granted", peekFresh: vi.fn(() => ALMATY) });
    const { result } = render(loc);
    expect(result.current.near).toEqual(ALMATY);
    expect(result.current.settled).toBe(true);
    expect(loc.locate).not.toHaveBeenCalled();
  });

  it("позиция успела за 1,5 с: запрос уходит с координатами", async () => {
    const loc = makeLocation({ permission: "granted", locate: vi.fn(async () => ALMATY) });
    const { result } = render(loc);
    expect(result.current.settled).toBe(false);
    await act(async () => {});
    expect(result.current.near).toEqual(ALMATY);
    expect(result.current.settled).toBe(true);
  });

  it("позиция опоздала: первый запрос без координат, список потом не перестраивается (кр. 18)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let resolveLate: (p: typeof ALMATY) => void = () => {};
    const loc = makeLocation({
      permission: "granted",
      locate: vi.fn(() => new Promise<typeof ALMATY>((r) => (resolveLate = r))),
    });
    const { result } = render(loc);
    expect(result.current.settled).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(NEAR_WAIT_MS + 5);
    });
    expect(result.current.settled).toBe(true);
    expect(result.current.near).toBeUndefined();

    await act(async () => {
      resolveLate(ALMATY);
    });
    expect(result.current.near).toBeUndefined();
    expect(loc.locate).toHaveBeenCalledTimes(1);
  });

  it("applyPoint (только что выдали разрешение) всё же применяет координаты", async () => {
    const { result } = render(makeLocation({ permission: "undetermined" }));
    act(() => result.current.applyPoint(ALMATY));
    expect(result.current.near).toEqual(ALMATY);
  });

  it("разрешение отозвали: координаты сбрасываются (кр. 16)", async () => {
    const loc = makeLocation({ permission: "granted", peekFresh: vi.fn(() => ALMATY) });
    const { result, ref, rerender } = render(loc);
    expect(result.current.near).toEqual(ALMATY);

    ref.current = makeLocation({ permission: "denied" });
    rerender();
    expect(result.current.near).toBeUndefined();
  });
});
