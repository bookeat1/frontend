import type { Booking, BookingPayment, Preorder, Restaurant } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReservationScreen from "../booking/[id]/index";
import { formatMoneyMinor } from "../../src/lib/format";

/**
 * Экран брони: вход обратно в оплату предзаказа (гость закрыл шторку) и
 * пометка/блок «Предзаказ оплачен». Статус брони (подтверждение рестораном)
 * при этом не меняется.
 */

const t = getDictionary("ru");
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
vi.mock("../../src/lib/auth", () => ({ useAuth: () => ({ status: "signed-in" }) }));
vi.mock("../../src/lib/push", () => ({
  usePush: () => ({ support: { supported: false }, permission: "denied", request: vi.fn() }),
}));
vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getMapPreviewUrl: () => "https://cdn.example/map.png" }),
}));

let booking: Booking;
let preorder: Preorder;
let payment: BookingPayment | null;
let restaurant: Restaurant;

vi.mock("../../src/hooks/useBooking", () => ({
  useBooking: () => ({ data: booking, isPending: false, isError: false, refetch: vi.fn() }),
  usePreorder: () => ({ data: preorder, isPending: false, isError: false }),
  useBookingPayment: () => ({ data: payment, isPending: false, isError: false }),
  useCancelBooking: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../src/hooks/useRestaurant", () => ({
  useRestaurant: () => ({ data: restaurant, isLoading: false, isError: false }),
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
  acceptsOnlinePayment: true,
  paymentMethods: null,
  preorderMinAmountMinor: null,
  serviceFeeBps: null,
  paymentFee: { rateBps: 350, minFeeMinor: 2500 },
};

const livePayment = (over: Partial<BookingPayment> = {}): BookingPayment => ({
  id: "pay-1",
  bookingId: "b-1",
  purpose: "preorder",
  status: "created",
  amountMinor: 362_695,
  currency: "KZT",
  paymentUrl: "https://pay.kaspi.kz/pay/abc",
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  ...over,
});

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReservationScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  push.mockClear();
  const startsAt = new Date(Date.now() + 3 * 24 * 3_600_000).toISOString();
  booking = {
    id: "b-1",
    restaurantId: "r-1",
    name: "Дамир",
    phone: "+77078692233",
    guests: 2,
    startsAt,
    endsAt: startsAt,
    status: "pending",
    notes: null,
    freeCancelDeadline: null,
    createdAt: null,
  };
  preorder = {
    bookingId: "b-1",
    items: [
      { id: "pi-1", menuItemId: "d-1", name: "Бешбармак", priceMinor: 175_000, quantity: 2, totalMinor: 350_000, comment: null },
    ],
    totalMinor: 350_000,
    currency: "KZT",
  };
  payment = null;
  restaurant = { ...RESTAURANT };
});

describe("экран брони: оплата предзаказа", () => {
  it("живая ссылка — «Ждём оплату · осталось мм:сс» и «Оплатить N» открывает шторку", async () => {
    payment = livePayment();
    renderScreen();
    await waitFor(() => expect(screen.getByTestId("preorder-pay-entry")).toBeTruthy());
    expect(screen.getByText(/Ждём оплату предзаказа · осталось \d\d:\d\d/)).toBeTruthy();
    screen.getByRole("button", { name: t.booking.paymentPayAmount(formatMoneyMinor(362_695)) }).click();
    expect(push).toHaveBeenCalledWith({ pathname: "/booking/[id]/payment", params: { id: "b-1" } });
  });

  it("платежа нет, платить можно — «Предзаказ ещё не оплачен», сумма с предпросмотром сбора", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText(t.booking.paymentEntryUnpaid)).toBeTruthy());
    expect(screen.getByRole("button", { name: t.booking.paymentPayAmount(formatMoneyMinor(362_695)) })).toBeTruthy();
  });

  it("заведение без онлайн-оплаты — входа нет", async () => {
    restaurant = { ...RESTAURANT, acceptsOnlinePayment: false };
    renderScreen();
    await waitFor(() => expect(screen.getByText(t.booking.status.pending)).toBeTruthy());
    expect(screen.queryByTestId("preorder-pay-entry")).toBeNull();
  });

  it("оплачено — пометка рядом со статусом брони и блок «Предзаказ», входа на оплату нет", async () => {
    payment = livePayment({ status: "captured", baseAmountMinor: 350_000, feeMinor: 12_695 });
    renderScreen();
    await waitFor(() => expect(screen.getByTestId("preorder-paid-pill")).toBeTruthy());
    // Статус брони остаётся про подтверждение рестораном.
    expect(screen.getByText(t.booking.status.pending)).toBeTruthy();
    expect(screen.getByTestId("preorder-paid-block").textContent).toContain("2 × Бешбармак");
    expect(screen.getByTestId("preorder-paid-total").textContent).toBe(formatMoneyMinor(362_695));
    expect(screen.getByText(t.booking.paymentBreakdownFee)).toBeTruthy();
    expect(screen.queryByTestId("preorder-pay-entry")).toBeNull();
  });
});
