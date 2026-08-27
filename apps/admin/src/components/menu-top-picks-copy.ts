import { classifyMenuTopPickFailure, type MenuTopPickFailureKind } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";

const copy = t.admin.menu.topPicks;

/**
 * Слова для каждого отказа полки «Лучшие позиции», исчерпывающе по типу: новый
 * вид отказа, добавленный в @bookeat/api, перестанет здесь компилироваться, а
 * не тихо переиспользует чужое предложение.
 */
const FAILURE_TEXT: Record<MenuTopPickFailureKind, string> = {
  limit_reached: copy.errors.limit,
  refused: copy.errors.refused,
  forbidden: copy.errors.forbidden,
  unauthorized: copy.errors.unauthorized,
  not_found: copy.errors.notFound,
  unknown: copy.errors.unknown,
};

export interface MenuTopPickErrorMessage {
  text: string;
  /** Правда, когда полка на экране заведомо (или не заведомо НЕ) расходится с
   * сервером: тогда честно перечитать список, а не повторять запись. */
  needsReload: boolean;
}

/** Превращает пойманную ошибку в то, что управляющий должен прочитать. */
export function menuTopPickErrorMessage(error: unknown): MenuTopPickErrorMessage {
  const failure = classifyMenuTopPickFailure(error);
  return { text: FAILURE_TEXT[failure.kind], needsReload: failure.needsReload };
}
