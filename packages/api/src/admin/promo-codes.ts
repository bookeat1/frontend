import { RepositoryError } from "../repository";
import type { PromoCodeStatus } from "./types";

/**
 * Чистая логика раздела «Промокоды» (миграция 0108, ручки
 * `internal/transport/rest/promocodes/admin.go`) — без DOM, проверяется тестом
 * без экрана.
 */

/**
 * Чем закончилась неудачная запись кода.
 *
 * В отличие от акций/событий платформы (`platform-content.ts`), у промокодов
 * ЕСТЬ два узких кода ошибки поверх обычных — сервер специально их завёл
 * (`domain.CodePromoCodeActivated`, `domain.CodePromoCodeBadTransition`),
 * поэтому здесь есть что показать точнее, чем «сервер отклонил запись».
 */
export type PromoCodeFailureKind =
  /** 422 promo_code_activated — код уже кто-то активировал: удалять или
   * переименовывать нельзя, только архивировать/приостановить. */
  | "activated"
  /** 422 promo_code_bad_transition — такой переход статуса запрещён
   * (например, из архива обратно). */
  | "bad_transition"
  /** 404 — код или акция, на которую он ссылается, не найдены. */
  | "not_found"
  /** 409 — код с такой строкой уже существует. */
  | "duplicate"
  /** 422 validation_failed общего вида — форма не прошла проверку сервера. */
  | "refused"
  /** 403 — не администратор платформы. */
  | "forbidden"
  /** 401 — сессия истекла. */
  | "unauthorized"
  /** Всё остальное: 5xx, таймаут, offline. */
  | "unknown";

export interface PromoCodeFailure {
  kind: PromoCodeFailureKind;
  /** `false` — только когда так сказал СЕРВЕР (4xx до коммита). `"unknown"` —
   * когда неизвестно, применилась запись или нет. */
  applied: false | "unknown";
}

/** Разбирает пойманную ошибку записи промокода. Принимает `unknown`, потому
 * что стоит на `catch`. */
export function classifyPromoCodeFailure(error: unknown): PromoCodeFailure {
  const status = error instanceof RepositoryError ? error.status : undefined;
  const code = error instanceof RepositoryError ? error.code : undefined;
  if (code === "promo_code_activated") return { kind: "activated", applied: false };
  if (code === "promo_code_bad_transition") return { kind: "bad_transition", applied: false };
  switch (status) {
    case 401:
      return { kind: "unauthorized", applied: false };
    case 403:
      return { kind: "forbidden", applied: false };
    case 404:
      return { kind: "not_found", applied: false };
    case 409:
      return { kind: "duplicate", applied: false };
    case 422:
      return { kind: "refused", applied: false };
    default:
      return { kind: "unknown", applied: "unknown" };
  }
}

/**
 * Разрешённые переходы статуса кода (domain.PromoCodeStatus.CanTransitionTo,
 * повторено здесь только чтобы кнопка «Активировать»/«Приостановить» не
 * рисовалась там, где сервер её всё равно отклонит; сервер проверяет заново
 * и остаётся источником истины):
 *
 *   draft ──► active ◄──► paused
 *     │         │           │
 *     └─────────┴───► archived (терминальный)
 */
const ALLOWED_TRANSITIONS: Record<PromoCodeStatus, readonly PromoCodeStatus[]> = {
  draft: ["active", "archived"],
  active: ["paused", "archived"],
  paused: ["active", "archived"],
  archived: [],
};

/** Может ли код перейти из `from` в `to`. */
export function canTransitionPromoCodeStatus(
  from: PromoCodeStatus,
  to: PromoCodeStatus,
): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}
