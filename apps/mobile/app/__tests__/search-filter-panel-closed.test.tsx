import type { RestaurantRepository } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchScreen from "../search";

/**
 * Каталог открывается со ЗАКРЫТОЙ панелью фильтров — всегда.
 *
 * Раньше переход с главной мог раскрыть её сразу (параметр маршрута `focus`,
 * 24.08): человек нажимал на главной «2 гостя» и попадал в шторку со всеми
 * фасетами. Убрано 26.08 по правке владельца — «он нагружен и мы пугаем
 * пользователей». День и компанию он теперь называет шторкой с колесом прямо
 * на главной, а сюда приходит к готовой выдаче.
 *
 * Проверяем: подбор с главной ПРИМЕНЁН (чип над выдачей это показывает), но ни
 * шторки, ни колеса на экране нет; открыть фильтры по-прежнему можно кнопкой.
 * Отдельно — что старый параметр `focus` больше ничего не раскрывает: ссылки с
 * ним могли остаться снаружи, и вести они должны в обычный каталог, а не в
 * панель.
 */

const t = getDictionary("ru");

const push = vi.fn();
let params: Record<string, string> = {};

// Шторка фильтров с 2026-08-27 содержит `TimeOfDayChips`, а он читает словарь
// из контекста (`useLocale`), которого в тесте экрана нет. Тот же приём, что в
// home-party-handoff.test.tsx.
vi.mock("../../src/lib/locale", async () => {
  const { getDictionary } = await import("@bookeat/i18n");
  return { useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }) };
});

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn(), canGoBack: () => false }),
  usePathname: () => "/search",
  useLocalSearchParams: () => params,
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const searchRestaurants = vi.fn(async () => ({ items: [], total: 0 }));
const getCuisines = vi.fn(async () => []);
const getCities = vi.fn(async () => []);

vi.mock("../../src/lib/repository", () => ({
  useRepository: () =>
    ({ searchRestaurants, getCuisines, getCities }) as unknown as RestaurantRepository,
}));

function renderSearch() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SearchScreen />
    </QueryClientProvider>,
  );
}

/** Ничего из панели фильтров не видно: ни она сама, ни колёса внутри неё. */
function expectPanelClosed() {
  expect(screen.queryByText(t.search.filters.title)).toBeNull();
  expect(screen.queryByText(t.booking.pickDateTitle)).toBeNull();
  expect(screen.queryByText(t.booking.pickGuestsTitle)).toBeNull();
}

// «Сегодня» для чипа даты экран берёт с системных часов (`dateChoices(new
// Date())` в `search.tsx`), а подпись у дня ОТНОСИТЕЛЬНАЯ: 3 сентября 4-е
// зовётся «Завтра», со 2-го и раньше — «пт, 4 сентября», а после 4-го оно
// выпадает из колеса и печатается «4 сентября» без дня недели. Без прибитых
// часов тест зелёный только в окно между днём написания и 2 сентября 19:00 UTC
// (полночь Алматы) — так он и краснел «в зависимости от времени суток».
// Часы фиксируем на день, когда 4 сентября — обычный день колеса, не
// сегодня и не завтра; проверяемая подпись от этого дня не зависит.
const FIXED_NOW = new Date("2026-09-01T12:00:00+05:00");

// beforeEach, а не beforeAll: общий vitest.setup.ts делает vi.useRealTimers()
// в afterEach, и подмена на весь файл дожила бы только до конца первого теста.
beforeEach(() => {
  params = {};
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(FIXED_NOW);
});

describe("панель фильтров при переходе с главной", () => {
  it("выбор с главной применён, но панель закрыта", async () => {
    params = { guests: "4", date: "2026-09-04" };
    renderSearch();

    // Подбор реально ушёл в запрос — это не «параметры молча потерялись».
    await waitFor(() =>
      expect(searchRestaurants).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            availability: { date: "2026-09-04", guests: 4 },
          }),
        }),
      ),
    );
    // ...и виден над выдачей ДВУМЯ чипами — датой и гостями (макет 347:5942).
    expect(screen.getByText("пт, 4 сентября")).toBeTruthy();
    expect(screen.getByText(t.booking.guestsCount(4))).toBeTruthy();
    expectPanelClosed();
  });

  it("старый параметр focus больше ничего не раскрывает", async () => {
    params = { guests: "2", date: "2026-09-04", focus: "guests" };
    renderSearch();

    await waitFor(() => expect(searchRestaurants).toHaveBeenCalled());
    expectPanelClosed();
  });

  it("без параметров — обычный каталог", async () => {
    renderSearch();

    await waitFor(() => expect(searchRestaurants).toHaveBeenCalled());
    expectPanelClosed();
  });

  it("фильтры по-прежнему открываются кнопкой-ползунками", async () => {
    params = { guests: "4", date: "2026-09-04" };
    renderSearch();
    const user = userEvent.setup();

    // Имя кнопки меняется, когда что-то выбрано («…, выбрано: N»), поэтому
    // ищем по началу подписи: тесту важна сама кнопка, а не счётчик.
    await user.click(screen.getByRole("button", { name: /^Открыть фильтры/ }));

    expect(await screen.findByText(t.search.filters.title)).toBeTruthy();
    // И это СПИСОК фильтров, а не сразу колесо даты.
    expect(screen.queryByText(t.booking.pickDateTitle)).toBeNull();
  });
});
