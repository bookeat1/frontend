import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { RepositoryError } from "@bookeat/api/client";

import { booking, preorder, renderScreen, repositoryStub, venueDetail } from "@web/test/harness";

/**
 * Оплата предзаказа не требуется (bookeat1/backend#163): страница оплаты не
 * показывает гостю ошибку — возвращает на бронь. Если 422 «requires no
 * payment» всё же пришёл, гость видит спокойное объяснение, а не общую ошибку.
 */

const ID = "a1b2c3d4-0000-4000-8000-000000000001";
const repository = repositoryStub();
const replace = vi.fn();

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
  useRouter: () => ({ push: vi.fn(), replace, prefetch: vi.fn() }),
  usePathname: () => `/bookings/${ID}/payment`,
  useSearchParams: () => new URLSearchParams(""),
}));

const { PaymentScreen } = await import("@web/components/booking/PaymentScreen");

function setup(venueOver: Parameters<typeof venueDetail>[0]) {
  repository.getBooking = vi.fn(async () => booking({ id: ID, status: "confirmed" }));
  repository.getPreorder = vi.fn(async () => preorder());
  repository.getBookingPayment = vi.fn(async () => null);
  repository.createBookingPayment = vi.fn();
  repository.getRestaurant = vi.fn(async () => venueDetail({ acceptsOnlinePayment: true, ...venueOver }));
  renderScreen(<PaymentScreen id={ID} />);
}

beforeEach(() => {
  replace.mockClear();
  window.sessionStorage.clear();
});

describe("оплата не требуется", () => {
  it("preorder_payment_required = false — уводит на бронь без создания платежа", async () => {
    setup({ preorderPaymentRequired: false });
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/bookings/${ID}`));
    expect(repository.createBookingPayment).not.toHaveBeenCalled();
  });

  it("поле не прислано (старый бэкенд) — остаётся на странице оплаты", async () => {
    setup({ preorderPaymentRequired: null });
    expect(await screen.findByRole("button", { name: /^Оплатить/ })).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("422 «requires no payment» — понятное сообщение вместо общей ошибки", async () => {
    setup({ preorderPaymentRequired: null });
    repository.createBookingPayment = vi.fn(async () => {
      throw new RepositoryError("Request failed", undefined, 422, "validation: this booking requires no payment");
    });
    fireEvent.click(await screen.findByRole("button", { name: /^Оплатить/ }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Онлайн-оплата для этой брони не нужна");
    expect(alert.textContent).not.toContain("Не удалось создать счёт");
  });
});
