import { AdminApiError } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";
import { platformContentErrorText } from "../platform-content/copy";

export const copy = t.admin.sitePages;

/**
 * Что редактор прочитает после неудачного `GET`/`PUT` страницы сайта.
 *
 * Один случай здесь УЖЕ отличается от «Контента платформы»: попытка включить
 * публикацию (`published: true`) с пустым `body` — это не общий 422, а
 * бэкенд присылает узкий `code: "page_body_empty"`
 * (`internal/transport/rest/platformpages`, PR #115) специально для того,
 * чтобы редактор мог назвать причину, а не «validation failed». Остальные
 * исходы (401/403/404/прочий 422/неизвестная ошибка) переиспользуют
 * `platformContentErrorText` — там сервер ничего точнее общего кода не
 * присылает, заводить вторую копию той же таблицы ради одного экрана было бы
 * держать одну мысль в двух местах.
 */
export function sitePageErrorText(error: unknown): string {
  if (error instanceof AdminApiError && error.code === "page_body_empty") {
    return copy.errorBodyEmpty;
  }
  return platformContentErrorText(error);
}
