import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { BookingPayment } from "@bookeat/api/client";

import { formatMoneyMinor } from "@web/lib/format";
import { booking, preorder, renderScreen, repositoryStub, venueDetail } from "@web/test/harness";

/**
 * Страница брони: вход обратно в оплату предзаказа (гость закрыл страницу
 * оплаты) и пометка/блок «Предзаказ оплачен». Статус самой брони не трогаем.
 */

const ID = "a1b2c3d4-0000-4000-8000-000000000001";
const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

vi.mock("@web/lib/auth", () => ({
  useAuth: () => ({ signedIn: true, isLoading: false, user: null, completeSignIn: vi.fn(), signOut: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => `/bookings/${ID}`,
  useSearchParams: () => new URLSearchParams(""),
}));

const { BookingResultScreen } = await import("@web/components/booking/BookingResultScreen");

const live = (over: Partial<BookingPayment> = {}): BookingPayment => ({
  id: "pay-1",
  bookingId: ID,
  purpose: "preorder",
  status: "created",
  amountMinor: 362695,
  currency: "KZT",
  paymentUrl: "https://pay.example/x",
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  ...over,
});

function setup(payment: BookingPayment | null, opts: { online?: boolean; required?: boolean | null } = {}) {
  repository.getBooking = vi.fn(async () => booking({ id: ID, status: "confirmed" }));
  repository.getPreorder = vi.fn(async () => preorder({ totalMinor: 350000 }));
  repository.getBookingPayment = vi.fn(async () => payment);
  repository.getRestaurant = vi.fn(async () =>
    venueDetail({
      acceptsOnlinePayment: opts.online ?? true,
      ...(opts.required !== undefined ? { preorderPaymentRequired: opts.required } : {}),
      paymentFee: { rateBps: 350, minFeeMinor: 2500 } }),
  );
  renderScreen(<BookingResultScreen id={ID} />);
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("страница брони: оплата предзаказа", () => {
  it("живая ссылка — «Ждём оплату · осталось мм:сс» и кнопка «Оплатить N» на страницу оплаты", async () => {
    setup(live());
    expect(await screen.findByText(/Ждём оплату предзаказа · осталось \d\d:\d\d/)).toBeTruthy();
    const link = screen.getByRole("link", { name: `Оплатить ${formatMoneyMinor(362695)}` });
    expect(link.getAttribute("href")).toBe(`/bookings/${ID}/payment`);
  });

  it("платежа нет, но платить можно — «Предзаказ ещё не оплачен», сумма с предпросмотром сбора", async () => {
    setup(null);
    expect(await screen.findByText("Предзаказ ещё не оплачен")).toBeTruthy();
    expect(screen.getByRole("link", { name: `Оплатить ${formatMoneyMinor(362695)}` })).toBeTruthy();
  });

  it("заведение без онлайн-оплаты — входа нет", async () => {
    setup(null, { online: false });
    await screen.findByTestId("preorder-pay-entry").catch(() => null);
    expect(screen.queryByTestId("preorder-pay-entry")).toBeNull();
  });

  it("preorder_payment_required = false — входа на оплату нет (оплата не нужна)", async () => {
    setup(null, { required: false });
    await waitFor(() => expect(repository.getRestaurant).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("preorder-pay-entry")).toBeNull();
    expect(screen.queryByText("Предзаказ ещё не оплачен")).toBeNull();
  });

  it("preorder_payment_required = true или не прислан — вход есть", async () => {
    setup(null, { required: true });
    expect(await screen.findByText("Предзаказ ещё не оплачен")).toBeTruthy();
  });

  it("оплачено — пометка и блок «Предзаказ» с блюдами и итогом, входа на оплату нет", async () => {
    setup(live({ status: "captured", baseAmountMinor: 350000, feeMinor: 12695 }));
    expect(await screen.findByTestId("preorder-paid-pill")).toBeTruthy();
    expect(screen.getByTestId("preorder-paid-block").textContent).toContain("2 × Стейк рибай");
    expect(screen.getByTestId("preorder-paid-total").textContent).toBe(formatMoneyMinor(362695));
    expect(screen.getByText("Сервисный сбор")).toBeTruthy();
    expect(screen.queryByTestId("preorder-pay-entry")).toBeNull();
  });
});
