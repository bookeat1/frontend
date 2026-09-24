import type { Booking, Restaurant } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Блок «Хотите отменить?» на экране брони пропадает целиком, как только
 * время визита наступило — независимо от статуса. Раньше блок был виден,
 * пока сервер не перевёл статус в терминальный, даже когда визит уже шёл или
 * закончился (кнопка внутри уже была выключена, но сам блок оставался).
 *
 * Отдельно от `booking-cancel-analytics.test.tsx` (тот проверяет успешную
 * отмену БУДУЩЕЙ брони) и от `cancel-block.test.ts` (юнит на чистые функции)
 * — здесь проверяется именно рендер целого блока на живом экране.
 */

const t = getDictionary("ru");

const HOUR = 60 * 60 * 1000;

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ id: "b-1" }),
  usePathname: () => "/booking/b-1",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/lib/auth", () => ({ useAuth: () => ({ status: "signed-in" }) }));

vi.mock("../../src/lib/push", () => ({
  usePush: () => ({ support: { supported: false }, permission: "denied", request: vi.fn() }),
}));

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getMapPreviewUrl: () => "https://cdn.example/map.png" }),
}));

vi.mock("../../src/hooks/useRestaurant", () => ({
  useRestaurant: () => ({ data: RESTAURANT, isLoading: false, isError: false }),
}));

vi.mock("../../src/hooks/useBooking", () => ({
  useBooking: () => ({ data: booking, isLoading: false, isError: false, refetch: vi.fn() }),
  usePreorder: () => ({ data: null, isLoading: false, isError: false }),
  useBookingPayment: () => ({ data: null, isPending: false, isError: false }),
  useCancelBooking: () => ({ mutate: vi.fn(), isPending: false }),
}));

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
  menuHighlights: [],
  openingHoursText: "",
  schedule: null,
  tables: [],
  description: "",
  acceptsOnlineBookings: true,
  acceptsOnlinePayment: false,
  preorderMinAmountMinor: null,
  serviceFeeBps: null,
};

let booking: Booking;

const { default: ReservationScreen } = await import("../booking/[id]/index");

function withQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

beforeEach(() => {
  booking = {
    id: "b-1",
    restaurantId: "r-1",
    name: "Дамир",
    phone: "+77078692233",
    guests: 2,
    startsAt: new Date(Date.now() + 24 * HOUR).toISOString(),
    endsAt: new Date(Date.now() + 26 * HOUR).toISOString(),
    status: "confirmed",
    notes: null,
    freeCancelDeadline: new Date(Date.now() + 20 * HOUR).toISOString(),
    createdAt: new Date(Date.now() - 48 * HOUR).toISOString(),
  };
});

describe("блок отмены на экране брони пропадает после начала визита", () => {
  it("визит в будущем, статус живой: блок отмены на месте", async () => {
    render(withQueryClient(<ReservationScreen />));

    expect(await screen.findByText(t.booking.cancelSectionTitle)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.booking.cancelBooking })).toBeTruthy();
  });

  it("визит уже начался, статус остался confirmed: блока нет вовсе", async () => {
    booking = {
      ...booking,
      status: "confirmed",
      startsAt: new Date(Date.now() - 1 * HOUR).toISOString(),
      endsAt: new Date(Date.now() + 1 * HOUR).toISOString(),
    };
    render(withQueryClient(<ReservationScreen />));

    // Заведомо присутствующий элемент экрана — подтверждает, что рендер уже
    // осел, прежде чем проверять отсутствие блока отмены.
    await screen.findByText(RESTAURANT.name);

    expect(screen.queryByText(t.booking.cancelSectionTitle)).toBeNull();
    expect(screen.queryByRole("button", { name: t.booking.cancelBooking })).toBeNull();
  });

  it("визит уже начался, гость arrived: блока тоже нет", async () => {
    booking = {
      ...booking,
      status: "arrived",
      startsAt: new Date(Date.now() - 2 * HOUR).toISOString(),
      endsAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
    render(withQueryClient(<ReservationScreen />));
    await screen.findByText(RESTAURANT.name);

    expect(screen.queryByText(t.booking.cancelSectionTitle)).toBeNull();
  });

  it("статус pending, но до визита остаётся минута: блок ещё есть (кнопка выключена окном)", async () => {
    booking = {
      ...booking,
      status: "pending",
      startsAt: new Date(Date.now() + 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 2 * HOUR).toISOString(),
    };
    render(withQueryClient(<ReservationScreen />));

    expect(await screen.findByText(t.booking.cancelSectionTitle)).toBeTruthy();
    const button = screen.getByRole("button", { name: t.booking.cancelBooking });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(t.booking.cancelWindowClosed)).toBeTruthy();
  });
});
