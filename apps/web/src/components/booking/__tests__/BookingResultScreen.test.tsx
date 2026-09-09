import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { RepositoryError, type Booking } from "@bookeat/api/client";

import { booking, pending, preorder, renderScreen, repositoryStub, venueDetail } from "@web/test/harness";
import { bookingHref, menuBookingHref } from "@web/lib/booking-link";

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
  it("подтверждённая: заголовок макета, время в часах заведения", async () => {
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
  });

  it("блок «Код брони» (QR + BE-XXXX-XXXX) скрыт по решению владельца от 2026-09-09", async () => {
    renderResult();

    expect(await screen.findByText("Столик забронирован")).toBeTruthy();
    expect(screen.queryByText("BE-A1B2-C3D4")).toBeNull();
    expect(screen.queryByRole("img", { name: "QR-код с номером брони" })).toBeNull();
    expect(screen.queryByText("Код брони")).toBeNull();
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

  it("страница стоит на подложке кадра (background/subtle), а шапка и подвал — нет", async () => {
    renderResult();

    await screen.findByText("Столик забронирован");
    expect(screen.getByRole("main").className).toContain("bg-subtle");
    expect(screen.getByRole("banner").className).not.toContain("bg-subtle");
    expect(screen.getByRole("contentinfo").className).not.toContain("bg-subtle");
  });

  it("длинный статус в ячейке билета показывается целиком, а не с многоточием", async () => {
    repository.getBooking = vi.fn(async () => booking({ id: ID, status: "waitlist" }));

    renderResult();

    const value = await screen.findByText("В листе ожидания");
    expect(value.className).not.toContain("truncate");
    expect(value.className).toContain("break-words");
  });

  it("отменённая: свой заголовок и без кнопки переноса", async () => {
    repository.getBooking = vi.fn(async () => booking({ id: ID, status: "cancelled" }));

    renderResult();

    expect(await screen.findByText("Бронь отменена")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Изменить бронь" })).toBeNull();
    expect(screen.getByRole("link", { name: "На главную" })).toBeTruthy();
  });
});

describe("блок «Предзаказ» на билете (A13, A14)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("items.length > 0 — строки и серверный итог, не оценка черновика", async () => {
    repository.getPreorder = vi.fn(async () =>
      preorder({
        items: [
          {
            id: "item-1",
            menuItemId: "dish-1",
            name: "Стейк рибай",
            priceMinor: 899000,
            quantity: 2,
            totalMinor: 1798000,
            comment: null,
          },
        ],
        totalMinor: 1798000,
      }),
    );

    renderResult();

    expect(await screen.findByText("Стейк рибай × 2")).toBeTruthy();
    expect(screen.getByText("Итого: 17 980 ₸")).toBeTruthy();
  });

  it("items.length === 0 — блока нет вовсе", async () => {
    repository.getPreorder = vi.fn(async () => preorder({ items: [], totalMinor: 0 }));

    renderResult();

    await screen.findByText("Столик забронирован");
    expect(screen.queryByText("Предзаказ")).toBeNull();
  });

  it("GET /preorder упал — билет остаётся, страница не рушится", async () => {
    repository.getPreorder = vi.fn(async () => {
      throw new RepositoryError("offline", undefined, undefined, undefined, undefined, undefined, true);
    });

    renderResult();

    expect(await screen.findByText("Столик забронирован")).toBeTruthy();
    expect(screen.queryByText("Предзаказ")).toBeNull();
  });

  it("уведомление о непрекреплённом предзаказе — один раз, не при повторном открытии", async () => {
    window.sessionStorage.setItem(`bookeat.web.preorder-failed.${ID}`, "1");

    const first = renderResult();
    expect(
      await screen.findByText(
        "Бронь принята, но предзаказ не прикрепился — назовите блюда заведению при подтверждении.",
      ),
    ).toBeTruthy();
    first.unmount();

    renderResult();
    await screen.findByText("Столик забронирован");
    expect(
      screen.queryByText(
        "Бронь принята, но предзаказ не прикрепился — назовите блюда заведению при подтверждении.",
      ),
    ).toBeNull();
  });

  /** D-WEB-1 (D5): четыре разные причины — четыре разных текста. */
  it.each([
    [
      JSON.stringify({ reason: "below_minimum" }),
      "Бронь принята, но предзаказ не прикрепился — итог был ниже минимального заказа заведения. Назовите блюда при подтверждении.",
    ],
    [
      JSON.stringify({ reason: "item_unavailable" }),
      "Бронь принята, но предзаказ не прикрепился — одно из блюд уже недоступно. Назовите блюда заведению при подтверждении.",
    ],
    [
      JSON.stringify({ reason: "locked" }),
      "Бронь принята, но предзаказ не прикрепился — состав уже меняет заведение. Уточните у него, что успели включить.",
    ],
    [
      JSON.stringify({ reason: "other" }),
      "Бронь принята, но предзаказ не прикрепился — назовите блюда заведению при подтверждении.",
    ],
  ])("причина %s → свой текст", async (flagValue, expectedText) => {
    window.sessionStorage.setItem(`bookeat.web.preorder-failed.${ID}`, flagValue);

    renderResult();

    expect(await screen.findByText(expectedText)).toBeTruthy();
  });
});

