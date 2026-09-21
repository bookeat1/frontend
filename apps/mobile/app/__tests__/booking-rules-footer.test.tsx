import type { Booking, BookingStatus, EffectiveBookingRules, Restaurant } from "@bookeat/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReservationScreen from "../booking/[id]/index";

/**
 * Trello BNjLdfSP (bookeat-backend PR #143): подвал «Явные правила брони» на
 * экране брони, сразу под «Что дальше?». Источник — `booking.bookingRules`
 * (вложенный `booking_rules` на `GET /bookings/:id`), НЕ заведение — сервер
 * специально кладёт уже разрешённые правила прямо в бронь, чтобы экрану не
 * был нужен второй запрос. `startsAt` фиксирован (не относительный) —
 * `vitest.setup.ts` пиннит `TZ=Asia/Almaty`, так что `14:30Z` печатается как
 * `19:30` детерминированно, тем же способом, что и в `apps/web` тесте того
 * же подвала.
 */

const push = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), canGoBack: () => false }),
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

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getMapPreviewUrl: () => "https://cdn.example/map.png" }),
}));

let restaurant: Restaurant;

vi.mock("../../src/hooks/useRestaurant", () => ({
  useRestaurant: () => ({ data: restaurant, isLoading: false, isError: false }),
}));

const BASE_RESTAURANT: Restaurant = {
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
  menuHighlights: [],
  openingHoursText: "",
  schedule: null,
  tables: [],
  description: "",
  acceptsOnlineBookings: true,
  acceptsOnlinePayment: false,
  preorderMinAmountMinor: null,
};

function bookingWith(
  status: BookingStatus,
  bookingRules: EffectiveBookingRules | null = null,
): Booking {
  return {
    id: "b-1",
    restaurantId: "r-1",
    name: "Дамир",
    phone: "+77078692233",
    guests: 2,
    // 14:30Z → 19:30 по Алматы (см. комментарий вверху файла).
    startsAt: "2026-08-25T14:30:00Z",
    endsAt: "2026-08-25T16:00:00Z",
    status,
    notes: null,
    freeCancelDeadline: null,
    createdAt: null,
    bookingRules,
  };
}

function withQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

function renderScreen(status: BookingStatus, bookingRules: EffectiveBookingRules | null = null) {
  booking = bookingWith(status, bookingRules);
  return render(withQueryClient(<ReservationScreen />));
}

beforeEach(() => {
  push.mockClear();
  restaurant = BASE_RESTAURANT;
});

describe("подвал «Явные правила брони» (Trello BNjLdfSP)", () => {
  it("бронь без booking_rules (старый сервер/резолвер не сработал) — клиент подставляет платформенные дефолты", async () => {
    renderScreen("confirmed", null);

    expect(
      await screen.findByText(
        "Стол держим 15 минут после 19:30. Опаздываете — позвоните в заведение. Бесплатная отмена — до 17:30.",
      ),
    ).toBeTruthy();
  });

  it("сервер прислал разрешённые правила — экран показывает их, не платформенный дефолт", async () => {
    renderScreen("confirmed", {
      holdMinutes: 30,
      freeCancelHours: 4,
      lateArrivalText: "Задерживаетесь — напишите нам в WhatsApp.",
    });

    expect(
      await screen.findByText(
        "Стол держим 30 минут после 19:30. Задерживаетесь — напишите нам в WhatsApp. Бесплатная отмена — до 15:30.",
      ),
    ).toBeTruthy();
  });

  it.each<BookingStatus>(["cancelled", "no_show", "completed"])(
    "у брони со статусом %s подвала нет: держать стол уже нечего",
    async (status) => {
      renderScreen(status);

      await screen.findByText(/Что дальше/);
      expect(screen.queryByText(/Стол держим/)).toBeNull();
    },
  );
});
