import { render } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Просмотры экранов.
 *
 * События слали 6 экранов из 32, а автозахват SDK намеренно выключен, поэтому
 * «куда вообще ходят гости» в аналитике не было видно. Теперь их шлёт одно
 * место — интеграция с навигацией expo-router.
 *
 * Тест держит то, что ломается тихо: имя экрана — ШАБЛОН маршрута, а не путь с
 * подставленными идентификаторами. Путь `/booking/6f0c…` в аналитике это и
 * тысяча уникальных «экранов» вместо одного, и идентификатор конкретной брони
 * в стороннем сервисе.
 */

let segments: string[] = [];

vi.mock("expo-router", () => ({
  useSegments: () => segments,
}));

const trackEvent = vi.fn();
vi.mock("../analytics", () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

const { ScreenViewTracker, screenNameFromSegments } = await import("../screen-view-tracker");

beforeEach(() => {
  trackEvent.mockClear();
});

describe("имя экрана", () => {
  it("собирается из сегментов маршрута, а не из пути со значениями", () => {
    expect(screenNameFromSegments(["restaurant", "[id]", "book", "confirm"])).toBe(
      "/restaurant/[id]/book/confirm",
    );
    expect(screenNameFromSegments(["booking", "[id]"])).toBe("/booking/[id]");
    // Корень — главная.
    expect(screenNameFromSegments([])).toBe("/");
  });
});

describe("событие просмотра экрана", () => {
  it("уходит на переход и несёт шаблон маршрута без идентификаторов", () => {
    segments = ["booking", "[id]"];
    render(<ScreenViewTracker />);

    expect(trackEvent).toHaveBeenCalledWith("screen_view", { screen: "/booking/[id]" });
    const props = JSON.stringify(trackEvent.mock.calls[0]?.[1]);
    expect(props).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
  });

  it("не повторяется, пока экран тот же", () => {
    segments = ["search"];
    const view = render(<ScreenViewTracker />);
    view.rerender(<ScreenViewTracker />);

    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it("отправляется снова, когда гость ушёл на другой экран", () => {
    segments = ["search"];
    const view = render(<ScreenViewTracker />);
    segments = ["restaurant", "[id]"];
    view.rerender(<ScreenViewTracker />);

    expect(trackEvent.mock.calls.map((call) => call[1])).toEqual([
      { screen: "/search" },
      { screen: "/restaurant/[id]" },
    ]);
  });
});