/**
 * Кнопка «Выбрать блюда»/«Изменить предзаказ» на билете — ТЗ
 * `web-preorder-menu-20260908`, C-WEB-2, критерии C1-C2.
 */
describe("билет — вход в правку предзаказа (C-WEB-2)", () => {
  it("pending, предзаказа нет — «Выбрать блюда» ведёт в режим ?booking=", async () => {
    repository.getBooking = vi.fn(async () => booking({ id: ID, restaurantId: "venue-1", status: "pending" }));
    repository.getPreorder = vi.fn(async () => preorder({ items: [], totalMinor: 0 }));

    renderResult();

    const link = await screen.findByRole("link", { name: "Выбрать блюда" });
    expect(link.getAttribute("href")).toBe(menuBookingHref("venue-1", ID));
    expect(screen.queryByText("Изменить предзаказ")).toBeNull();
  });

  it("pending, предзаказ есть — «Изменить предзаказ»", async () => {
    repository.getBooking = vi.fn(async () => booking({ id: ID, restaurantId: "venue-1", status: "pending" }));
    repository.getPreorder = vi.fn(async () => preorder());

    renderResult();

    const link = await screen.findByRole("link", { name: "Изменить предзаказ" });
    expect(link.getAttribute("href")).toBe(menuBookingHref("venue-1", ID));
  });

  it("confirmed, предзаказа нет — первое прикрепление, кнопка есть (ADR-030, исключение)", async () => {
    repository.getBooking = vi.fn(async () => booking({ id: ID, restaurantId: "venue-1", status: "confirmed" }));
    repository.getPreorder = vi.fn(async () => preorder({ items: [], totalMinor: 0 }));

    renderResult();

    expect(await screen.findByRole("link", { name: "Выбрать блюда" })).toBeTruthy();
  });

  it("confirmed, предзаказ уже есть — кнопки нет, текст про заведение (C1)", async () => {
    repository.getBooking = vi.fn(async () => booking({ id: ID, restaurantId: "venue-1", status: "confirmed" }));
    repository.getPreorder = vi.fn(async () => preorder());

    renderResult();

    expect(await screen.findByText("Состав подтверждённой брони меняет заведение")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Выбрать блюда" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Изменить предзаказ" })).toBeNull();
  });

  it("строка без menu_item_id (ручная позиция кабинета) — кнопки нет ни при каком статусе (C2)", async () => {
    repository.getBooking = vi.fn(async () => booking({ id: ID, restaurantId: "venue-1", status: "pending" }));
    repository.getPreorder = vi.fn(async () =>
      preorder({
        items: [
          {
            id: "item-manual",
            menuItemId: null,
            name: "Торт на заказ",
            priceMinor: 500000,
            quantity: 1,
            totalMinor: 500000,
            comment: null,
          },
        ],
        totalMinor: 500000,
      }),
    );

    renderResult();

    expect(await screen.findByText("Состав менял ресторан — изменения через заведение")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Изменить предзаказ" })).toBeNull();
  });

  it.each(["arrived", "completed", "cancelled", "no_show"] as const)(
    "статус %s — ни кнопки, ни текста (терминальная бронь)",
    async (status) => {
      repository.getBooking = vi.fn(async () => booking({ id: ID, restaurantId: "venue-1", status }));
      repository.getPreorder = vi.fn(async () => preorder());

      renderResult();

      await screen.findByRole("article");
      expect(screen.queryByRole("link", { name: "Выбрать блюда" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Изменить предзаказ" })).toBeNull();
      expect(screen.queryByText("Состав подтверждённой брони меняет заведение")).toBeNull();
      expect(screen.queryByText("Состав менял ресторан — изменения через заведение")).toBeNull();
    },
  );

  it("GET /preorder упал — ни кнопки, ни текста, билет цел", async () => {
    repository.getBooking = vi.fn(async () => booking({ id: ID, restaurantId: "venue-1", status: "pending" }));
    repository.getPreorder = vi.fn(async () => {
      throw new RepositoryError("offline", undefined, undefined, undefined, undefined, undefined, true);
    });

    renderResult();

    expect(await screen.findByText("Бронь отправлена")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Выбрать блюда" })).toBeNull();
  });
});
