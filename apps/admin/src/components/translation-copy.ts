import { classifyTranslationFailure } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";

/**
 * Русский текст отказа на записи, у которой были переводы.
 *
 * Пара «классификатор в пакете + сетка текстов в панели» — та же, что у гида
 * (`guide-copy.ts`) и платформенного контента: РЕШЕНИЕ о том, что случилось,
 * это контракт с бэкендом и проверяется без DOM, а СЛОВА живут в словаре.
 *
 * Отдельно про 422. Сервер отвечает на любую ошибку валидации общим
 * «validation failed» с общим кодом `validation`
 * (transport/rest/response/response.go), поэтому «неподдерживаемый язык» и
 * «нельзя удалить русский» на проводе неотличимы. Обе эти ситуации в панели
 * недостижимы: языка предлагается ровно три, а русский правится обычным полем и
 * поля перевода не имеет. Оставшийся 422 — это отказ по СОДЕРЖАНИЮ формы, и он
 * так и назван, без кода и без английской строки из логов.
 */
export function translationErrorMessage(error: unknown): string {
  const copy = t.admin.translations;
  switch (classifyTranslationFailure(error).kind) {
    case "refused":
      return copy.errorRefused;
    case "unauthorized":
      return copy.errorUnauthorized;
    case "forbidden":
      return copy.errorForbidden;
    case "not_found":
      return copy.errorNotFound;
    default:
      return copy.errorUnknown;
  }
}
