/**
 * Предлагать ли гостю оплату предзаказа у этого заведения — ОДНО решение для
 * сайта и приложения (bookeat1/backend#163).
 *
 * Оплата предлагается, когда заведение принимает онлайн-оплату
 * (`acceptsOnlinePayment === true`) И сервер не сказал явно, что предзаказ
 * оплаты не требует (`preorderPaymentRequired !== false`). Явное `false` —
 * это ровно тот случай, где `POST /bookings/:id/payment` отвечает 422
 * «this booking requires no payment», так что кнопка была бы ловушкой.
 * `null`/нет поля — старый бэкенд: поведение прежнее (оплату предлагаем).
 *
 * Оговорка: `false` НЕ всегда значит «платить нечего вообще». Бронь всё равно
 * может стать платной по депозиту заведения или по особому дню с оплатой.
 * Сегодня ни одно боевое заведение депозиты не использует, поэтому правило
 * держим простым; когда депозиты появятся, решение придётся уточнять по брони,
 * а не по заведению (сервер ответит 422 `payment_not_required`, если платить
 * действительно нечего, и клиент покажет спокойное объяснение).
 */
export function venueOffersPreorderPayment(
  venue: { acceptsOnlinePayment: boolean; preorderPaymentRequired?: boolean | null } | null | undefined,
): boolean {
  return venue?.acceptsOnlinePayment === true && venue.preorderPaymentRequired !== false;
}
