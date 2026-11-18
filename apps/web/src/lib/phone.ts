/**
 * Номер телефона на САЙТЕ.
 *
 * Разбор, маска и справочник стран — общие с приложением: пакет
 * `@bookeat/phone`. Номер — это всегда пара (страна, национальные цифры);
 * страну гость выбирает в поле (`ui/PhoneField.tsx`), а наружу — в состояние
 * экрана, в черновик, на сервер — уходит только E.164 («+77012345678»).
 * Нормализатор бэкенда (internal/auth/phone/phone.go) значение, начинающееся
 * с «+», оставляет цифра в цифру, поэтому показанный и сохранённый номер
 * совпадают.
 *
 * ЧТО ЗДЕСЬ СВОЕГО — только вид маски. Макет сайта (Figma 3272:16) рисует
 * «777 123-45-67» без скобок, приложение — «(777) 123-45-67». Это два разных
 * визуальных языка, поэтому стиль задаётся параметром общего форматтера, а
 * этот модуль закрепляет за сайтом вариант без скобок.
 */
import {
  formatNational as formatNationalShared,
  formatStoredPhoneForDisplay,
  type Country,
} from "@bookeat/phone";

export {
  applyPhoneEdit,
  countriesByName,
  DEFAULT_COUNTRY,
  emptyPhone,
  guessCountryByIp,
  isE164Complete,
  nationalLength,
  parsePhoneInput,
  phoneFromE164,
  toE164,
  type Country,
  type PhoneValue,
} from "@bookeat/phone";

/** «777 123-45-67» — национальная часть в маске сайта. */
export function formatNational(national: string, country: Country): string {
  return formatNationalShared(national, country, "plain");
}

/**
 * Номер, как его хранит сервер («+77771234567»), в читаемом виде:
 * «+7 777 123-45-67». Номер страны, формат которой мы не знаем, возвращается
 * как есть — настоящий неформатированный номер лучше выдуманного красивого.
 */
export function formatStoredPhone(e164: string): string {
  return formatStoredPhoneForDisplay(e164, "plain");
}
