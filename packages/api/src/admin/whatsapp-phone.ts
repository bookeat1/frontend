/**
 * Приведение номера WhatsApp к тому виду, в котором его хранит сервер.
 *
 * Почему это здесь, а не в компоненте: правило принадлежит контракту с
 * бэкендом (`internal/auth/phone.Normalize` + порог длины в
 * `usecase/restaurants.normalizeWhatsApp`), и проверяться должно без DOM.
 * Прецеденты — `parsePriceRangeInput`, `classifyCapacitySwitchFailure`.
 */

/**
 * Тот же рынок и тот же умолчательный код +7, что у сервера: «8 707 …»,
 * «+7 707 …» и «7071234567» — один и тот же номер, и панель обязана отправить
 * ту же строку, которую сервер сохранит, иначе поле после сохранения
 * перерисуется чужим значением.
 *
 * Пустая строка означает «номера нет» — это не ошибка сама по себе, номер
 * можно и стереть.
 */
export function normalizeWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return "";
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  if (digits.length === 10) return `+7${digits}`;
  return `+${digits}`;
}

/**
 * Проверка ФОРМЫ номера, не существования: 11 цифр плюс «+» — самый короткий
 * номер этого рынка, и ровно этот порог стоит на бэкенде (len < 12 → 422).
 * Есть ли номер в WhatsApp, покажет только первая отправка.
 */
export function isWhatsAppPhoneShaped(normalized: string): boolean {
  return normalized.startsWith("+") && normalized.length >= 12;
}
