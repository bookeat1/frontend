import type {
  ActionUrlProblem,
  FoodieOptionFailureKind,
  PlatformContentFailureKind,
  PromoCodeFailureKind,
} from "@bookeat/api/admin";
import {
  classifyFoodieOptionFailure,
  classifyPlatformContentFailure,
  classifyPromoCodeFailure,
} from "@bookeat/api/admin";

import { t } from "@/lib/i18n";

export const copy = t.admin.platformContent;
export const promoCodesCopy = t.admin.promoCodes;
export const foodieOptionsCopy = t.admin.foodieOptions;

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

/** Формулировка на каждый исход отказа записи промокода — те же два узких
 * кода (activated/bad_transition), поверх общего набора акций платформы. */
const PROMO_CODE_FAILURE_TEXT: Record<PromoCodeFailureKind, string> = {
  activated: promoCodesCopy.errorActivated,
  bad_transition: promoCodesCopy.errorBadTransition,
  duplicate: promoCodesCopy.errorDuplicate,
  refused: promoCodesCopy.errorRefused,
  forbidden: promoCodesCopy.errorForbidden,
  unauthorized: promoCodesCopy.errorUnauthorized,
  not_found: promoCodesCopy.errorNotFound,
  unknown: promoCodesCopy.errorUnknown,
};

export function promoCodeErrorText(error: unknown): string {
  return PROMO_CODE_FAILURE_TEXT[classifyPromoCodeFailure(error).kind];
}

/** Формулировка на каждый исход отказа записи варианта фуди-профиля. Узкого
 * кода на запрет скрыть `no_diet`/последний активный или на «код неизменяем»
 * сервер не заводит (все — общий 422 `validation`), поэтому эти причины
 * панель объясняет ДО отправки (см. `canHideFoodieOption`), а здесь — только
 * то, что сервер различает по-настоящему. */
const FOODIE_OPTION_FAILURE_TEXT: Record<FoodieOptionFailureKind, string> = {
  refused: foodieOptionsCopy.errorRefused,
  duplicate: foodieOptionsCopy.errorDuplicate,
  forbidden: foodieOptionsCopy.errorForbidden,
  unauthorized: foodieOptionsCopy.errorUnauthorized,
  not_found: foodieOptionsCopy.errorNotFound,
  unknown: foodieOptionsCopy.errorUnknown,
};

export function foodieOptionErrorText(error: unknown): string {
  return FOODIE_OPTION_FAILURE_TEXT[classifyFoodieOptionFailure(error).kind];
}
