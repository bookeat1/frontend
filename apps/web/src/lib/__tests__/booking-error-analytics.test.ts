import { RepositoryError } from "@bookeat/api/client";
import { describe, expect, it } from "vitest";
import { confirmErrorReason } from "@web/lib/booking-error-analytics";

/**
 * Копия мобильного теста (`apps/mobile/src/lib/__tests__/booking-error-analytics.test.ts`)
 * для веб-копии словаря — см. комментарий в `booking-error-analytics.ts` о
 * том, почему это копия, а не общий импорт.
 *
 * Тест держит два свойства сразу: причины различаются (иначе событие
 * бесполезно) и причина ВСЕГДА из закрытого словаря — свободный текст сервера
 * в аналитику не попадает ни при каком ответе.
 */

const REASONS = new Set([
  "timeout",
  "offline",
  "unauthorized",
  "conflict",
  "validation",
  "server",
  "unknown",
]);

/** Аргументы позиционные — таков конструктор RepositoryError. */
function repoError(options: {
  status?: number;
  serverMessage?: string;
  code?: string;
  networkFailure?: boolean;
  timedOut?: boolean;
}): RepositoryError {
  return new RepositoryError(
    "boom",
    undefined,
    options.status,
    options.serverMessage,
    options.code,
    undefined,
    options.networkFailure ?? false,
    options.timedOut ?? false,
  );
}

describe("причина неудачного подтверждения брони на сайте", () => {
  it("различает таймаут, отсутствие сети, 401, конфликт слота и отказ валидации", () => {
    expect(confirmErrorReason(repoError({ networkFailure: true, timedOut: true }))).toBe("timeout");
    expect(confirmErrorReason(repoError({ networkFailure: true }))).toBe("offline");
    expect(confirmErrorReason(repoError({ status: 401 }))).toBe("unauthorized");
    expect(confirmErrorReason(repoError({ status: 409 }))).toBe("conflict");
    expect(confirmErrorReason(repoError({ status: 422 }))).toBe("validation");
    expect(confirmErrorReason(repoError({ status: 500 }))).toBe("server");
    expect(confirmErrorReason(new Error("что угодно"))).toBe("unknown");
  });

  it("никогда не отдаёт текст сервера — только значение из словаря", () => {
    const leaky = repoError({
      status: 422,
      serverMessage: 'invalid phone "+77078692233" for guest "Дамир"',
      code: "validation_failed",
    });

    const reason = confirmErrorReason(leaky);

    expect(REASONS.has(reason)).toBe(true);
    expect(reason).not.toContain("77078692233");
    expect(reason).not.toContain("Дамир");
  });
});
