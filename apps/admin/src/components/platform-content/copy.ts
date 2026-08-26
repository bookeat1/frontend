import type { ActionUrlProblem, PlatformContentFailureKind } from "@bookeat/api/admin";
import { classifyPlatformContentFailure } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";

export const copy = t.admin.platformContent;

/**
 * Формулировка на каждый исход отказа, исчерпывающе по типу: новый вид отказа
 * в @bookeat/api перестанет компилироваться здесь, а не молча возьмёт чужую
 * фразу.
 */
const FAILURE_TEXT: Record<PlatformContentFailureKind, string> = {
  refused: copy.errorRefused,
  forbidden: copy.errorForbidden,
  unauthorized: copy.errorUnauthorized,
  not_found: copy.errorNotFound,
  unknown: copy.errorUnknown,
};

/**
 * Что редактор прочитает после неудачной записи.
 *
 * Мы НЕ показываем строку сервера. Не из вредности: `response.HandleError`
 * подменяет текст доменной ошибки общим английским («validation failed»),
 * написанным для логов, и узкого `code` у проверок кнопки и запрета билетов
 * не заводили. Показать её — значит показать редактору строку, которая ничего
 * не объясняет. Настоящие причины панель называет ДО отправки формы, там где
 * может (см. `actionUrlText`), — а это финальная сетка на всё остальное.
 */
export function platformContentErrorText(error: unknown): string {
  return FAILURE_TEXT[classifyPlatformContentFailure(error).kind];
}

/** Текст на каждую причину, по которой сервер откажет во внешней ссылке. */
const ACTION_URL_TEXT: Record<ActionUrlProblem, string> = {
  empty: copy.actionUrlEmpty,
  too_long: copy.actionUrlTooLong,
  whitespace: copy.actionUrlWhitespace,
  malformed: copy.actionUrlMalformed,
  scheme: copy.actionUrlScheme,
  no_host: copy.actionUrlNoHost,
  credentials: copy.actionUrlCredentials,
};

export function actionUrlText(problem: ActionUrlProblem): string {
  return ACTION_URL_TEXT[problem];
}
