import { getDictionary } from "@bookeat/i18n";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PartySheet } from "../PartySheet";

/**
 * СТАРЫЙ БИНАРЬ БЕЗ НАТИВНОГО МОДУЛЯ ВИБРАЦИИ ОБЯЗАН ПОДНЯТЬ ЭКРАН.
 *
 * `expo-haptics` добавлен 2026-09-01 и появится только в следующей сборке.
 * Установленные приложения (Android 1.5, сборки 100–104 в Google Play; iOS
 * 1.5.1 сборка 3 в TestFlight) этой нативной части не имеют, а JS-правки мы
 * возим им по воздуху — `eas update` публикуется в том числе под их старые
 * рантаймы. Значит свежий бандл штатно оказывается на бинаре без модуля.
 *
 * Здесь этот бинарь и воспроизведён: `expo-haptics` бросает на вычислении
 * модуля ровно то, что бросает `requireNativeModule`, когда нативной части
 * нет. Дальше проверяется, что шторка с двумя колёсами («Дата и гости» на
 * главной) поднимается, крутится, выбирает и подтверждает пару — без вибрации,
 * без ошибок в консоли и без висящих отказов обещаний.
 *
 * ЭТОТ ТЕСТ ПАДАЕТ, ЕСЛИ ВЕРНУТЬ СТАТИЧЕСКИЙ ИМПОРТ в `src/lib/haptics.ts`:
 * тогда бросок случается на загрузке модуля обёртки, то есть на загрузке
 * бандла, и до экрана дело не доходит вовсе. На телефоне это выглядит как
 * «приложение не запускается» у всех, кто получил обновление.
 */

const loadAttempts = vi.hoisted(() => vi.fn());

vi.mock("expo-haptics", () => {
  loadAttempts();
  throw new Error("Cannot find native module 'ExpoHaptics'");
});

/**
 * В jsdom `Platform.OS === "web"`, а на вебе обёртка вибрации осознанно НИЧЕГО
 * не делает и модуль даже не грузит. Поэтому телефон приходится назвать
 * телефоном: подменяется только `Platform`, всё остальное в `react-native`
 * (то есть react-native-web) остаётся настоящим и рисует шторку как обычно.
 */
vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-native")>();
  return { ...actual, Platform: { ...actual.Platform, OS: "ios" } };
});

vi.mock("../../../lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

const t = getDictionary("ru");

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const DATES = [
  { value: "2026-09-01", label: "1 сентября" },
  { value: "2026-09-02", label: "2 сентября" },
  { value: "2026-09-03", label: "3 сентября" },
];

const GUESTS = [
  { value: "1", label: "1 гость" },
  { value: "2", label: "2 гостя" },
  { value: "3", label: "3 гостя" },
  { value: "4", label: "4 гостя" },
];

/** Высота строки колеса — та же константа, по которой колесо считает центр. */
const ROW = 48;

function openSheet() {
  const onSubmit = vi.fn();
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <PartySheet
        visible
        dateOptions={DATES}
        guestOptions={GUESTS}
        dateValue="2026-09-01"
        guestsValue="1"
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />
    </SafeAreaProvider>,
  );
  return { onSubmit };
}

/** Скроллер колеса: ScrollView в react-native-web — дед строки. */
function scrollerOf(rowLabel: string): HTMLElement {
  const row = screen.getByRole("button", { name: rowLabel });
  return row.parentElement?.parentElement as HTMLElement;
}

/** Прокрутка на `rows` строк вниз, как её видит react-native-web. */
function scrollTo(scroller: HTMLElement, rows: number) {
  // Сеттер jsdom для неотрисованного элемента — no-op, значение подставляем
  // сами. `writable` обязателен: колесо потом само пишет `scrollTop`, когда
  // едет на выбранное значение, и на read-only свойстве падало бы.
  Object.defineProperty(scroller, "scrollTop", {
    value: rows * ROW,
    configurable: true,
    writable: true,
  });
  fireEvent.scroll(scroller);
}

const consoleError = vi.spyOn(console, "error");
const unhandled = vi.fn();

beforeEach(() => {
  loadAttempts.mockClear();
  consoleError.mockClear();
  unhandled.mockClear();
  process.on("unhandledRejection", unhandled);
  // Событие прокрутки у react-native-web проходит через `scrollEventThrottle`
  // (16 мс): без управляемого времени второй и третий кадры отбрасываются.
  vi.useFakeTimers({ shouldAdvanceTime: false });
});

afterEach(() => {
  vi.useRealTimers();
  process.off("unhandledRejection", unhandled);
});

describe("шторка «Дата и гости» на сборке без expo-haptics", () => {
  it("поднимается целиком: заголовок, оба колеса, кнопка", () => {
    openSheet();

    expect(screen.getByText(t.explore.partySheetTitle)).toBeTruthy();
    expect(screen.getByLabelText(t.explore.partyDateColumn)).toBeTruthy();
    expect(screen.getByLabelText(t.explore.partyGuestsColumn)).toBeTruthy();
    expect(screen.getByRole("button", { name: "1 сентября" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "4 гостя" })).toBeTruthy();
    expect(screen.getByRole("button", { name: t.explore.partySubmit })).toBeTruthy();
  });

  it("колесо крутится и выбирает, вибрации при этом нет", async () => {
    const { onSubmit } = openSheet();
    const guests = scrollerOf("1 гость");

    // Три строки под центром подряд — три попытки щёлкнуть.
    expect(() => {
      scrollTo(guests, 1);
      vi.advanceTimersByTime(20);
      scrollTo(guests, 2);
      vi.advanceTimersByTime(20);
      scrollTo(guests, 3);
    }).not.toThrow();

    // Загрузка модуля — обещание; даём ему отработать вместе с таймерами.
    await vi.advanceTimersByTimeAsync(20);

    // Колесо ДОШЛО до вибрации: попытка загрузить модуль была. И ровно одна —
    // провал запоминается, а не повторяется на каждом кадре прокрутки.
    expect(loadAttempts).toHaveBeenCalledTimes(1);
    // А вибрации не случилось, и это единственное последствие: ни ошибки в
    // консоли, ни висящего отказа обещания.
    expect(consoleError).not.toHaveBeenCalled();
    expect(unhandled).not.toHaveBeenCalled();

    // Выбор живой: тап по строке меняет выбранное значение и уходит наверх
    // парой по кнопке.
    fireEvent.click(screen.getByRole("button", { name: "3 гостя" }));
    fireEvent.click(screen.getByRole("button", { name: "2 сентября" }));
    await vi.advanceTimersByTimeAsync(20);

    // Колесо переехало на выбранную строку (третья, отсчёт с нуля) — то есть
    // выбор дошёл до состояния, а не остался нажатием.
    expect(guests.scrollTop).toBe(2 * ROW);
    fireEvent.click(screen.getByRole("button", { name: t.explore.partySubmit }));
    expect(onSubmit).toHaveBeenCalledWith({ date: "2026-09-02", guests: "3" });

    expect(consoleError).not.toHaveBeenCalled();
    expect(unhandled).not.toHaveBeenCalled();
  });
});
