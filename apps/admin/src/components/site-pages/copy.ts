import { t } from "@/lib/i18n";
import { platformContentErrorText } from "../platform-content/copy";

export const copy = t.admin.sitePages;

/**
 * Что редактор прочитает после неудачного `GET`/`PUT` страницы сайта.
 *
 * Переиспользует `platformContentErrorText` из «Контента платформы» —
 * 401/403/404/422/неизвестная ошибка значат ровно то же самое здесь: доступ
 * только суперадмину, слаг либо есть, либо нет, а «validation failed» сервер
 * так же подменяет общим кодом без деталей (см. комментарий в
 * `platform-content/copy.ts`). Заводить вторую копию той же таблицы ради
 * другого экрана было бы держать одну мысль в двух местах.
 */
export const sitePageErrorText = platformContentErrorText;
