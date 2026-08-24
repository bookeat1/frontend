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

function bookingWith(status: BookingStatus): Booking {
  // Визит в будущем: у живых статусов кнопка точно должна быть, и разницу
  // делает именно статус, а не прошедшее время.
  const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
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

function renderScreen(status: BookingStatus) {
  booking = bookingWith(status);
  return render(<ReservationScreen />);
}

describe("экран брони: кнопка «Меню»", () => {
  it.each<BookingStatus>(["no_show", "cancelled", "completed"])(
    "не показывает «Меню» у брони со статусом %s",
    async (status) => {
      renderScreen(status);

      await waitFor(() => expect(screen.getByText(t.booking.backToHome)).toBeTruthy());
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

  it("«На главную» остаётся единственной кнопкой ряда и занимает его целиком", async () => {
    renderScreen("no_show");

    const home = await screen.findByRole("button", { name: t.booking.backToHome });
    // Ячейка кнопки (`flex: 1`) в ряду одна — значит, ряд она забирает весь,
    // а не половину, прижатую к краю.
    const row = home.parentElement?.parentElement;
    expect(row).toBeTruthy();
    expect(row?.children.length).toBe(1);
  });
});
