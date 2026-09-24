import type { Booking, BookingPayment, BookingStatus, Preorder, Restaurant } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReservationScreen from "../booking/[id]/index";

/**
 * Блок оплаты предзаказа на экране брони — теперь ТОЛЬКО точка входа
 * (Figma qmMsg4jO1ggmyEHNIAD2ll, узел 5390:8875): счёт, отсчёт, «я оплатил»
 * и уход в Kaspi переехали на `app/booking/[id]/payment.tsx` и проверяются
 * в `booking-payment-screen.test.tsx`. Этот файл проверяет только то, что
 * действительно рисует ЭТОТ экран:
 *
 *   1. когда блок оплаты вообще есть (гейт «подключено/пусто/терминально»);
 *   2. пока платёж можно (пере)начать — кнопка ведёт на полный экран, а не
 *      создаёт счёт сама;
 *   3. когда платёж уже settled (`paid`/`settling`) — вместо кнопки виден
 *      ЧЕК (`PreorderPaymentCard`), и на нём нет ни одной кнопки, способной
 *      создать второй счёт.
 *
 * Ломается это тихо и дорого: кнопка оплаты, оставшаяся после оплаты, — это
 * второй счёт на те же деньги.
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

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-in" }),
}));

vi.mock("../../src/lib/push", () => ({
  usePush: () => ({ support: { supported: false }, permission: "denied", request: vi.fn() }),
}));

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getMapPreviewUrl: () => "https://cdn.example/map.png" }),
}));

/** Заведение подменяется по тесту: подключение к приёму оплаты — это то, от
 * чего блок оплаты и зависит. `undefined` = деталка ещё не приехала. */
vi.mock("../../src/hooks/useRestaurant", () => ({
  useRestaurant: () => ({ data: restaurant, isLoading: false, isError: false }),
}));

let booking: Booking;
let preorder: Preorder | null;
let livePayment: BookingPayment | null;

vi.mock("../../src/hooks/useBooking", () => ({
  useBooking: () => ({ data: booking, isLoading: false, isError: false, refetch: vi.fn() }),
  usePreorder: () => ({ data: preorder, isLoading: false, isError: false }),
  useBookingPayment: () => ({ data: livePayment, isPending: false, isError: false }),
  useCancelBooking: () => ({ mutate: vi.fn(), isPending: false }),
}));

/** Поток оплаты подменяется целиком: экран отвечает за то, ЧТО он рисует в
 * каждой фазе, а не за то, как фаза считается (это проверено отдельно в
 * src/lib/__tests__/kaspi-payment.test.ts и src/hooks/__tests__). */
const flowState = {
  phase: "idle" as "idle" | "awaiting" | "settling" | "paid" | "dead",
  payment: null as BookingPayment | null,
  creating: false,
  error: null as unknown,
  now: Date.now(),
};
const pay = vi.fn();
const renew = vi.fn();
const check = vi.fn();

/** Аргументы, с которыми экран включает поток оплаты. `enabled: false` — это
 * не косметика: с ним не создаётся счёт и не идёт опрос, то есть у
 * неподключённого заведения живые деньги не трогаются вовсе. */
const flowEnabled: boolean[] = [];

vi.mock("../../src/hooks/useKaspiPayment", () => ({
  useTickingNow: () => Date.now(),
  useKaspiPaymentFlow: (input: { enabled: boolean }) => {
    flowEnabled.push(input.enabled);
    return { ...flowState, pay, renew, check };
  },
}));

let restaurant: Restaurant | undefined;

function venue(acceptsOnlinePayment: boolean): Restaurant {
  return { ...RESTAURANT, acceptsOnlinePayment };
}

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
    { id: "d-1", name: "Бешбармак", description: "", price: "4 990 ₸", priceMinor: 499_000, isTopPick: false },
  ],
  openingHoursText: "",
  schedule: null,
  tables: [],
  description: "",
  acceptsOnlineBookings: true,
  // Подключено к приёму оплаты. Значение по умолчанию фикстуры — «да»,
  // потому что остальные тесты файла разбирают гейт, а он бывает только у
  // заведения, которому вообще разрешено платить.
  acceptsOnlinePayment: true,
  paymentMethods: null,
  preorderMinAmountMinor: null,
  serviceFeeBps: null,
};

function bookingWith(status: BookingStatus): Booking {
  const startsAt = new Date(Date.now() + 3 * 24 * 3_600_000).toISOString();
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
    createdAt: null,
  };
}

function preorderWith(totalMinor: number): Preorder {
  return {
    bookingId: "b-1",
    items: [
      {
        id: "pi-1",
        menuItemId: "d-1",
        name: "Бешбармак",
        priceMinor: 499_000,
        quantity: 2,
        totalMinor: 998_000,
        comment: null,
      },
    ],
    totalMinor,
    currency: "KZT",
  };
}

function paymentWith(overrides: Partial<BookingPayment> = {}): BookingPayment {
  return {
    id: "pay-1",
    bookingId: "b-1",
    purpose: "preorder",
    status: "created",
    amountMinor: 998_000,
    currency: "KZT",
    paymentUrl: "https://pay.kaspi.kz/pay/abcdef",
    expiresAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  restaurant = venue(true);
  flowEnabled.length = 0;
  booking = bookingWith("confirmed");
  preorder = preorderWith(998_000);
  livePayment = null;
  flowState.phase = "idle";
  flowState.payment = null;
  flowState.creating = false;
  flowState.error = null;
  flowState.now = Date.now();
  pay.mockClear();
  renew.mockClear();
  check.mockClear();
  push.mockClear();
});

/** Правка владельца 2026-09-24 (макет 3073:11428): с экрана брони убраны блоки
 * «Предзаказ», «Изменить предзаказ» и «Оплата предзаказа» — оплата теперь только
 * шторкой `booking/[id]/payment` (см. `booking-payment-screen.test.tsx`). */
/** Большого блока «Оплата предзаказа» на экране брони нет (макет 3073:11428).
 * Остаются только компактный вход в оплату (нет платежа) и компактный блок
 * «Предзаказ» после оплаты (правка владельца 2026-09-24). */
describe("экран брони не показывает большой блок предзаказа/оплаты", () => {
  it.each<[string, () => void, { payButton: boolean; dishes: boolean }]>([
    ["живая бронь с предзаказом, заведение принимает оплату", () => {}, { payButton: true, dishes: false }],
    ["предзаказ уже оплачен", () => {
      livePayment = paymentWith({ status: "captured" });
      flowState.phase = "paid";
      flowState.payment = paymentWith({ status: "captured" });
    }, { payButton: false, dishes: true }],
    ["платёж дожимается", () => {
      flowState.phase = "settling";
      flowState.payment = paymentWith({ status: "captured" });
    }, { payButton: true, dishes: false }],
  ])("%s", async (_name, arrange, expected) => {
    arrange();
    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(/Что дальше/)).toBeTruthy());
    expect(screen.queryByText(t.booking.paymentSectionTitle)).toBeNull();
    expect(screen.queryByText(t.booking.preorderEdit)).toBeNull();
    expect(screen.queryByText(t.booking.preorderAdd)).toBeNull();
    expect(screen.queryByText(t.booking.preorderSummaryTitle)).toBeNull();
    expect(screen.queryByText(/Бешбармак/) !== null).toBe(expected.dishes);
    expect(screen.queryByRole("button", { name: /Оплатить/ }) !== null).toBe(expected.payButton);
    expect(screen.queryByText(/Стол держим/)).toBeNull();
  });
});
