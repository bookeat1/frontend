import type { Booking, BookingPayment, BookingStatus, Preorder, Restaurant } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReservationScreen from "../booking/[id]/index";
import { formatMoneyMinor } from "../../src/lib/format";
import { formatCountdown } from "../../src/lib/kaspi-payment";

/**
 * Блок оплаты предзаказа через Kaspi на экране брони.
 *
 * ⚠️ У Kaspi НЕТ ПЕСОЧНИЦЫ: живой счёт создать «на попробовать» нельзя, и
 * поэтому экран проверяется здесь целиком на моках — какая фаза что рисует,
 * и, главное, ЧЕГО в каждой фазе на экране быть не должно.
 *
 * Ломается это тихо и дорого: кнопка оплаты, оставшаяся после оплаты, — это
 * второй счёт на те же деньги.
 */

const t = getDictionary("ru");

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), canGoBack: () => false }),
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

vi.mock("../../src/hooks/useRestaurant", () => ({
  useRestaurant: () => ({ data: RESTAURANT, isLoading: false, isError: false }),
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

vi.mock("../../src/hooks/useKaspiPayment", () => ({
  useKaspiPaymentFlow: () => ({ ...flowState, pay, renew, check }),
}));

/** Открытие внешней ссылки — единственное место, где экран уводит гостя из
 * приложения. В jsdom `window.open` не реализован, поэтому подменяем: иначе
 * тест шумит в stderr и ничего не проверяет. */
const openWebsite = vi.fn(async (_url: string) => true);
vi.mock("../../src/lib/external-links", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/external-links")>()),
  openWebsite: (url: string) => openWebsite(url),
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
  menuHighlights: [
    { id: "d-1", name: "Бешбармак", description: "", price: "4 990 ₸", priceMinor: 499_000, isTopPick: false },
  ],
  openingHoursText: "",
  schedule: null,
  tables: [],
  description: "",
  acceptsOnlineBookings: true,
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
  openWebsite.mockClear();
});

describe("когда блок оплаты вообще есть", () => {
  it("живая бронь с предзаказом — кнопка Kaspi на месте, с суммой", async () => {
    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentSectionTitle)).toBeTruthy());
    expect(
      screen.getByRole("button", {
        name: t.booking.paymentPayWithKaspiAmount(formatMoneyMinor(998_000)),
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

describe("фазы оплаты", () => {
  it("ссылка жива — отсчёт по expires_at сервера, а не по нашей выдумке", async () => {
    const now = Date.parse("2026-08-29T12:00:00.000Z");
    flowState.now = now;
    flowState.phase = "awaiting";
    flowState.payment = paymentWith({
      expiresAt: new Date(now + 4 * 60_000 + 30_000).toISOString(),
    });

    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentAwaitingTitle)).toBeTruthy());
    expect(screen.getByText(t.booking.paymentCountdown(formatCountdown(270_000)))).toBeTruthy();
    expect(screen.getByText(t.booking.paymentCountdown("04:30"))).toBeTruthy();
  });

  it("сервер не прислал срок — отсчёта нет вовсе, ничего не выдумываем", async () => {
    flowState.phase = "awaiting";
    flowState.payment = paymentWith({ expiresAt: null });

    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentAwaitingTitle)).toBeTruthy());
    expect(screen.queryByText(/Ссылка действует ещё/)).toBeNull();
  });

  it("ссылка истекла — объяснение и кнопка НОВОЙ ссылки", async () => {
    flowState.phase = "dead";
    flowState.payment = paymentWith({ status: "expired" });

    render(<ReservationScreen />);
    const button = await screen.findByRole("button", { name: t.booking.paymentRenew });
    expect(screen.getByText(t.booking.paymentDeadTitle)).toBeTruthy();
    button.click();
    expect(renew).toHaveBeenCalledTimes(1);
  });

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
    // Ни одной кнопки, которая может создать второй счёт.
    expect(screen.queryByRole("button", { name: t.booking.paymentPayWithKaspi })).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: t.booking.paymentPayWithKaspiAmount(formatMoneyMinor(998_000)),
      }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: t.booking.paymentRenew })).toBeNull();
    expect(screen.queryByRole("button", { name: t.booking.paymentOpenAgain })).toBeNull();
  });

  it("деньги ушли, списание дожимается — «оплачено» ещё НЕ пишем", async () => {
    flowState.phase = "settling";
    flowState.payment = paymentWith({ status: "authorized" });

    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentSettlingTitle)).toBeTruthy());
    expect(screen.queryByText(t.booking.paymentPaidTitle)).toBeNull();
  });
});

