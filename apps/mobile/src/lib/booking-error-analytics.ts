import { RepositoryError } from "@bookeat/api";

/**
 * Короткое имя причины, по которой бронь не подтвердилась, — для свойства
 * `reason` события `booking_confirm_error`.
 *
 * СЛОВАРЬ, А НЕ ТЕКСТ СЕРВЕРА, и это главное свойство этого файла. Сообщение
 * об ошибке сервер пишет свободной строкой и время от времени вставляет в неё
 * то, что пришло в запросе, — а в запросе на бронь лежат имя и телефон гостя.
 * Один такой текст в свойстве события — и персональные данные снова уезжают в
 * Amplitude, ровно как это уже случилось с текстом поискового запроса.
 * Значений здесь ровно семь, и все они написаны здесь.
 *
 * Порядок веток не случаен: таймаут ТОЖЕ помечен как сетевой сбой, поэтому
 * более частный случай проверяется первым (см. RepositoryError.isTimeout).
 */
export function confirmErrorReason(error: unknown): string {
  if (!(error instanceof RepositoryError)) return "unknown";
  if (error.isTimeout) return "timeout";
  if (error.isOffline) return "offline";
  if (error.isUnauthorized) return "unauthorized";
  if (error.bookingConflict) return "conflict";
  if (error.isValidation) return "validation";
  return "server";
}
