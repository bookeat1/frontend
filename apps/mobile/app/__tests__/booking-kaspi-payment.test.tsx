import type { Booking, BookingPayment, BookingStatus, Preorder, Restaurant } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReservationScreen from "../booking/[id]/index";
import { formatMoneyMinor } from "../../src/lib/format";

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

describe("когда блок оплаты вообще есть", () => {
  it("живая бронь с предзаказом — точка входа в оплату на месте, с суммой", async () => {
    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentSectionTitle)).toBeTruthy());
    expect(
      screen.getByRole("button", {
        name: t.booking.paymentEntryCta(formatMoneyMinor(998_000)),
      }),
    ).toBeTruthy();
  });

  it("предзаказа нет — блока нет: платить не за что", async () => {
    preorder = null;
    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.preorderSectionTitle)).toBeTruthy());
    expect(screen.queryByText(t.booking.paymentSectionTitle)).toBeNull();
  });

  it.each<BookingStatus>(["cancelled", "no_show", "completed"])(
    "бронь %s — блока нет: сервер такой платёж всё равно не примет",
    async (status) => {
      booking = bookingWith(status);
      render(<ReservationScreen />);
      await waitFor(() => expect(screen.getByText(t.booking.title)).toBeTruthy());
      expect(screen.queryByText(t.booking.paymentSectionTitle)).toBeNull();
    },
  );
});

describe("точка входа ведёт на полный экран, а не создаёт счёт сама", () => {
  it.each<"idle" | "awaiting" | "dead">(["idle", "awaiting", "dead"])(
    "фаза %s — кнопка одна, и она про навигацию",
    async (phase) => {
      flowState.phase = phase;
      if (phase !== "idle") flowState.payment = paymentWith({ status: phase === "dead" ? "expired" : "created" });

      render(<ReservationScreen />);
      const button = await screen.findByRole("button", {
        name: t.booking.paymentEntryCta(formatMoneyMinor(998_000)),
      });
      button.click();
      expect(push).toHaveBeenCalledWith({
        pathname: "/booking/[id]/payment",
        params: { id: "b-1" },
      });
      // Счёт отсюда не создаётся и не обновляется вовсе — это дело полного
      // экрана оплаты.
      expect(pay).not.toHaveBeenCalled();
      expect(renew).not.toHaveBeenCalled();
    },
  );
});

describe("оплата видна только там, где заведение к ней подключено", () => {
  it("заведение принимает оплату — блок на месте, точка входа есть", async () => {
    restaurant = venue(true);
    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentSectionTitle)).toBeTruthy());
    expect(
      screen.getByRole("button", { name: t.booking.paymentEntryCta(formatMoneyMinor(998_000)) }),
    ).toBeTruthy();
    expect(flowEnabled.every((v) => v === true)).toBe(true);
  });

  it("заведение оплату НЕ принимает — блока нет вовсе", async () => {
    restaurant = venue(false);
    render(<ReservationScreen />);
    // Экран отрисовался целиком: без этого «блока нет» доказывало бы лишь то,
    // что мы измерили пустую страницу.
    await waitFor(() => expect(screen.getByText(t.booking.preorderSectionTitle)).toBeTruthy());
    expect(screen.queryByText(t.booking.paymentSectionTitle)).toBeNull();
    expect(flowEnabled.every((v) => v === false)).toBe(true);
  });

  it("деталка заведения ещё не приехала — оплату не предлагаем", async () => {
    restaurant = undefined;
    render(<ReservationScreen />);
    // Без деталки заведения на экране нет и блока предзаказа (он живёт на
    // меню), поэтому «экран отрисовался» доказывает заголовок брони.
    await waitFor(() => expect(screen.getByText(t.booking.title)).toBeTruthy());
    expect(screen.queryByText(t.booking.paymentSectionTitle)).toBeNull();
    expect(flowEnabled.every((v) => v === false)).toBe(true);
  });

  it("уже оплачено, а заведение отключили — чек остаётся, кнопок оплаты нет", async () => {
    restaurant = venue(false);
    livePayment = paymentWith({ status: "captured" });
    flowState.phase = "paid";
    flowState.payment = livePayment;

    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentPaidTitle)).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Оплатить/ })).toBeNull();
  });
});

describe("оплаченный/дожимаемый предзаказ — чек, а не точка входа", () => {
  it("ОПЛАЧЕНО — сумма видна, а кнопки оплаты на экране НЕТ", async () => {
    flowState.phase = "paid";
    flowState.payment = paymentWith({ status: "captured" });

    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentPaidTitle)).toBeTruthy());
    // `normalizer` оставляет НЕРАЗРЫВНЫЙ пробел как есть: по умолчанию
    // testing-library схлопывает его в обычный, и сумма перестаёт совпадать
    // с тем, что печатает formatMoneyMinor.
    expect(
      screen.getByText(t.booking.paymentPaidHint(formatMoneyMinor(998_000)), {
        normalizer: (value) => value.trim(),
      }),
    ).toBeTruthy();
    // Ни одной кнопки, которая может создать второй счёт или уйти в Kaspi.
    expect(screen.queryByRole("button", { name: /Оплатить/ })).toBeNull();
    expect(screen.queryByRole("button", { name: t.booking.paymentRenew })).toBeNull();
    expect(screen.queryByRole("button", { name: t.booking.paymentOpenAgain })).toBeNull();
  });

  it("деньги ушли, списание дожимается — «оплачено» ещё НЕ пишем, и точки входа нет", async () => {
    flowState.phase = "settling";
    flowState.payment = paymentWith({ status: "authorized" });

    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentSettlingTitle)).toBeTruthy());
    expect(screen.queryByText(t.booking.paymentPaidTitle)).toBeNull();
    expect(screen.queryByRole("button", { name: /Оплатить/ })).toBeNull();
  });
});
