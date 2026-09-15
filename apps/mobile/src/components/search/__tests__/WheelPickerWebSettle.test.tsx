import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * НА `react-native-web` `onScrollEndDrag`/`onMomentumScrollEnd` НЕ ВЫЗЫВАЮТСЯ
 * НИКОГДА (проверено чтением `react-native-web/dist/exports/ScrollView/*.js` и
 * живым тестом в headless-браузере — см. комментарий компонента и
 * `bugs/bookeat-mobile-wheelpicker-web-scroll-freeze.md` в командной памяти).
 * Без вызова `settle()` гость крутит колесо на «3 гостя», видит подсветку на
 * 3, жмёт «Применить» — а наружу уходит старое значение: скролл «докручивался»
 * глазами (CSS `scroll-snap-*`), но выбор не коммитился никогда.
 *
 * Этот тест ловит именно коммит значения — независимо от того, что колесо
 * визуально доехало до нужной строки: `onScroll` — единственное событие,
 * которое react-native-web реально шлёт, поэтому «колесо остановилось» на
 * вебе определяется тишиной в потоке `onScroll` длиной
 * `WEB_SCROLL_END_DEBOUNCE_MS`, а не RN-колбэками конца жеста.
 */

const tick = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/haptics", () => ({ hapticSelectionTick: tick }));

const { WheelPicker, WHEEL_ROW_HEIGHT } = await import("../WheelPicker");

const OPTIONS = Array.from({ length: 8 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} гостей`,
}));

function mount() {
  const onChange = vi.fn();
  const { unmount } = render(
    <WheelPicker options={OPTIONS} value="1" onChange={onChange} accessibilityLabel="Гости" />,
  );
  const rows = screen.getAllByRole("button");
  // ScrollView react-native-web: сам скроллер — родитель контейнера строк.
  const scroller = rows[0].parentElement?.parentElement as HTMLElement;
  return { onChange, scroller, unmount };
}

/** Прокрутка на `rows` строк вниз, как её видит react-native-web. */
function scrollTo(scroller: HTMLElement, rows: number) {
  Object.defineProperty(scroller, "scrollTop", {
    value: rows * WHEEL_ROW_HEIGHT,
    configurable: true,
  });
  fireEvent.scroll(scroller);
}

beforeEach(() => {
  tick.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: false });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("колесо выбора на вебе: коммит значения после остановки прокрутки", () => {
  // RNW сам досылает ОДИН финальный `onScroll` спустя ~100мс после
  // последнего реального события (`ScrollViewBase.js`), и он тоже
  // переставляет наш debounce — реальная задержка коммита от последнего
  // касания это ~100мс довеска RNW + `WEB_SCROLL_END_DEBOUNCE_MS`, поэтому
  // здесь продвигаем фальшивые таймеры с запасом на оба, а не только на
  // порог debounce.
  const SETTLE_WAIT_MS = 300;

  it("коммитит значение спустя тишину в onScroll, а не сразу и не никогда", () => {
    const { scroller, onChange } = mount();

    scrollTo(scroller, 2);
    // Сразу после события — черновой выбор ещё не применён.
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SETTLE_WAIT_MS);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("3");
  });

  it("серия быстрых событий прокрутки коммитит ОДИН раз — по финальной позиции", () => {
    const { scroller, onChange } = mount();

    // Каждый следующий кадр приходит раньше, чем истекает тишина —
    // debounce должен переставляться, а не копить отдельные коммиты.
    scrollTo(scroller, 1);
    vi.advanceTimersByTime(40);
    scrollTo(scroller, 2);
    vi.advanceTimersByTime(40);
    scrollTo(scroller, 3);

    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SETTLE_WAIT_MS);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("4");
  });

  it("размонтирование колеса до истечения тишины отменяет отложенный коммит, а не роняет его на закрытый компонент", () => {
    const { scroller, onChange, unmount } = mount();

    scrollTo(scroller, 2);
    unmount();
    // Ни исключения (колбэк не должен звать onChange после размонтирования),
    // ни отложенного вызова — эффект-клинап должен был снять таймер.
    expect(() => vi.advanceTimersByTime(SETTLE_WAIT_MS)).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });
});
