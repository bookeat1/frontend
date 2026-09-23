import type { Booking, BookingPayment, Preorder, Restaurant } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PaymentScreen from "../booking/[id]/payment";
import { formatMoneyMinor } from "../../src/lib/format";
import { formatCountdown } from "../../src/lib/kaspi-payment";

/**
 * Полноэкранная оплата предзаказа (Figma qmMsg4jO1ggmyEHNIAD2ll, узел
 * 5390:8875) — фазы idle/awaiting/settling, уход в Kaspi и развязки
 * paid/dead. Перенесено сюда из `booking-kaspi-payment.test.tsx`: раньше все
 * эти фазы рисовал экран брони инлайн, теперь — этот экран.
 *
 * ⚠️ У Kaspi НЕТ ПЕСОЧНИЦЫ: живой счёт создать «на попробовать» нельзя,
 * поэтому экран проверяется целиком на моках.
 */

const t = getDictionary("ru");

const replace = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ id: "b-1" }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-in" }),
}));

vi.mock("../../src/hooks/useRestaurant", () => ({
  useRestaurant: () => ({ data: restaurant, isLoading: false, isError: false }),
}));

let booking: Booking;
let preorder: Preorder | null;

vi.mock("../../src/hooks/useBooking", () => ({
  useBooking: () => ({ data: booking, isPending: false, isError: false, refetch: vi.fn() }),
  usePreorder: () => ({ data: preorder, isPending: false, isError: false }),
  useBookingPayment: () => ({ data: null, isPending: false, isError: false }),
}));

const flowState = {
  phase: "idle" as "idle" | "awaiting" | "settling" | "paid" | "dead",
  payment: null as BookingPayment | null,
  creating: false,
  error: null as unknown,
  now: Date.now(),
};
const pay = vi.fn();
const check = vi.fn();

vi.mock("../../src/hooks/useKaspiPayment", () => ({
  useKaspiPaymentFlow: () => ({ ...flowState, pay, renew: vi.fn(), check }),
}));

/** В jsdom `window.open`/переход по внешней ссылке не реализован — подменяем,
 * иначе тест шумит в stderr и ничего не проверяет. */
const openWebsite = vi.fn(async (_url: string) => true);
vi.mock("../../src/lib/external-links", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/external-links")>()),
  openWebsite: (url: string) => openWebsite(url),
}));

let restaurant: Restaurant | undefined;

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
  preorderMinAmountMinor: null,
  serviceFeeBps: null,
};

function bookingWith(status: Booking["status"]): Booking {
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
  restaurant = { ...RESTAURANT };
  booking = bookingWith("confirmed");
  preorder = preorderWith(998_000);
  flowState.phase = "idle";
  flowState.payment = null;
  flowState.creating = false;
  flowState.error = null;
  flowState.now = Date.now();
  pay.mockClear();
  check.mockClear();
  replace.mockClear();
  openWebsite.mockClear();
});

describe("фаза idle", () => {
  it("рисует сумму, состав и кнопку «Оплатить через Kaspi»", async () => {
    render(<PaymentScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentSectionTitle)).toBeTruthy());
    expect(screen.getByText("Mongol")).toBeTruthy();
    expect(screen.getByText(/Бешбармак/)).toBeTruthy();
    const button = screen.getByRole("button", {
      name: t.booking.paymentPayWithKaspiAmount(formatMoneyMinor(998_000)),
    });
    button.click();
    expect(pay).toHaveBeenCalledTimes(1);
  });
});

describe("фаза awaiting", () => {
  it("отсчёт по expires_at сервера, «открыть снова» ведёт в Kaspi", async () => {
    const now = Date.parse("2026-08-29T12:00:00.000Z");
    flowState.now = now;
    flowState.phase = "awaiting";
    flowState.payment = paymentWith({
      status: "voiding",
      expiresAt: new Date(now + 4 * 60_000 + 30_000).toISOString(),
    });

    render(<PaymentScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentAwaitingTitle)).toBeTruthy());
    expect(screen.getByText(t.booking.paymentCountdown(formatCountdown(270_000)))).toBeTruthy();

    const openAgain = screen.getByRole("button", { name: t.booking.paymentOpenAgain });
    openAgain.click();
    await waitFor(() =>
      expect(openWebsite).toHaveBeenCalledWith("https://pay.kaspi.kz/pay/abcdef"),
    );

    screen.getByRole("button", { name: t.booking.paymentCheckAgain }).click();
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("счёт создан — открывается сразу и РОВНО ОДИН РАЗ", async () => {
    flowState.phase = "awaiting";
    flowState.payment = paymentWith({ status: "created" });

    const { rerender } = render(<PaymentScreen />);
    await waitFor(() => expect(openWebsite).toHaveBeenCalledWith("https://pay.kaspi.kz/pay/abcdef"));

    // Отсчёт перерисовывает экран раз в секунду — открытие держится на id
    // счёта, а не на каждом рендере.
    flowState.now += 1_000;
    rerender(<PaymentScreen />);
    flowState.now += 1_000;
    rerender(<PaymentScreen />);
    expect(openWebsite).toHaveBeenCalledTimes(1);
  });
});

describe("развязки", () => {
  it("оплачено — уводит на экран успеха", async () => {
    flowState.phase = "paid";
    flowState.payment = paymentWith({ status: "captured" });

    render(<PaymentScreen />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith({
        pathname: "/booking/[id]/payment-success",
        params: { id: "b-1" },
      }),
    );
  });

  it("ссылка мертва — уводит на экран ошибки", async () => {
    flowState.phase = "dead";
    flowState.payment = paymentWith({ status: "expired" });

    render(<PaymentScreen />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith({
        pathname: "/booking/[id]/payment-error",
        params: { id: "b-1" },
      }),
    );
  });
});

describe("отказы создания счёта", () => {
  it("нет сети — своя формулировка, английский текст сервера не показываем", async () => {
    const { RepositoryError } = await import("@bookeat/api");
    flowState.error = new RepositoryError(
      "connection refused",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    );

    render(<PaymentScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentErrorOffline)).toBeTruthy());
    expect(screen.queryByText(/connection refused/)).toBeNull();
  });

  it("создание счёта идёт — кнопка заблокирована", async () => {
    flowState.creating = true;

    render(<PaymentScreen />);
    const button = await screen.findByRole("button", {
      name: t.booking.paymentPayWithKaspiAmount(formatMoneyMinor(998_000)),
    });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    button.click();
    expect(pay).not.toHaveBeenCalled();
  });

  it("устройство не смогло открыть ссылку — говорим об этом", async () => {
    openWebsite.mockResolvedValue(false);
    flowState.phase = "awaiting";
    flowState.payment = paymentWith({ status: "created" });

    render(<PaymentScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentErrorCannotOpen)).toBeTruthy());
  });
});
