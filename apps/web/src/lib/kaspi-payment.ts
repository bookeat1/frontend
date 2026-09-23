import type { BookingPayment, PaymentStatus } from "@bookeat/api/client";

/**
 * Правила оплаты предзаказа через Kaspi — веб-версия. Логика ЦЕЛИКОМ повторяет
 * `apps/mobile/src/lib/kaspi-payment.ts` (тот же бэкенд, тот же контракт),
 * только `paymentReturnUrl` другой: у сайта нет своей схемы (`bookeat://`),
 * гостя возвращают на ту же страницу браузером.
 *
 * Модуль намеренно чистый: ни одного обращения к сети, ни `window`, ни
 * `document` — поэтому каждое правило можно проверить тестом без мока.
 *
 * # Почему опрос, а не «узнаем сразу»
 *
 * Вебхук Kaspi приходит НА СЕРВЕР, а не на сайт. Состояние можно только
 * спрашивать — `GET /payments/:id`, а НЕ `GET /bookings/:id/payment`: второй
 * отдаёт только «живой» платёж (authorized/capturing/voiding/captured), и
 * свежесозданная ссылка в статусе `created` там неотличима от «платежа нет
 * вовсе» — оба 404.
 */

/** Состояние платежа глазами экрана. */
export type PaymentPhase = "idle" | "awaiting" | "settling" | "paid" | "dead";

/** Статусы, после которых ссылка уже не оживёт. */
const DEAD_STATUSES: PaymentStatus[] = [
  "expired",
  "failed",
  "voided",
  "refunded",
  "partially_refunded",
];

/** Оплачено — единственное значение, которое разрешено считать оплатой. */
export function isPaid(status: PaymentStatus): boolean {
  return status === "captured";
}

/**
 * В каком состоянии платёж на момент `now`. Оплата проверяется ПЕРВОЙ: если
 * сервер уже сказал `captured`, никакая местная дата этого не отменяет.
 */
export function paymentPhase(payment: BookingPayment | null, now: number): PaymentPhase {
  if (!payment) return "idle";
  if (isPaid(payment.status)) return "paid";
  if (DEAD_STATUSES.includes(payment.status)) return "dead";
  if (payment.status === "authorized" || payment.status === "capturing") return "settling";
  if (remainingMs(payment.expiresAt, now) === 0) return "dead";
  return "awaiting";
}

/** Статусы, при которых деньги гостя УЖЕ ушли. */
const SETTLED_STATUSES: PaymentStatus[] = ["authorized", "capturing", "captured"];

/** Что страница брони делает с блоком «Оплата предзаказа». */
export interface PreorderPaymentGate {
  /** Рисовать ли блок вообще. */
  visible: boolean;
  /** Можно ли предлагать НОВЫЙ счёт: кнопки «Оплатить» и «новая ссылка». */
  payable: boolean;
}

/**
 * Показывать ли блок оплаты предзаказа — ОДНО решение в одном месте. См.
 * доку `preorderPaymentGate` в мобильном модуле — правило то же:
 * подключение решает поле заведения `acceptsOnlinePayment`, а уже оплаченный
 * предзаказ остаётся видимым чеком даже у отключённого заведения.
 */
export function preorderPaymentGate(input: {
  bookingIsLive: boolean;
  preorderItemsCount: number;
  venueAcceptsOnlinePayment: boolean;
  existingPayment: BookingPayment | null | undefined;
}): PreorderPaymentGate {
  const somethingToPayFor = input.bookingIsLive && input.preorderItemsCount > 0;
  const payable = somethingToPayFor && input.venueAcceptsOnlinePayment;
  const settled =
    somethingToPayFor &&
    input.existingPayment != null &&
    input.existingPayment.purpose === "preorder" &&
    SETTLED_STATUSES.includes(input.existingPayment.status);
  return { visible: payable || settled, payable };
}

/** Сколько миллисекунд осталось до `expiresAt`. `0` — срок вышел, `null` —
 * срока НЕТ. */
export function remainingMs(expiresAt: string | null, now: number): number | null {
  if (!expiresAt) return null;
  const deadline = Date.parse(expiresAt);
  if (!Number.isFinite(deadline)) return null;
  return Math.max(0, deadline - now);
}

/** «04:59». */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Частый опрос — первую минуту после того, как вкладка снова на переднем
 * плане (возврат из Kaspi открывает ту же вкладку). */
export const POLL_FAST_MS = 3_000;
/** Дальше — раз в 10 секунд. */
export const POLL_SLOW_MS = 10_000;
/** Длительность «частого» окна после каждого возврата фокуса на вкладку. */
export const POLL_FAST_WINDOW_MS = 60_000;
/** Запас после `expires_at` — вебхук Kaspi приходит не мгновенно. */
export const POLL_GRACE_MS = 30_000;
/** Жёсткий потолок на одну ссылку. */
export const POLL_MAX_MS = 15 * 60_000;

export interface PollState {
  status: PaymentStatus | null;
  expiresAt: string | null;
  now: number;
  /** Вкладка видима (`document.visibilityState === "visible"`). В фоне не
   * опрашиваем вовсе — как мобилка не опрашивает в фоне приложения. */
  appActive: boolean;
  sinceForegroundMs: number;
  sinceStartMs: number;
}

/** Через сколько спросить сервер снова, или `false` — «прекратить опрос».
 * Правила те же, что у мобилки: терминальный статус, вкладка в фоне, дедлайн
 * с запасом, потолок `POLL_MAX_MS`. */
export function nextPollDelayMs(state: PollState): number | false {
  if (!state.appActive) return false;
  if (state.status !== null) {
    if (isPaid(state.status)) return false;
    if (DEAD_STATUSES.includes(state.status)) return false;
  }
  if (state.sinceStartMs >= POLL_MAX_MS) return false;
  const left = remainingMs(state.expiresAt, state.now);
  if (left === 0 && !withinGrace(state)) return false;
  return state.sinceForegroundMs < POLL_FAST_WINDOW_MS ? POLL_FAST_MS : POLL_SLOW_MS;
}

function withinGrace(state: PollState): boolean {
  if (!state.expiresAt) return false;
  const deadline = Date.parse(state.expiresAt);
  if (!Number.isFinite(deadline)) return false;
  return state.now - deadline < POLL_GRACE_MS;
}

/**
 * `return_url` для `POST /bookings/:id/payment` — та же страница брони,
 * откуда гость ушёл платить. Kaspi его не использует (адаптер не читает
 * ReturnURL), но ручка отказывает на пустом значении.
 *
 * `origin` передаётся вызывающим (`window.location.origin`), а не читается
 * здесь — модуль остаётся чистым и проверяемым тестом без DOM.
 */
export function paymentReturnUrl(origin: string, bookingId: string): string {
  return `${origin}/bookings/${encodeURIComponent(bookingId)}`;
}

/**
 * Ключ идемпотентности для `POST /bookings/:id/payment`. Один ключ = одна
 * попытка; повтор с ТЕМ ЖЕ ключом сервер отдаёт как повтор прежнего платежа.
 */
export function newIdempotencyKey(): string {
  return `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
