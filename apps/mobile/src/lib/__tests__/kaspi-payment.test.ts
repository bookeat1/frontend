import type { BookingPayment, PaymentStatus } from "@bookeat/api";
import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  isPaid,
  newIdempotencyKey,
  nextPollDelayMs,
  paymentPhase,
  paymentReturnUrl,
  POLL_FAST_MS,
  POLL_FAST_WINDOW_MS,
  POLL_GRACE_MS,
  POLL_MAX_MS,
  POLL_SLOW_MS,
  remainingMs,
} from "../kaspi-payment";

/**
 * Правила оплаты предзаказа через Kaspi.
 *
 * Ломается это ДОРОГО и тихо: у Kaspi нет песочницы, поэтому каждая ошибка
 * здесь стоит настоящих денег на настоящем счёте. Отсюда и объём — это
 * единственное место, где поведение оплаты можно проверить, ничего не оплатив.
 */

const NOW = Date.parse("2026-08-29T12:00:00.000Z");

function payment(overrides: Partial<BookingPayment> = {}): BookingPayment {
  return {
    id: "pay-1",
    bookingId: "b-1",
    purpose: "preorder",
    status: "created",
    amountMinor: 1_200_000,
    currency: "KZT",
    paymentUrl: "https://pay.kaspi.kz/pay/abcdef",
    expiresAt: new Date(NOW + 5 * 60_000).toISOString(),
    ...overrides,
  };
}

describe("оплачено — это только captured", () => {
  it("captured и ничто другое", () => {
    expect(isPaid("captured")).toBe(true);
    for (const status of [
      "created",
      "authorized",
      "capturing",
      "voiding",
      "voided",
      "partially_refunded",
      "refunded",
      "failed",
      "expired",
    ] satisfies PaymentStatus[]) {
      expect(isPaid(status)).toBe(false);
    }
  });
});

describe("состояние платежа", () => {
  it("без платежа — предлагаем оплатить", () => {
    expect(paymentPhase(null, NOW)).toBe("idle");
  });

  it("свежая ссылка с живым сроком — ждём оплату", () => {
    expect(paymentPhase(payment(), NOW)).toBe("awaiting");
  });

  it("captured — оплачено, и часы устройства этого не отменяют", () => {
    // Срок «истёк» час назад, но сервер уже сказал «оплачено». Порядок
    // проверок в paymentPhase обязан ставить оплату первой.
    const paid = payment({
      status: "captured",
      expiresAt: new Date(NOW - 3_600_000).toISOString(),
    });
    expect(paymentPhase(paid, NOW)).toBe("paid");
  });

  it("деньги ушли, списание дожимается — settling, а не «оплачено»", () => {
    expect(paymentPhase(payment({ status: "authorized" }), NOW)).toBe("settling");
    expect(paymentPhase(payment({ status: "capturing" }), NOW)).toBe("settling");
  });

  it.each(["expired", "failed", "voided", "refunded", "partially_refunded"] as PaymentStatus[])(
    "%s — ссылка мертва, нужна новая",
    (status) => {
      expect(paymentPhase(payment({ status }), NOW)).toBe("dead");
    },
  );

  it("статус ещё created, но срок вышел — тоже мертва", () => {
    // Вебхук Kaspi об истечении может опоздать; показывать при этом
    // отсчёт «-00:42» и живую кнопку — врать гостю.
    const stale = payment({ expiresAt: new Date(NOW - 1_000).toISOString() });
    expect(paymentPhase(stale, NOW)).toBe("dead");
  });

  it("сервер не прислал срок — ждём, а не хороним ссылку", () => {
    expect(paymentPhase(payment({ expiresAt: null }), NOW)).toBe("awaiting");
  });
});

describe("отсчёт", () => {
  it("остаток считается по expires_at сервера", () => {
    expect(remainingMs(new Date(NOW + 90_000).toISOString(), NOW)).toBe(90_000);
  });

  it("прошедший срок — ноль, а не отрицательное число", () => {
    expect(remainingMs(new Date(NOW - 90_000).toISOString(), NOW)).toBe(0);
  });

  it("нет срока и мусор вместо даты — null, это НЕ «истекло»", () => {
    expect(remainingMs(null, NOW)).toBeNull();
    expect(remainingMs("не дата", NOW)).toBeNull();
  });

  it("всегда мм:сс", () => {
    expect(formatCountdown(5 * 60_000)).toBe("05:00");
    expect(formatCountdown(59_400)).toBe("01:00");
    expect(formatCountdown(1_000)).toBe("00:01");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5_000)).toBe("00:00");
  });
});

describe("ритм опроса", () => {
  const base = {
    status: "created" as PaymentStatus | null,
    expiresAt: new Date(NOW + 5 * 60_000).toISOString(),
    now: NOW,
    appActive: true,
    sinceForegroundMs: 0,
    sinceStartMs: 0,
  };

  it("первую минуту после возврата в приложение — часто", () => {
    expect(nextPollDelayMs(base)).toBe(POLL_FAST_MS);
    expect(nextPollDelayMs({ ...base, sinceForegroundMs: POLL_FAST_WINDOW_MS - 1 })).toBe(
      POLL_FAST_MS,
    );
  });

  it("дальше — редко", () => {
    expect(nextPollDelayMs({ ...base, sinceForegroundMs: POLL_FAST_WINDOW_MS })).toBe(
      POLL_SLOW_MS,
    );
  });

  it("оплачено — опрос прекращается", () => {
    expect(nextPollDelayMs({ ...base, status: "captured" })).toBe(false);
  });

  it.each(["expired", "failed", "voided", "refunded"] as PaymentStatus[])(
    "%s — опрос прекращается",
    (status) => {
      expect(nextPollDelayMs({ ...base, status })).toBe(false);
    },
  );

  it("приложение в фоне — не опрашиваем вовсе", () => {
    expect(nextPollDelayMs({ ...base, appActive: false })).toBe(false);
  });

  it("после дедлайна ещё ждём запас — вебхук может опоздать", () => {
    const justExpired = { ...base, expiresAt: new Date(NOW - POLL_GRACE_MS + 1_000).toISOString() };
    expect(nextPollDelayMs(justExpired)).toBe(POLL_FAST_MS);
  });

  it("запас кончился — опрос прекращается", () => {
    const longExpired = { ...base, expiresAt: new Date(NOW - POLL_GRACE_MS).toISOString() };
    expect(nextPollDelayMs(longExpired)).toBe(false);
  });

  it("потолок: вечный created не опрашивается вечно", () => {
    expect(nextPollDelayMs({ ...base, expiresAt: null, sinceStartMs: POLL_MAX_MS })).toBe(false);
  });

  it("без срока опрос идёт — останавливает только потолок", () => {
    expect(nextPollDelayMs({ ...base, expiresAt: null })).toBe(POLL_FAST_MS);
  });

  it("сервера ещё не спрашивали — опрос начинается", () => {
    expect(nextPollDelayMs({ ...base, status: null })).toBe(POLL_FAST_MS);
  });
});

describe("ключ идемпотентности", () => {
  it("две попытки — два разных ключа", () => {
    const keys = new Set(Array.from({ length: 200 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(200);
  });
});

describe("return_url", () => {
  it("схема приложения и маршрут экрана брони", () => {
    expect(paymentReturnUrl("b-1")).toBe("bookeat://booking/b-1");
  });

  it("id экранируется — он попадает в адрес", () => {
    expect(paymentReturnUrl("a/b")).toBe("bookeat://booking/a%2Fb");
  });
});
