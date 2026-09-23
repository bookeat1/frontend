/**
 * Хранилище одной незавершённой попытки оплаты предзаказа на бронь —
 * переживает возврат из Kaspi.
 *
 * НА МОБИЛКЕ ЭТОГО НЕТ: там `useKaspiPaymentFlow` живёт, пока жив компонент
 * экрана, а возврат из Kaspi — это переключение приложений, не перезапуск
 * JS. На сайте гость уходит на `pay.kaspi.kz` и возвращается ПОЛНОЙ
 * перезагрузкой страницы — весь React-стейт (id платежа, ключ
 * идемпотентности) стирается. Без этого хранилища «Проверить оплату» после
 * возврата не знал бы, какой платёж спрашивать, и создал бы новый счёт по
 * тому же нажатию «Оплатить», рискуя двойным списанием, если бы не ключ
 * идемпотентности, — а с ним просто ничего не нашёл бы и предложил бы платить
 * заново, хотя ссылка уже могла быть оплачена.
 *
 * `sessionStorage`, а не адрес: попытка привязана к вкладке и визиту, как и
 * остальные веб-черновики (`booking-form-draft.ts`, `preorder-failed-flag.ts`).
 */

export interface KaspiPaymentAttempt {
  paymentId: string;
  idempotencyKey: string;
}

const PREFIX = "bookeat.web.kaspi-payment.";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    // Safari в приватном режиме БРОСАЕТ на обращении, а не отдаёт null.
    return null;
  }
}

function key(bookingId: string): string {
  return `${PREFIX}${bookingId}`;
}

export function readKaspiPaymentAttempt(bookingId: string): KaspiPaymentAttempt | null {
  const raw = storage()?.getItem(key(bookingId)) ?? null;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<KaspiPaymentAttempt>;
    if (typeof parsed.paymentId === "string" && typeof parsed.idempotencyKey === "string") {
      return { paymentId: parsed.paymentId, idempotencyKey: parsed.idempotencyKey };
    }
  } catch {
    // Испорченный JSON — как будто попытки не было.
  }
  return null;
}

export function writeKaspiPaymentAttempt(bookingId: string, attempt: KaspiPaymentAttempt): void {
  try {
    storage()?.setItem(key(bookingId), JSON.stringify(attempt));
  } catch {
    // Хранилище недоступно — гость просто не увидит статус после
    // перезагрузки и сможет нажать «Оплатить» ещё раз. Деньги при этом целы:
    // защищает `Idempotency-Key` на сервере, а не это хранилище.
  }
}

export function clearKaspiPaymentAttempt(bookingId: string): void {
  try {
    storage()?.removeItem(key(bookingId));
  } catch {
    // См. выше.
  }
}
