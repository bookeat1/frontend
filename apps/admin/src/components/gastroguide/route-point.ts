/**
 * Координаты остановки гастропрогулки: разбор двух полей формы.
 *
 * Живёт отдельно от компонента, потому что это ровно та часть, которая может
 * ошибиться молча. Пара широта/долгота — это ОДНО значение из двух полей, и у
 * неё три исхода, а не два:
 *
 *   none    — оба поля пусты. Это нормально: у остановки может не быть точки
 *             на карте, и «пусто» не должно превращаться в 0,0 (Гвинейский
 *             залив) — приложение поставило бы туда булавку.
 *   ok      — оба поля заполнены и в допустимых пределах.
 *   ошибки  — заполнено ровно одно (полкоординаты бесполезны) или введено не
 *             число / число вне диапазона.
 *
 * Проверка диапазона здесь не «на всякий случай»: перепутанные местами широта
 * и долгота Алматы (43.2, 76.9) остаются валидными числами и дают точку в
 * Северном Ледовитом океане, а вот 76.9 в поле широты — уже нет, и это
 * единственное место, где такую опечатку можно поймать до записи.
 */

export type PointCoordinates =
  | { kind: "none" }
  | { kind: "ok"; latitude: number; longitude: number }
  /** Заполнено ровно одно поле. */
  | { kind: "incomplete" }
  /** Не число или вне диапазона. */
  | { kind: "invalid" };

export function parsePointCoordinates(rawLat: string, rawLng: string): PointCoordinates {
  const lat = rawLat.trim();
  const lng = rawLng.trim();

  if (!lat && !lng) return { kind: "none" };
  if (!lat || !lng) return { kind: "incomplete" };

  // Запятая как десятичный разделитель — то, что реально копируют из карт и
  // набирают на русской раскладке. Number("43,2") даёт NaN.
  const latitude = Number(lat.replace(",", "."));
  const longitude = Number(lng.replace(",", "."));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { kind: "invalid" };
  if (latitude < -90 || latitude > 90) return { kind: "invalid" };
  if (longitude < -180 || longitude > 180) return { kind: "invalid" };

  return { kind: "ok", latitude, longitude };
}

/** Как координата показывается в поле формы. `null` — поле пустое, а НЕ ноль. */
export function coordinateFieldValue(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}
