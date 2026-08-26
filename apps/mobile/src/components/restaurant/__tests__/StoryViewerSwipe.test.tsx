/**
 * Свайп вверх по истории со ссылкой.
 *
 * Тест держит обещания просмотрщика:
 *   1. свайп вверх по истории СО ссылкой открывает эту ссылку;
 *   2. история БЕЗ ссылки от свайпа не меняется вообще — и по-прежнему
 *      листается тапом (свайп не должен читаться как тап и наоборот);
 *   3. значение не-http до `Linking.openURL` не доезжает (вторая половина
 *      цепочки — в тесте маппера);
 *   4. пока открыта ссылка, таймер истории НЕ идёт, а отказ открытия и любой
 *      тап возвращают историю к жизни.
 *
 * ДВЕ ПОДМЕНЫ, БЕЗ КОТОРЫХ ТУТ НЕЧЕГО ПРОВЕРЯТЬ:
 *   • `external-links` — настоящий `Linking.openURL` в jsdom никуда не ведёт,
 *     а проверяем мы именно то, ЧТО просят открыть;
 *   • `Animated.timing`. react-native-web при `Platform.isTesting` (а это
 *     любой прогон vitest) подставляет AnimatedMock, который завершает
 *     анимацию МГНОВЕННО и синхронно — без подмены просмотрщик пролистывает
 *     все истории до конца прямо на монтировании, и ни «стоит на паузе», ни
 *     «пошёл дальше» не отличимы. Здесь таймер заводится, но тикает по
 *     команде теста.
 *
 * ЧЕГО ЭТОТ ТЕСТ НЕ ДОКАЗЫВАЕТ: жест в jsdom — это события touch, которые
 * разбирает система ответчиков react-native-web. Настоящие инерция, прокрутка
 * и перехват жестов iOS/Android сюда не приезжают; свайп проверяется только
 * на устройстве.
 */
import { type RestaurantStory } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { timers } = vi.hoisted(() => ({
  /** Заведённые (и ещё не завершённые) таймеры показа истории. */
  timers: [] as Array<{ duration: number; finish: (finished: boolean) => void }>,
}));

