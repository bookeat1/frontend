import { RepositoryError } from "@bookeat/api";
import { describe, expect, it } from "vitest";
import { confirmErrorReason } from "../booking-error-analytics";

/**
 * Событие `booking_confirm_error` появилось потому, что до него воронка брони
 * состояла из одних успехов: `booking_confirm` отправлялся только из ветки
 * `onSuccess`, и провалившееся подтверждение в аналитике не существовало
 * вовсе.
 *
 * Тест держит два свойства сразу: причины различаются (иначе событие
 * бесполезно — «что-то сломалось» и без него видно) и причина ВСЕГДА из
 * закрытого словаря, то есть свободный текст сервера в аналитику не попадает
 * ни при каком ответе.
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

describe("причина неудачного подтверждения брони", () => {
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
    // Ровно тот случай, из-за которого словарь и нужен: ответ сервера
    // пересказывает тело запроса, а в нём имя и телефон гостя.
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
