import type { Dictionary } from "@bookeat/i18n";
import { RepositoryError, type BookingConflictKind } from "@bookeat/api/client";

/**
 * Что показать гостю, когда сервер отказал в брони, и ключ идемпотентности
 * для повтора той же брони.
 *
 * Лежит отдельным модулем, потому что отказы разбираются на СТРАНИЦЕ
 * бронирования (создание и перенос), а раньше жили в карточке правой колонки
 * — карточка теперь только ссылка, и второй копии разбора быть не должно.
 */
export interface SubmitFailure {
  title: string;
  text: string;
  /** Бронь ТОЧНО существует — отправлять снова нельзя ни при каких условиях. */
  blocksSubmit?: boolean;
}

/**
 * Отказ сервера — словами гостя.
 *
 * ВЕТВИМСЯ ПО МАШИННОМУ КОДУ, НИКОГДА ПО ТЕКСТУ ОШИБКИ. На этом уже стоял
 * баг в приложении: предикат «бронь уже есть» опознавался по подстроке
 * `already exists`, а сервер отдавал тот же текст и при обычной гонке за слот,
 * и гостю сообщали о брони, которой не было
 * (`bugs/bookeat-frontend-409-told-guest-a-booking-that-never-existed`).
 *
 * Неизвестный код — ОТДЕЛЬНЫЙ исход, а не «значит, стол занят» и не «значит,
 * бронь есть»: цена ошибки в эту сторону — гость, который не пришёл в
 * ресторан, потому что был уверен, что стол за ним.
 *
 * `dropSlot` зовётся только там, где брони ТОЧНО нет и выбранное время уже
 * не свободно: кнопка не должна предлагать отправить то же самое ещё раз.
 */
export function describeBookingFailure(
  error: unknown,
  t: Dictionary,
  dropSlot: () => void,
): SubmitFailure {
  const errors = t.web.booking.errors;
  const conflict = error instanceof RepositoryError ? error.bookingConflict : null;
  if (conflict) return conflictFailure(conflict, errors, dropSlot);
  if (error instanceof RepositoryError && error.isValidation) {
    return { title: errors.validationTitle, text: errors.validationText };
  }
  return { title: errors.genericTitle, text: errors.genericText };
}

function conflictFailure(
  conflict: BookingConflictKind,
  errors: Dictionary["web"]["booking"]["errors"],
  dropSlot: () => void,
): SubmitFailure {
  switch (conflict) {
    case "slot_taken":
      dropSlot();
      return { title: errors.slotTakenTitle, text: errors.slotTakenText };
    case "no_table_available":
      dropSlot();
      return { title: errors.noTableTitle, text: errors.noTableText };
    case "idempotency_key_reused":
      // Здесь бронь ТОЧНО есть. Повторная отправка дала бы второй стол,
      // поэтому кнопка блокируется до смены выбора.
      return { title: errors.duplicateTitle, text: errors.duplicateText, blocksSubmit: true };
    case "unknown":
      return { title: errors.ambiguousTitle, text: errors.ambiguousText };
  }
}

/**
 * Ключ идемпотентности. `crypto.randomUUID` есть во всех браузерах, где
 * работает сайт, но не в каждом окружении сборки и тестов — запасной путь
 * собирает то же самое из `getRandomValues`, а не из `Math.random`.
 */
export function newIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  cryptoApi?.getRandomValues?.(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** 404 — это ответ сервера «такого нет», а не сбой связи, и экран говорит
 * об этом другими словами. */
export function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === 404
  );
}

/** Адрес почты — грубая проверка формы: «что-то@что-то.что-то». Строгая
 * грамматика RFC здесь навредила бы: сервер всё равно проверит сам, а поле
 * необязательное — ошибка нужна только против явной опечатки. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
