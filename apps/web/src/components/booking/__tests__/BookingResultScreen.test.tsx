import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { RepositoryError, type Booking } from "@bookeat/api/client";

import { booking, pending, renderScreen, repositoryStub, venueDetail } from "@web/test/harness";
import { bookingHref } from "@web/lib/booking-link";

/**
 * Страница «Бронь подтверждена» (Figma QovvuAoI9YxsLMwWkfgKN8, узел 3525:15019).
 *
 * В макете один сценарий — «заведение подтвердило автоматически». Сервер же
 * создаёт бронь в `pending`, и ссылку открывают через неделю, поэтому
 * заголовок зависит от статуса. Второе, что ломается молча: время печатается
 * в стенных часах ЗАВЕДЕНИЯ, а `Booking.startsAt` приходит в UTC.
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

let auth = { signedIn: false, isLoading: false, user: null };

vi.mock("@web/lib/auth", () => ({
  useAuth: () => ({ ...auth, completeSignIn: vi.fn(), signOut: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => `/bookings/${ID}`,
  useSearchParams: () => new URLSearchParams(""),
}));

const { BookingResultScreen } = await import("@web/components/booking/BookingResultScreen");

function renderResult() {
  return renderScreen(<BookingResultScreen id={ID} />);
}

beforeEach(() => {
  auth = { signedIn: true, isLoading: false, user: null };
  repository.getRestaurant = vi.fn(async () => venueDetail());
  repository.getBooking = vi.fn(async () => booking({ id: ID, status: "confirmed" }));
});

describe("страница брони — состояния", () => {
  it("без входа бронь не запрашивается: просьба войти с возвратом сюда", async () => {
    auth = { signedIn: false, isLoading: false, user: null };

    renderResult();

    expect(await screen.findByText("Нужен вход")).toBeTruthy();
    // В шапке сайта своя ссылка «Войти» — без возврата; нужна та, что в плашке.
    expect(screen.getAllByRole("link", { name: "Войти" }).map((link) => link.getAttribute("href"))).toContain(
      `/login?next=${encodeURIComponent(`/bookings/${ID}`)}`,
    );
    expect(repository.getBooking).not.toHaveBeenCalled();
  });

  it("пока бронь едет — загрузка", async () => {
    repository.getBooking = vi.fn(() => pending<Booking>());

    renderResult();

    expect(await screen.findByRole("status")).toBeTruthy();
  });

  it("404 — чужая или несуществующая бронь, а не сбой связи", async () => {
    repository.getBooking = vi.fn(async () => {
      throw new RepositoryError("not found", undefined, 404);
    });

    renderResult();

    expect(await screen.findByText("Бронь не найдена")).toBeTruthy();
    expect(screen.queryByText("Не удалось загрузить")).toBeNull();
  });
});

describe("страница брони — билет", () => {
  it("подтверждённая: заголовок макета, время в часах заведения, код из идентификатора, QR", async () => {
    renderResult();

    expect(await screen.findByText("Столик забронирован")).toBeTruthy();
    // 14:30Z → 19:30 по Алматы; телефон — в человеческой записи.
    expect(
      screen.getByText(
        "Ждём вас 25 августа в 19:30. Детали брони отправили на +7 701 000-00-00 — заведение подтвердило столик автоматически.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Вт, 25 авг")).toBeTruthy();
    expect(screen.getByText("19:30")).toBeTruthy();
    expect(screen.getByText("2 гостя")).toBeTruthy();
    expect(screen.getByText("Подтверждена")).toBeTruthy();
    expect(screen.getByText("BE-A1B2-C3D4")).toBeTruthy();
    expect(screen.getByRole("img", { name: "QR-код с номером брони" })).toBeTruthy();
  });

  it("«Изменить бронь» ведёт на страницу бронирования в режиме переноса с датой и гостями", async () => {
    renderResult();

    const change = await screen.findByRole("link", { name: "Изменить бронь" });
    expect(change.getAttribute("href")).toBe(
      bookingHref("venue-1", { changeBookingId: ID, date: "2026-08-25", guests: 2 }),
    );
    expect(screen.getByRole("link", { name: "На главную" }).getAttribute("href")).toBe("/");
  });

  it("ожидающая: не обещает подтверждения, которого сервер ещё не дал", async () => {
    repository.getBooking = vi.fn(async () => booking({ id: ID, status: "pending" }));

    renderResult();

    expect(await screen.findByText("Бронь отправлена")).toBeTruthy();
    expect(screen.queryByText("Столик забронирован")).toBeNull();
    expect(screen.getByText("Ждём заведение")).toBeTruthy();
  });

  it("отменённая: свой заголовок и без кнопки переноса", async () => {
    repository.getBooking = vi.fn(async () => booking({ id: ID, status: "cancelled" }));

    renderResult();

    expect(await screen.findByText("Бронь отменена")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Изменить бронь" })).toBeNull();
    expect(screen.getByRole("link", { name: "На главную" })).toBeTruthy();
  });
});
