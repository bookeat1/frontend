import type { Booking, BookingStatus, Restaurant } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReservationScreen from "../booking/[id]/index";

/**
 * Кнопка «Меню» на экране брони.
 *
 * У брони, из которой уже никуда не перейти («Не пришли», «Отменена»,
 * «Завершена»), предзаказывать нечего: сервер такой предзаказ не примет
 * (`bookingTransitions` в backend-core/internal/domain/booking.go — у этих
 * трёх статусов набор целей пустой). Красная кнопка рядом с «Не пришли»
 * обещала действие, которого не будет (правка владельца 24.08.2026).
 *
 * Ломается это тихо: экран останется рабочим, кнопка просто уведёт человека
 * в меню, из которого он ничего не сможет добавить.
 */

const t = getDictionary("ru");

const push = vi.fn();
const replace = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, replace, back: vi.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ id: "b-1" }),
  usePathname: () => "/booking/b-1",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-in" }),
}));

// Карточка «включить уведомления» тянет expo-notifications через `src/lib/push`,
// а он в jsdom падает на expo-modules-core («Cannot read properties of
// undefined (reading 'EventEmitter')»). К кнопке «Меню» она отношения не имеет.
vi.mock("../../src/lib/push", () => ({
  usePush: () => ({ support: { supported: false }, permission: "denied", request: vi.fn() }),
}));

let booking: Booking;

vi.mock("../../src/hooks/useBooking", () => ({
  useBooking: () => ({ data: booking, isLoading: false, isError: false, refetch: vi.fn() }),
  usePreorder: () => ({ data: null, isLoading: false, isError: false }),
  useBookingPayment: () => ({ data: null, isPending: false, isError: false }),
  useCancelBooking: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Карточка контактов рисует превью карты и берёт его адрес из репозитория.
// Заведение в фикстуре без координат, но провайдер контекста экрану всё равно
// нужен — иначе `useRepository` бросает.
vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getMapPreviewUrl: () => "https://cdn.example/map.png" }),
}));

vi.mock("../../src/hooks/useRestaurant", () => ({
  useRestaurant: () => ({ data: RESTAURANT, isLoading: false, isError: false }),
}));

/** Заведение С МЕНЮ: без блюд кнопка скрыта и так, и тест ничего бы не доказал. */
const RESTAURANT: Restaurant = {
  id: "r-1",
  name: "Mongol",
  cuisines: [],
  priceLevel: "₸₸",
  rating: 4.8,
  reviewsCount: 12,
  address: "Достык 1",
  city: "Алматы",
  photos: [],
  promoBanners: [],
  menuHighlights: [
    { id: "d-1", name: "Бешбармак", description: "", price: "4 990 ₸" },
  ],
  openingHoursText: "",
  schedule: null,
  tables: [],
  description: "",
  acceptsOnlineBookings: true,
};

function bookingWith(status: BookingStatus, when: "future" | "past" = "future"): Booking {
  // По умолчанию визит в будущем: у живых статусов кнопка точно должна быть, и
  // разницу делает именно статус, а не прошедшее время. `past` нужен «истёкшей»
  // брони — у неё живой статус, но время визита уже позади.
  const offset = when === "future" ? 3 : -3;
  const startsAt = new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: "b-1",
    restaurantId: "r-1",
    name: "Дамир",
    phone: "+77078692233",
    guests: 2,
    startsAt,
    endsAt: startsAt,
    status,
    notes: null,
    freeCancelDeadline: null,
  };
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
});

function renderScreen(status: BookingStatus, when: "future" | "past" = "future") {
  booking = bookingWith(status, when);
  return render(<ReservationScreen />);
}

describe("экран брони: кнопка «Меню»", () => {
  it.each<BookingStatus>(["no_show", "cancelled", "completed"])(
    "не показывает «Меню» у брони со статусом %s",
    async (status) => {
      renderScreen(status);

      // У «Завершена» остаётся «На главную», у «Отменена»/«Не пришли» —
      // «Забронировать снова»; проверяем, что ряд отрисовался, любой из двух.
      await waitFor(() =>
        expect(
          screen.queryByText(t.booking.backToHome) ?? screen.queryByText(t.booking.bookAgain),
        ).toBeTruthy(),
      );
      expect(screen.queryByRole("button", { name: t.booking.openMenu })).toBeNull();
    },
  );

  it.each<BookingStatus>(["pending", "confirmed", "waitlist", "arrived"])(
    "оставляет «Меню» живой брони со статусом %s",
    async (status) => {
      renderScreen(status);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: t.booking.openMenu })).toBeTruthy(),
      );
    },
  );

  it("единственная кнопка ряда занимает его целиком", async () => {
    renderScreen("no_show");

    const home = await screen.findByRole("button", { name: t.booking.bookAgain });
    // Ячейка кнопки (`flex: 1`) в ряду одна — значит, ряд она забирает весь,
    // а не половину, прижатую к краю.
    const row = home.parentElement?.parentElement;
    expect(row).toBeTruthy();
    expect(row?.children.length).toBe(1);
  });
});

/**
 * «Забронировать снова» вместо «На главную» (правка владельца 2026-08-26).
 *
 * Условие — бронь, которой уже не будет: отменена, гость не пришёл, либо время
 * визита прошло, а бронь так и осталась неподтверждённой («истекла»).
 * Отдельного статуса `expired` у бэкенда НЕТ — см. `isRebookableBooking` в
 * packages/api/src/types.ts, — поэтому «истекла» проверяется временем.
 *
 * Если это сломать, экран не упадёт: человек из несостоявшейся брони просто
 * уедет на главную и будет искать тот же ресторан заново.
 */
describe("экран брони: «Забронировать снова»", () => {
  it.each<BookingStatus>(["cancelled", "no_show"])(
    "заменяет «На главную» у брони со статусом %s",
    async (status) => {
      renderScreen(status);

      expect(await screen.findByRole("button", { name: t.booking.bookAgain })).toBeTruthy();
      expect(screen.queryByText(t.booking.backToHome)).toBeNull();
    },
  );

  it.each<BookingStatus>(["pending", "waitlist", "confirmed"])(
    "заменяет «На главную» у ИСТЁКШЕЙ брони со статусом %s (время визита прошло)",
    async (status) => {
      renderScreen(status, "past");

      expect(await screen.findByRole("button", { name: t.booking.bookAgain })).toBeTruthy();
      expect(screen.queryByText(t.booking.backToHome)).toBeNull();
    },
  );

  it.each<BookingStatus>(["pending", "waitlist", "confirmed", "arrived"])(
    "не трогает «На главную» у живой брони со статусом %s",
    async (status) => {
      renderScreen(status);

      expect(await screen.findByRole("button", { name: t.booking.backToHome })).toBeTruthy();
      expect(screen.queryByText(t.booking.bookAgain)).toBeNull();
    },
  );

  it("состоявшийся визит («Завершена») остаётся с «На главную»", async () => {
    // Удачный ужин — не несостоявшаяся бронь: «снова» здесь предлагает не
    // замену, а повтор, и это другое решение владельца.
    renderScreen("completed", "past");

    expect(await screen.findByRole("button", { name: t.booking.backToHome })).toBeTruthy();
    expect(screen.queryByText(t.booking.bookAgain)).toBeNull();
  });

  it("ведёт в бронирование ТОГО ЖЕ заведения, а не на главную", async () => {
    renderScreen("cancelled");

    const button = await screen.findByRole("button", { name: t.booking.bookAgain });
    button.click();

    expect(replace).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith({
      pathname: "/restaurant/[id]/book",
      params: { id: "r-1" },
    });
  });
});
