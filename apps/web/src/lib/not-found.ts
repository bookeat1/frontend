/**
 * 404 — это ответ сервера «такой записи нет», а не сбой связи: экран
 * показывает «не найдено», а запрос не повторяется. `HttpError` из
 * `@bookeat/api` несёт `status`; сюда доходит `unknown` из TanStack Query.
 */
export function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === 404
  );
}
