import type { Restaurant } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingDraftProvider } from "../../src/lib/booking-draft";
import { addDays, toDateKey } from "../../src/lib/format";
import ReservationScreen from "../restaurant/[id]/book/index";

/**
 * Дата и число гостей на экране брони выбираются НИЖНЕЙ ШТОРКОЙ.
 *
 * Что чинится этим тестом (правка владельца 26.08.2026): тап по пиллу
 * «Сегодня ⌄» уводил на отдельный экран `book/date` (календарь на месяц), а
 * тап по «2 гостя ⌄» — на `book/guests` (степпер с кружками). Ни того, ни
 * другого экрана в дизайне нет; поведение должно быть таким же, как на
 * главной, — колесо в шторке поверх текущего экрана.
 *
 * Проверяем три вещи, и вторая — главная:
 *   1. тап поднимает ШТОРКУ и НИКУДА не переходит (`push` не вызывается);
 *   2. выбранное шторкой попадает в ТО ЖЕ состояние, которым управляет ряд
 *      быстрых плиток дней сверху: после «Готово» подсвечена плитка
 *      выбранного дня. Если шторка заведёт своё состояние, два контрола на
 *      одном экране начнут показывать разные дни;
 *   3. потолок числа гостей и предупреждение про банкет, которые жили на
 *      удалённом экране, из шторки не пропали.
 */

const t = getDictionary("ru");

const push = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ id: "r-1" }),
  usePathname: () => "/restaurant/r-1/book",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-in", user: null }),
}));

vi.mock("../../src/lib/analytics", () => ({ trackEvent: vi.fn() }));

const RESTAURANT = {
  id: "r-1",
  name: "Тестовое заведение",
  address: "ул. Абая, 1",
  acceptsOnlineBookings: true,
  menuHighlights: [],
} as unknown as Restaurant;

vi.mock("../../src/hooks/useRestaurant", () => ({
  useRestaurant: () => ({ data: RESTAURANT, isLoading: false, isError: false }),
}));

// Слоты к выбору даты отношения не имеют, но без них экран показал бы пустое
// состояние, и его кнопка «Другая дата» подменила бы собой проверяемый пилл.
vi.mock("../../src/hooks/useBooking", () => ({
  useAvailability: () => ({
    data: {
      slots: [
        {
          startsAt: "2026-08-26T19:00:00+05:00",
          endsAt: "2026-08-26T21:00:00+05:00",
          available: true,
          freeTables: 2,
        },
      ],
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

function renderBooking() {
  return render(
    <BookingDraftProvider restaurantId="r-1" prefill={{}}>
      <ReservationScreen />
    </BookingDraftProvider>,
  );
}

const datePill = (value: string) =>
  screen.getByRole("button", { name: `${t.booking.dateSectionTitle}: ${value}` });
const guestsPill = (value: string) =>
  screen.getByRole("button", { name: `${t.booking.guestsSectionTitle}: ${value}` });
/** Плитка дня в быстром ряду сверху: «Завтра, 27». */
const dayTile = (caption: string, date: Date) =>
  screen.getByRole("tab", { name: `${caption}, ${date.getDate()}` });

beforeEach(() => {
  push.mockClear();
});

describe("выбор даты и гостей на экране брони", () => {
  it("тап по дате поднимает шторку с колесом и никуда не уводит", async () => {
    renderBooking();
    const user = userEvent.setup();

    expect(screen.queryByText(t.booking.pickDateTitle)).toBeNull();

    await user.click(datePill(t.booking.today));

    expect(await screen.findByText(t.booking.pickDateTitle)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("выбранная в шторке дата попадает в то же состояние, что и быстрые плитки", async () => {
    renderBooking();
    const user = userEvent.setup();
    const tomorrow = addDays(new Date(), 1);

    // Исходно подсвечен сегодняшний день — плиткой, а не шторкой.
    expect(dayTile(t.booking.today, new Date()).getAttribute("aria-selected")).toBe("true");
    expect(dayTile(t.booking.tomorrow, tomorrow).getAttribute("aria-selected")).toBe("false");

    await user.click(datePill(t.booking.today));
    await screen.findByText(t.booking.pickDateTitle);
    // Строка колеса «Завтра» — не плитка: у плитки в подписи есть ещё число.
    await user.click(screen.getByRole("button", { name: t.booking.tomorrow }));
    await user.click(screen.getByRole("button", { name: t.search.availabilityDone }));

    await waitFor(() =>
      expect(dayTile(t.booking.tomorrow, tomorrow).getAttribute("aria-selected")).toBe("true"),
    );
    expect(dayTile(t.booking.today, new Date()).getAttribute("aria-selected")).toBe("false");
    // И сам пилл показывает то же самое — один источник на оба контрола.
    expect(datePill(t.booking.tomorrow)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    // Дата в черновике — ключ завтрашнего дня, а не что-то своё у шторки.
    expect(toDateKey(tomorrow)).not.toBe(toDateKey(new Date()));
  });

  it("тап по гостям поднимает шторку и сохраняет предупреждение про банкет", async () => {
    renderBooking();
    const user = userEvent.setup();

    await user.click(guestsPill(t.booking.guestsCount(2)));

    expect(await screen.findByText(t.booking.pickGuestsTitle)).toBeTruthy();
    // Потолок 20 и объяснение, что выше него — банкет: это жило на удалённом
    // экране «Сколько гостей» и обязано было переехать в шторку.
    expect(screen.getByText(t.booking.guestsHint(20))).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.booking.guestsCount(21) })).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("выбранное число гостей применяется по «Готово», а не по прокрутке", async () => {
    renderBooking();
    const user = userEvent.setup();

    await user.click(guestsPill(t.booking.guestsCount(2)));
    await screen.findByText(t.booking.pickGuestsTitle);
    await user.click(screen.getByRole("button", { name: t.booking.guestsCount(6) }));

    // Пока не нажали «Готово», пилл показывает прежнее значение.
    expect(guestsPill(t.booking.guestsCount(2))).toBeTruthy();

    await user.click(screen.getByRole("button", { name: t.search.availabilityDone }));

    await waitFor(() => expect(guestsPill(t.booking.guestsCount(6))).toBeTruthy());
    expect(push).not.toHaveBeenCalled();
  });
});
