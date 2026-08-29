import { describe, expect, it, vi } from "vitest";
import { HttpRestaurantRepository } from "../http-repository";
import { RepositoryError } from "../repository";

/**
 * Транспорт оплаты предзаказа: `POST /bookings/:id/payment` и
 * `GET /payments/:id`.
 *
 * У Kaspi НЕТ ПЕСОЧНИЦЫ, поэтому единственное место, где эти два вызова можно
 * проверить по-настоящему, — вот здесь, на подменённом `fetch`. Проверяется
 * ровно то, чего нельзя увидеть глазами и что ломается тихо:
 *
 *   • ключ идемпотентности реально уходит ЗАГОЛОВКОМ (в теле сервер его не
 *     читает вовсе — `c.GetHeader("Idempotency-Key")`), а без него повтор
 *     создал бы второй счёт;
 *   • `payment_url` и `expires_at` доезжают до модели: без первого кнопка
 *     никуда не ведёт, без второго на экране нечего отсчитывать;
 *   • 404 — это `null`, а не исключение: у брони может не быть платежа, и это
 *     нормальное состояние, а не сбой.
 */

const BASE_URL = "https://api.example.test/api/v1";

function repository() {
  return new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "token" });
}

function respondWith(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const CREATED_PAYMENT = {
  id: "pay-1",
  booking_id: "b-1",
  restaurant_id: "r-1",
  purpose: "preorder",
  status: "created",
  amount_minor: 998_000,
  currency: "KZT",
  payment_url: "https://pay.kaspi.kz/pay/abcdef",
  expires_at: "2026-08-29T12:05:00Z",
};

describe("POST /bookings/:id/payment", () => {
  it("шлёт return_url телом, ключ идемпотентности — заголовком", async () => {
    const fetchMock = respondWith(201, { data: CREATED_PAYMENT });

    await repository().createBookingPayment(
      "b-1",
      { returnUrl: "bookeat://booking/b-1" },
      "pay-key-1",
    );

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/bookings/b-1/payment`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ return_url: "bookeat://booking/b-1" });
    const headers = new Headers(init.headers);
    expect(headers.get("Idempotency-Key")).toBe("pay-key-1");
    expect(headers.get("Authorization")).toBe("Bearer token");
  });

  it("ссылка и срок доезжают до модели", async () => {
    respondWith(201, { data: CREATED_PAYMENT });

    const payment = await repository().createBookingPayment(
      "b-1",
      { returnUrl: "bookeat://booking/b-1" },
      "pay-key-1",
    );

    expect(payment.paymentUrl).toBe("https://pay.kaspi.kz/pay/abcdef");
    expect(payment.expiresAt).toBe("2026-08-29T12:05:00Z");
    expect(payment.status).toBe("created");
    expect(payment.amountMinor).toBe(998_000);
  });

  it("старая сборка сервера без этих полей — null, а не undefined/пустая строка", async () => {
    respondWith(201, {
      data: { ...CREATED_PAYMENT, payment_url: undefined, expires_at: "" },
    });

    const payment = await repository().createBookingPayment(
      "b-1",
      { returnUrl: "bookeat://booking/b-1" },
      "pay-key-1",
    );

    expect(payment.paymentUrl).toBeNull();
    expect(payment.expiresAt).toBeNull();
  });

  it("409 доезжает как отказ, а не как созданный счёт", async () => {
    respondWith(409, { error: "this booking already has an active payment" });

    await expect(
      repository().createBookingPayment("b-1", { returnUrl: "bookeat://booking/b-1" }, "k"),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("422 (платежи не включены) — тоже отказ", async () => {
    respondWith(422, { error: "payments are not enabled for this restaurant" });

    const failure = await repository()
      .createBookingPayment("b-1", { returnUrl: "bookeat://booking/b-1" }, "k")
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect(failure).toBeInstanceOf(RepositoryError);
    expect((failure as RepositoryError).status).toBe(422);
  });
});

describe("GET /payments/:id", () => {
  it("читает платёж в ЛЮБОМ статусе — этим он и отличается от booking-ручки", async () => {
    const fetchMock = respondWith(200, {
      data: { ...CREATED_PAYMENT, status: "expired" },
    });

    const payment = await repository().getPayment("pay-1");

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe(`${BASE_URL}/payments/pay-1`);
    expect(payment?.status).toBe("expired");
  });

  it("captured доезжает как captured — на этом строится «оплачено»", async () => {
    respondWith(200, { data: { ...CREATED_PAYMENT, status: "captured" } });
    const payment = await repository().getPayment("pay-1");
    expect(payment?.status).toBe("captured");
  });

  it("404 — это null, а не исключение", async () => {
    respondWith(404, { error: "payment not found" });
    await expect(repository().getPayment("pay-1")).resolves.toBeNull();
  });

  it("500 остаётся ошибкой: «не знаем» нельзя выдавать за «нет платежа»", async () => {
    respondWith(500, { error: "boom" });
    await expect(repository().getPayment("pay-1")).rejects.toMatchObject({ status: 500 });
  });

  it("неизвестный статус не притворяется оплатой", async () => {
    respondWith(200, { data: { ...CREATED_PAYMENT, status: "paid" } });
    const payment = await repository().getPayment("pay-1");
    // mapPayment сводит незнакомое к "created" — состоянию, которое НИЧЕГО не
    // обещает гостю про деньги.
    expect(payment?.status).toBe("created");
  });
});