describe("уход в Kaspi", () => {
  it("созданный счёт открывается сразу и РОВНО ОДИН РАЗ", async () => {
    flowState.phase = "awaiting";
    flowState.payment = paymentWith({ status: "created" });

    const { rerender } = render(<ReservationScreen />);
    await waitFor(() => expect(openWebsite).toHaveBeenCalledWith("https://pay.kaspi.kz/pay/abcdef"));

    // Отсчёт перерисовывает экран раз в секунду. Если бы открытие висело на
    // рендере, а не на id счёта, гостя выкидывало бы в Kaspi снова и снова.
    flowState.now = flowState.now + 1_000;
    rerender(<ReservationScreen />);
    flowState.now = flowState.now + 1_000;
    rerender(<ReservationScreen />);
    expect(openWebsite).toHaveBeenCalledTimes(1);
  });

  it("оплаченный счёт никуда не уводит", async () => {
    flowState.phase = "paid";
    flowState.payment = paymentWith({ status: "captured" });

    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentPaidTitle)).toBeTruthy());
    expect(openWebsite).not.toHaveBeenCalled();
  });

  it("устройство не смогло открыть ссылку — говорим об этом", async () => {
    openWebsite.mockResolvedValue(false);
    flowState.phase = "awaiting";
    flowState.payment = paymentWith({ status: "created" });

    render(<ReservationScreen />);
    await waitFor(() =>
      expect(screen.getByText(t.booking.paymentErrorCannotOpen)).toBeTruthy(),
    );
    openWebsite.mockResolvedValue(true);
  });

  it("«открыть оплату снова» ведёт по той же ссылке", async () => {
    flowState.phase = "awaiting";
    // Статус не `created` — значит автооткрытия нет, и вызов будет ровно один:
    // тот, который сделала кнопка.
    flowState.payment = paymentWith({ status: "voiding" });

    render(<ReservationScreen />);
    const button = await screen.findByRole("button", { name: t.booking.paymentOpenAgain });
    expect(openWebsite).not.toHaveBeenCalled();
    button.click();
    await waitFor(() =>
      expect(openWebsite).toHaveBeenCalledWith("https://pay.kaspi.kz/pay/abcdef"),
    );
  });

  it("«я оплатил, проверить» спрашивает сервер", async () => {
    flowState.phase = "awaiting";
    flowState.payment = paymentWith({ status: "voiding" });

    render(<ReservationScreen />);
    const button = await screen.findByRole("button", { name: t.booking.paymentCheckAgain });
    button.click();
    expect(check).toHaveBeenCalledTimes(1);
  });
});

describe("отказы", () => {
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

    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentErrorOffline)).toBeTruthy());
    expect(screen.queryByText(/connection refused/)).toBeNull();
  });

  it("422 — «оплата у заведения не подключена»", async () => {
    const { RepositoryError } = await import("@bookeat/api");
    flowState.error = new RepositoryError("payments are not enabled", undefined, 422);

    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentErrorUnavailable)).toBeTruthy());
  });

  it("409 — по броне уже есть платёж", async () => {
    const { RepositoryError } = await import("@bookeat/api");
    flowState.error = new RepositoryError("already active", undefined, 409);

    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentErrorAlreadyActive)).toBeTruthy());
  });

  it("создание счёта идёт — кнопка заблокирована, второй счёт не создать", async () => {
    flowState.creating = true;

    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.paymentSectionTitle)).toBeTruthy());
    const button = screen.getByRole("button", {
      name: t.booking.paymentPayWithKaspiAmount(formatMoneyMinor(998_000)),
    });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    button.click();
    expect(pay).not.toHaveBeenCalled();
  });
});