vi.mock("../../../lib/external-links", () => ({
  openWebsite: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("react-native", async () => {
  const actual = await vi.importActual<typeof import("react-native")>("react-native");
  return {
    ...actual,
    Animated: {
      ...actual.Animated,
      timing: (_value: unknown, config: { duration?: number }) => ({
        start: (callback?: (result: { finished: boolean }) => void) => {
          timers.push({
            duration: config.duration ?? 0,
            finish: (finished) => callback?.({ finished }),
          });
        },
        stop: () => {},
      }),
    },
  };
});

import { openWebsite } from "../../../lib/external-links";
import { StoryViewer } from "../StoryViewer";

const t = getDictionary();

/** iPhone 13 — так же, как в тесте шторки блюда. */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const openWebsiteMock = vi.mocked(openWebsite);

const story = (overrides: Partial<RestaurantStory> = {}): RestaurantStory => ({
  id: "s-1",
  imageUrl: "https://cdn.book-eat.com/story-1.jpg",
  caption: "Сладкий четверг",
  sortOrder: 0,
  actionUrl: null,
  ...overrides,
});

const mount = (stories: RestaurantStory[]) => {
  const onClose = vi.fn();
  const result = render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <StoryViewer stories={stories} initialIndex={0} visible onClose={onClose} />
    </SafeAreaProvider>,
  );
  return { ...result, onClose };
};

/** Точка касания в том виде, в каком её ждёт система ответчиков RNW. */
const touch = (target: EventTarget, x: number, y: number) => [
  { identifier: 1, target, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y },
];

/** Палец опустился, проехал по вертикали на `dy` и отпустился. */
const drag = (element: HTMLElement, dy: number) => {
  const from = 400;
  fireEvent.touchStart(element, {
    touches: touch(element, 100, from),
    changedTouches: touch(element, 100, from),
  });
  fireEvent.touchMove(element, {
    touches: touch(element, 100, from + dy),
    changedTouches: touch(element, 100, from + dy),
  });
  fireEvent.touchEnd(element, {
    touches: [],
    changedTouches: touch(element, 100, from + dy),
  });
};

// Просмотрщик — это `Modal`, react-native-web рисует его СОБСТВЕННЫМ поддеревом
// вне возвращаемого render'ом контейнера, поэтому адресуемся через screen.
// `accessibilityLabel` он печатает как `aria-label` — так же, как его читает
// скринридер (селектор с кириллицей в значении атрибута jsdom не находит).
const tapZone = (label: string) => screen.getByLabelText(label);

const shown = () => document.body.textContent ?? "";

beforeEach(() => {
  timers.length = 0;
  openWebsiteMock.mockClear();
  openWebsiteMock.mockResolvedValue(true);
});

/** Досмотреть текущую историю до конца — то, что на устройстве делает таймер. */
const runStoryTimer = () => {
  const timer = timers.pop();
  if (!timer) throw new Error("таймер истории не заведён");
  // act: таймер завершается не из события, а «сам» — без него React не
  // применит перерисовку.
  act(() => timer.finish(true));
};

describe("история со ссылкой", () => {
  it("свайп вверх открывает ссылку истории", () => {
    mount([story({ actionUrl: "https://book-eat.com/promo" })]);
    drag(tapZone(t.restaurant.storyNext), -120);
    expect(openWebsiteMock).toHaveBeenCalledWith("https://book-eat.com/promo");
  });

  it("свайп вверх НЕ листает историю дальше — жест не читается как тап", () => {
    const { onClose } = mount([
      story({ actionUrl: "https://book-eat.com/promo" }),
      story({ id: "s-2", caption: "Живая музыка", sortOrder: 1 }),
    ]);
    drag(tapZone(t.restaurant.storyNext), -120);
    expect(shown()).toContain("Сладкий четверг");
    expect(shown()).not.toContain("Живая музыка");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("подсказка видна и работает как кнопка — свайп скринридеру недоступен", () => {
    mount([story({ actionUrl: "https://book-eat.com/promo" })]);
    expect(shown()).toContain(t.restaurant.storyLinkHint);
    fireEvent.click(screen.getByLabelText(t.restaurant.storyLinkAction));
    expect(openWebsiteMock).toHaveBeenCalledWith("https://book-eat.com/promo");
  });

  it("короткое движение вверх — это дрожание пальца на тапе, а не свайп", () => {
    mount([story({ actionUrl: "https://book-eat.com/promo" })]);
    drag(tapZone(t.restaurant.storyNext), -12);
    expect(openWebsiteMock).not.toHaveBeenCalled();
  });

  it("свайп ВНИЗ ничего не открывает", () => {
    mount([story({ actionUrl: "https://book-eat.com/promo" })]);
    drag(tapZone(t.restaurant.storyNext), 120);
    expect(openWebsiteMock).not.toHaveBeenCalled();
  });

  it("отказ открытия не оставляет просмотрщик замороженным", async () => {
    // openWebsite сам не бросает (Linking.openURL внутри обёрнут в try/catch),
    // но false — это «ничего не открылось»: приложение никуда не уходило, и
    // история обязана продолжить идти сама.
    openWebsiteMock.mockResolvedValue(false);
    mount([story({ actionUrl: "https://book-eat.com/promo" }), story({ id: "s-2", caption: "Живая музыка", sortOrder: 1 })]);
    timers.length = 0;
    drag(tapZone(t.restaurant.storyNext), -120);
    // Дождаться, пока отработает промис openWebsite и снимется пауза.
    await act(async () => {
      await Promise.resolve();
    });
    expect(timers.length).toBeGreaterThan(0);
  });

  it("пока открыта ссылка, таймер истории не идёт", () => {
    mount([
      story({ actionUrl: "https://book-eat.com/promo" }),
      story({ id: "s-2", caption: "Живая музыка", sortOrder: 1 }),
    ]);
    timers.length = 0;
    drag(tapZone(t.restaurant.storyNext), -120);
    // Ни одного нового таймера: история стоит, а не крутится за браузером.
    expect(timers).toHaveLength(0);
    expect(shown()).toContain("Сладкий четверг");
  });

  it("тап по замершей истории снимает паузу — застрять нельзя", () => {
    mount([
      story({ actionUrl: "https://book-eat.com/promo" }),
      story({ id: "s-2", caption: "Живая музыка", sortOrder: 1 }),
    ]);
    drag(tapZone(t.restaurant.storyNext), -120);
    timers.length = 0;
    fireEvent.click(tapZone(t.restaurant.storyNext));
    expect(shown()).toContain("Живая музыка");
    expect(timers.length).toBeGreaterThan(0);
  });
});

describe("история без ссылки ведёт себя как раньше", () => {
  it("свайп вверх ничего не открывает и подсказки нет", () => {
    mount([story()]);
    expect(shown()).not.toContain(t.restaurant.storyLinkHint);
    drag(tapZone(t.restaurant.storyNext), -120);
    expect(openWebsiteMock).not.toHaveBeenCalled();
  });

  it("сама по себе история дальше не убегает — до конца таймера", () => {
    mount([
      story(),
      story({ id: "s-2", caption: "Живая музыка", sortOrder: 1 }),
    ]);
    expect(shown()).toContain("Сладкий четверг");
    runStoryTimer();
    expect(shown()).toContain("Живая музыка");
  });

  it("тап по правой половине по-прежнему листает дальше", () => {
    mount([
      story(),
      story({ id: "s-2", caption: "Живая музыка", sortOrder: 1 }),
    ]);
    fireEvent.click(tapZone(t.restaurant.storyNext));
    expect(shown()).toContain("Живая музыка");
  });

  it("тап по правой половине на последней истории закрывает просмотр", () => {
    const { onClose } = mount([story()]);
    fireEvent.click(tapZone(t.restaurant.storyNext));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("значение не-http не доезжает до openURL", () => {
  /**
   * Цепочка проверяется в двух местах, потому что и правило живёт в одном:
   * маппер (`packages/api/src/__tests__/story-action-url.test.ts`) превращает
   * "javascript:…", "tel:…" и адрес без схемы в `null`, а просмотрщик — вот
   * этот тест — у истории с `null` не рисует подсказку и не открывает ничего.
   * Экран схему НЕ перепроверяет намеренно: две копии одного правила
   * расходятся, а граница у значения одна — маппер.
   */
  it("история без ссылки (то, чем маппер делает javascript:) не зовёт открытие", () => {
    mount([story({ actionUrl: null })]);
    expect(shown()).not.toContain(t.restaurant.storyLinkHint);
    drag(tapZone(t.restaurant.storyNext), -120);
    expect(openWebsiteMock).not.toHaveBeenCalled();
  });
});
