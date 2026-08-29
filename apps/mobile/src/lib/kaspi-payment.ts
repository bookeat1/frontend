import type { BookingPayment, PaymentStatus } from "@bookeat/api";

/**
 * Правила оплаты предзаказа через Kaspi — всё, что можно решить БЕЗ сети.
 *
 * Модуль намеренно чистый: ни одного обращения к репозиторию, ни одного
 * таймера. Здесь живут три вещи, на которых держится экран, и каждую из них
 * можно проверить тестом без мока сети:
 *
 *   1. в каком состоянии платёж (`paymentPhase`);
 *   2. сколько осталось до смерти ссылки (`remainingMs` / `formatCountdown`);
 *   3. когда спрашивать сервер снова и когда прекратить (`nextPollDelayMs`).
 *
 * # Почему опрос, а не «узнаем сразу»
 *
 * Вебхук Kaspi приходит НА СЕРВЕР. Приложение о нём не узнаёт никак, поэтому
 * состояние можно только спрашивать. Спрашиваем `GET /payments/:id`, а НЕ
 * `GET /bookings/:id/payment`: второй отдаёт только «живой» платёж
 * (`GetLiveByBookingID` — статусы authorized/capturing/voiding/captured,
 * см. internal/infrastructure/postgres/payment/payments.go), а свежесозданная
 * ссылка живёт в статусе `created`. То есть «ещё не оплачено», «уже истекло» и
 * «платежа нет вовсе» на booking-ручке выглядят одинаково — как 404, и по ней
 * невозможно отличить ожидание от мёртвой ссылки.
 */

/**
 * Фирменный красный Kaspi.kz.
 *
 * ЭТО НЕ ОФИЦИАЛЬНЫЙ АССЕТ. В репозитории нет ни логотипа Kaspi, ни лицензии
 * на него, и ни один файл сюда не скачивался. Кнопка — собственная: наша
 * геометрия, наша типографика, подпись словами «Оплатить через Kaspi». Цвет
 * взят как узнаваемый ориентир, и это тоже элемент фирменного стиля — до
 * подтверждения прав от Kaspi считать использование НЕсогласованным.
 *
 * Если права подтвердят — сюда же приедет официальный знак, и меняться будет
 * только `KaspiPayButton`.
 */
export const KASPI_BRAND_COLOR = "#F14635";

/** Состояние платежа глазами экрана. */
export type PaymentPhase =
  /** Платежа ещё нет — показываем кнопку «Оплатить». */
  | "idle"
  /** Ссылка жива, гость её ещё не оплатил. Идёт отсчёт. */
  | "awaiting"
  /** Деньги ушли, сервер дожимает списание (authorized → captured). */
  | "settling"
  /** Оплачено. Кнопки оплаты больше нет. */
  | "paid"
  /** Ссылка мертва: истекла, отменена гостем, отклонена банком. Нужна новая. */
  | "dead";

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
 * В каком состоянии платёж на момент `now`.
 *
 * Часы устройства участвуют ТОЛЬКО в одном решении — «срок вышел, а статус всё
 * ещё `created`». Это честно: сервер узнает об истечении лишь из вебхука Kaspi,
 * который может опоздать, а гостю нельзя показывать отсчёт «-00:42». В обратную
 * сторону часы не работают: если сервер уже сказал `captured`, никакая местная
 * дата этого не отменяет — поэтому оплата проверяется ПЕРВОЙ.
 */
export function paymentPhase(payment: BookingPayment | null, now: number): PaymentPhase {
  if (!payment) return "idle";
  if (isPaid(payment.status)) return "paid";
  if (DEAD_STATUSES.includes(payment.status)) return "dead";
  if (payment.status === "authorized" || payment.status === "capturing") return "settling";
  // created / voiding: ссылка есть, денег нет. Жива ли она — решает срок.
  if (remainingMs(payment.expiresAt, now) === 0) return "dead";
  return "awaiting";
}

/**
 * Сколько миллисекунд осталось до `expiresAt`.
 *
 * `0` — срок вышел. `null` — срока НЕТ (сервер его не прислал или прислал
 * неразбираемый). Это разные вещи, и путать их нельзя: без срока отсчитывать
 * нечего, но и объявлять ссылку мёртвой не за что.
 */
export function remainingMs(expiresAt: string | null, now: number): number | null {
  if (!expiresAt) return null;
  const deadline = Date.parse(expiresAt);
  if (!Number.isFinite(deadline)) return null;
  return Math.max(0, deadline - now);
}

/** «04:59». Всегда мм:сс — ссылка Kaspi живёт минуты, часы здесь не нужны. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Частый опрос — первую минуту после возврата из Kaspi. Гость только что
 * нажал «Оплатить» в приложении банка и смотрит в наш экран; здесь важна
 * каждая секунда ожидания.
 */
