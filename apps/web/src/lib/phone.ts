/**
 * Номер телефона для входа на САЙТЕ — только Казахстан.
 *
 * ПОЧЕМУ НЕ ПЕРЕИСПОЛЬЗУЕМ мобильный `apps/mobile/src/lib/phone.ts`: он лежит
 * внутри приложения Expo, а не в общем пакете, и тянет за собой справочник
 * стран и логику переключения страны на лету. Вынести его в `packages/` —
 * отдельная задача с правкой мобилки, а её в этот заход трогать нельзя.
 *
 * Макет входа (Figma 3272:2) рисует фиксированный префикс «KZ +7» без выбора
 * страны, и это ровно та аудитория, ради которой сайт делается. Гость с
 * иностранным номером войти на сайте пока не сможет — это ЗАЯВЛЕННОЕ
 * ограничение, а не забытый случай.
 *
 * Формат, который уходит на сервер, — E.164 («+7XXXXXXXXXX»). Нормализатор
 * бэкенда (internal/auth/phone/phone.go) значение, уже начинающееся с «+»,
 * оставляет цифра в цифру, поэтому показанный и сохранённый номер совпадают.
 */

/** Код страны без «+». */
export const KZ_DIAL = "7";

/** Сколько цифр в казахстанском номере без кода страны. */
export const KZ_NATIONAL_LENGTH = 10;

/**
 * Оставляет от ввода только национальные цифры.
 *
 * Разбирается и со вставкой из буфера: «+7 701 234 56 78», «87012345678»,
 * «7 (701) 234-56-78» — всё это один и тот же номер. Ведущая «8» — привычная
 * междугородняя форма в Казахстане и России, и гость вставляет её постоянно.
 */
export function nationalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8") && digits.length > KZ_NATIONAL_LENGTH) digits = digits.slice(1);
  else if (digits.startsWith(KZ_DIAL) && digits.length > KZ_NATIONAL_LENGTH) digits = digits.slice(1);
  return digits.slice(0, KZ_NATIONAL_LENGTH);
}

/** «777 123-45-67» — маска из макета (узел 3272:16). Маска НЕ дописывает
 * ничего сверх набранного: подсказку рисует placeholder, а не значение. */
export function formatNational(digits: string): string {
  const d = digits.slice(0, KZ_NATIONAL_LENGTH);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
  if (parts.length <= 1) return parts.join("");
  return `${parts[0]} ${parts.slice(1).join("-")}`;
}

export function isComplete(digits: string): boolean {
  return digits.length === KZ_NATIONAL_LENGTH;
}

/** То, что уходит на сервер. */
export function toE164(digits: string): string {
  return `+${KZ_DIAL}${digits}`;
}

/** «+7 777 123-45-67» — для строки «отправили код на …». */
export function formatForDisplay(digits: string): string {
  return `+${KZ_DIAL} ${formatNational(digits)}`;
}

/**
 * ОБРАТНЫЙ разбор: национальные цифры из номера, который уже ХРАНИТСЯ в E.164
 * (профиль, бронь с сервера). Не-казахстанский номер → `null`.
 *
 * Это НЕ `nationalDigits`: тот рассчитан на ввод с клавиатуры и для строки,
 * не начинающейся на 7/8, просто берёт первые десять цифр. Пропущенный через
 * него «+4915112345678» превратился бы в «4915112345» — десять цифр,
 * `isComplete` доволен, `toE164` приклеивает «+7», и на сервер уходит
 * фальшивый номер, по которому заведение никому не дозвонится. Пустое поле с
 * честной ошибкой «нужен казахстанский номер» лучше такого.
 */
export function kzNationalDigits(e164: string): string | null {
  const digits = e164.replace(/\D/g, "");
  if (digits.length !== KZ_NATIONAL_LENGTH + 1 || !digits.startsWith(KZ_DIAL)) return null;
  return digits.slice(1);
}
