import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { BookingPayment } from "@bookeat/api/client";

import { booking, preorder, renderScreen, repositoryStub, venueDetail } from "@web/test/harness";

/**
 * Экран оплаты: одна кнопка на доступный способ (`payment_methods`), а у
 * старого бэкенда без поля — прежняя единственная «Оплатить» без `method`.
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
  useAuth: () => ({
    signedIn: true,
    isLoading: false,
    user: null,
    completeSignIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => `/bookings/${ID}/payment`,
  useSearchParams: () => new URLSearchParams(""),
}));

const { PaymentScreen } = await import("@web/components/booking/PaymentScreen");

const created: BookingPayment = {
  id: "pay-1",
  bookingId: ID,
  purpose: "preorder",
  status: "created",
  amountMinor: 1798000,
  currency: "KZT",
  paymentUrl: null,
  expiresAt: null,
};

function setup(paymentMethods: Array<"kaspi" | "card"> | undefined) {
  repository.getBooking = vi.fn(async () => booking({ id: ID, status: "confirmed" }));
  repository.getPreorder = vi.fn(async () => preorder());
  repository.getBookingPayment = vi.fn(async () => null);
  repository.getRestaurant = vi.fn(async () =>
    venueDetail({ acceptsOnlinePayment: true, ...(paymentMethods ? { paymentMethods } : {}) }),
  );
  repository.createBookingPayment = vi.fn(async () => created);
  repository.getPayment = vi.fn(async () => created);
  renderScreen(<PaymentScreen id={ID} />);
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("оплата: выбор способа", () => {
  it("две кнопки; карта уходит на сервер с method=card", async () => {
    setup(["kaspi", "card"]);
    expect(await screen.findByRole("button", { name: /^Оплатить Kaspi \d/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Оплатить картой \d/ }));
    await waitFor(() => expect(repository.createBookingPayment).toHaveBeenCalledTimes(1));
    const [, input] = vi.mocked(repository.createBookingPayment).mock.calls[0]!;
    expect(input).toMatchObject({ method: "card" });
  });

  it("только карта — одна «Оплатить N», Kaspi не показывается", async () => {
    setup(["card"]);
    fireEvent.click(await screen.findByRole("button", { name: /^Оплатить \d/ }));
    expect(screen.queryByRole("button", { name: /Kaspi/ })).toBeNull();
    await waitFor(() => expect(repository.createBookingPayment).toHaveBeenCalledTimes(1));
    const [, input] = vi.mocked(repository.createBookingPayment).mock.calls[0]!;
    expect(input).toMatchObject({ method: "card" });
  });

  it("старый бэкенд без поля — одна «Оплатить», method не передаётся", async () => {
    setup(undefined);
    fireEvent.click(await screen.findByRole("button", { name: /^Оплатить/ }));
    await waitFor(() => expect(repository.createBookingPayment).toHaveBeenCalledTimes(1));
    const [, input] = vi.mocked(repository.createBookingPayment).mock.calls[0]!;
    expect(input.method).toBeUndefined();
    expect(screen.queryByRole("button", { name: /картой/ })).toBeNull();
  });
});