export const POLL_FAST_MS = 3_000;
/** Дальше — раз в 10 секунд: человек уже не смотрит в экран не отрываясь. */
export const POLL_SLOW_MS = 10_000;
/** Длительность «частого» окна после каждого возврата в приложение. */
export const POLL_FAST_WINDOW_MS = 60_000;
/**
 * Запас после `expires_at`. Вебхук Kaspi приходит не мгновенно, и оплата,
 * сделанная на последней секунде, доедет до нас чуть позже дедлайна.
 */
export const POLL_GRACE_MS = 30_000;
/**
 * Жёсткий потолок на одну ссылку. Даже если сервер почему-то навсегда завис в
 * `created`, опрос обязан кончиться — иначе экран, забытый открытым, будет
 * долбить сервер до разряда батареи.
 */
export const POLL_MAX_MS = 15 * 60_000;

export interface PollState {
  /** Что сервер ответил в прошлый раз; `null` — ещё ни разу не спрашивали. */
  status: PaymentStatus | null;
  expiresAt: string | null;
  now: number;
  /** Приложение на переднем плане. В фоне не опрашиваем вовсе. */
  appActive: boolean;
  /** Сколько прошло с последнего возврата приложения на передний план. */
  sinceForegroundMs: number;
  /** Сколько прошло с начала опроса ЭТОЙ ссылки. */
  sinceStartMs: number;
}

/**
 * Через сколько спросить сервер снова, или `false` — «прекратить опрос».
 *
 * Останов возможен по четырём причинам, и все четыре обязательны:
 *   • терминальный статус (оплачено / мертво) — спрашивать больше нечего;
 *   • приложение ушло в фон — гость его не видит, а батарея одна;
 *   • дедлайн ссылки прошёл с запасом — оплате уже неоткуда взяться;
 *   • упёрлись в потолок `POLL_MAX_MS` — защита от вечного `created`.
 */
export function nextPollDelayMs(state: PollState): number | false {
  if (!state.appActive) return false;
  if (state.status !== null) {
    if (isPaid(state.status)) return false;
    if (DEAD_STATUSES.includes(state.status)) return false;
  }
  if (state.sinceStartMs >= POLL_MAX_MS) return false;
  const left = remainingMs(state.expiresAt, state.now);
  // `null` (сервер не прислал срок) опрос не останавливает — тогда работает
  // только потолок. Останавливает лишь ИЗВЕСТНЫЙ и уже прошедший дедлайн.
  if (left === 0 && !withinGrace(state)) return false;
  return state.sinceForegroundMs < POLL_FAST_WINDOW_MS ? POLL_FAST_MS : POLL_SLOW_MS;
}

/** Дедлайн прошёл, но ещё не настолько давно, чтобы бросать опрос. */
function withinGrace(state: PollState): boolean {
  if (!state.expiresAt) return false;
  const deadline = Date.parse(state.expiresAt);
  if (!Number.isFinite(deadline)) return false;
  return state.now - deadline < POLL_GRACE_MS;
}

/**
 * Ключ идемпотентности для `POST /bookings/:id/payment`.
 *
 * Не криптографический — он должен быть лишь уникален на устройство и на
 * попытку (`crypto.randomUUID` есть не в каждой сборке Hermes, которую
 * поставляет Expo). Та же функция, что и у создания брони.
 *
 * ВАЖНО: один ключ = одна попытка. Повтор с ТЕМ ЖЕ ключом сервер отдаёт как
 * повтор прежнего платежа (`CreateForBooking` в
 * internal/usecase/payments/create.go), поэтому двойное нажатие не создаёт
 * второй счёт. Новый ключ мнётся ТОЛЬКО когда гость сам просит новую ссылку
 * взамен истёкшей.
 */
/**
 * `return_url` для `POST /bookings/:id/payment`.
 *
 * Собственная схема приложения (`"scheme": "bookeat"` в app.json), а не
 * https-адрес: единственное осмысленное «куда вернуть гостя» — это тот самый
 * экран брони, с которого он ушёл платить, и путь совпадает с маршрутом
 * expo-router `app/booking/[id]`.
 *
 * Kaspi этот адрес НЕ ИСПОЛЬЗУЕТ вовсе — его адаптер (`internal/
 * infrastructure/payment/kaspi`) не читает ReturnURL ни разу. Но ручка
 * отказывает на пустом значении (`createPaymentRequest.validate`), и врать ей
 * пустышкой вроде "about:blank" незачем, когда есть честный адрес.
 */
export function paymentReturnUrl(bookingId: string): string {
  return `bookeat://booking/${encodeURIComponent(bookingId)}`;
}

export function newIdempotencyKey(): string {
  return `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
