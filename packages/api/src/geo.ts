/**
 * Геопозиция гостя в запросе каталога (спека geolocation-permission.md, A1).
 *
 * ПРАВИЛА, а не пожелания:
 *  - координаты уходят ТОЛЬКО в `GET /restaurants/search` без текста запроса и
 *    ТОЛЬКО округлёнными до 3 знаков (~100 м): для порядка внутри города этого
 *    хватает, а точная точка гостя на сервер не попадает;
 *  - они НЕ часть `SearchFilters`: это не фильтр, а способ упорядочить, и счётчик
 *    активных фильтров, чипы и аналитика о них не знают;
 *  - их нельзя писать на диск, в URL приложения, в логи и в аналитику.
 */

/** Точка на карте. Градусы WGS84. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Знаков после запятой, с которыми координата покидает устройство. */
export const GEO_PRECISION_DIGITS = 3;

/**
 * Округляет точку до {@link GEO_PRECISION_DIGITS} знаков. Возвращает `undefined`
 * для всего, что не является настоящей парой координат (NaN, бесконечность,
 * широта вне ±90, долгота вне ±180): сервер такое молча игнорирует, и клиенту
 * нет смысла это отправлять.
 *
 * Используется и репозиторием (что уходит в URL), и ключом кэша react-query
 * (чтобы дрожание GPS в пределах 100 м не плодило запросы).
 */
export function roundGeoPoint(point: GeoPoint | undefined | null): GeoPoint | undefined {
  if (!point) return undefined;
  const { lat, lng } = point;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  const factor = 10 ** GEO_PRECISION_DIGITS;
  // `+ 0` превращает -0 в 0: «-0.000» в URL смотрелось бы как мусор.
  return { lat: Math.round(lat * factor) / factor + 0, lng: Math.round(lng * factor) / factor + 0 };
}
