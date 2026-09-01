import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * КОЛЕСО ЩЁЛКАЕТ НА КАЖДОЕ ПРОЕХАВШЕЕ ЗНАЧЕНИЕ, а не один раз в конце.
 *
 * Правка владельца 2026-09-01: «добавь микровибрацию как в нативках при скроле
 * даты и количества гостей». Соблазн — повесить вибрацию на `onChange`; но
 * значение уходит наверх только когда колесо ОСТАНОВИЛОСЬ
 * (`onMomentumScrollEnd`), и на пролистывании двадцати дат гость получил бы
 * ровно один щелчок. Тест ловит именно эту подмену: он крутит колесо, НЕ
 * доводя до остановки, и считает щелчки.
 *
 * ЧЕГО ЭТОТ ТЕСТ НЕ ДОКАЗЫВАЕТ: что телефон действительно дёрнулся. Вибромотор
 * живёт за нативным модулем, а его здесь подменяет заглушка — проверено, что
 * колесо ЗОВЁТ отклик в нужные моменты и не зовёт в ненужные. Сила и характер
 * импульса проверяются только рукой на устройстве.
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
  render(
    <WheelPicker options={OPTIONS} value="1" onChange={onChange} accessibilityLabel="Гости" />,
  );
  const rows = screen.getAllByRole("button");
  // ScrollView react-native-web: сам скроллер — родитель контейнера строк.
  const scroller = rows[0].parentElement?.parentElement as HTMLElement;
  return { onChange, scroller };
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
  // Событие прокрутки у react-native-web проходит через `scrollEventThrottle`
  // (16 мс). Без управляемого времени второй и третий кадры отбрасываются, и
  // тест «доказал» бы один щелчок вместо трёх — по причине, к колесу
  // отношения не имеющей.
  vi.useFakeTimers({ shouldAdvanceTime: false });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("колесо выбора: тактильный отклик", () => {
  it("щёлкает на КАЖДУЮ строку, проехавшую под центром, а не один раз в конце", () => {
    const { scroller, onChange } = mount();

    scrollTo(scroller, 1);
    vi.advanceTimersByTime(20);
    scrollTo(scroller, 2);
    vi.advanceTimersByTime(20);
    scrollTo(scroller, 3);

    expect(tick).toHaveBeenCalledTimes(3);
    // И значение при этом наверх ещё НЕ ушло: выбор становится выбором только
    // когда колесо остановилось.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("не щёлкает, пока под центром стоит та же строка", () => {
    const { scroller } = mount();

    scrollTo(scroller, 1);
    expect(tick).toHaveBeenCalledTimes(1);

    // Полстроки туда-обратно: значение под центром не сменилось.
    vi.advanceTimersByTime(20);
    Object.defineProperty(scroller, "scrollTop", {
      value: WHEEL_ROW_HEIGHT + 4,
      configurable: true,
    });
    fireEvent.scroll(scroller);

    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("касание и отпускание сами по себе не щёлкают", () => {
    const { scroller } = mount();

    // Полный набор полей обязателен: система ответчиков react-native-web
    // читает у касания и `force`, и страничные координаты, и без них падает
    // в обработчике документа — то есть тест «прошёл бы» по причине,
    // не имеющей отношения к вибрации.
    const touch = (target: HTMLElement) => ({
      identifier: 1,
      target,
      clientX: 10,
      clientY: 10,
      pageX: 10,
      pageY: 10,
      screenX: 10,
      screenY: 10,
      force: 1,
    });

    fireEvent.touchStart(scroller, { touches: [touch(scroller)], changedTouches: [touch(scroller)] });
    fireEvent.touchEnd(scroller, { touches: [], changedTouches: [touch(scroller)] });

    expect(tick).not.toHaveBeenCalled();
  });

  it("тап по другой строке щёлкает один раз — это тоже смена значения", () => {
    const { onChange } = mount();

    fireEvent.click(screen.getByRole("button", { name: "4 гостей" }));

    expect(tick).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("4");
  });

  it("тап по УЖЕ выбранной строке не щёлкает: значение не сменилось", () => {
    const { onChange } = mount();

    fireEvent.click(screen.getByRole("button", { name: "1 гостей" }));

    expect(tick).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith("1");
  });
});
