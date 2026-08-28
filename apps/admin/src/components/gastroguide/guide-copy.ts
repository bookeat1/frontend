import { classifyGuideFailure, type GuideFailureKind } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";

const copy = t.admin.gastroguide;

/**
 * The wording for every way a guide write can be refused, exhaustive by type: a
 * new kind added in @bookeat/api stops compiling here instead of silently
 * reusing another one's sentence.
 */
const FAILURE_TEXT: Record<GuideFailureKind, string> = {
  order_stale: copy.errorOrderMismatch,
  slug_taken: copy.errorSlugTaken,
  collection_empty: copy.errorCollectionEmpty,
  route_empty: copy.errorRouteEmpty,
  venue_already_attached: copy.errorVenueAttached,
  refused: copy.errorUnknown,
  forbidden: copy.errorForbidden,
  unauthorized: copy.errorForbidden,
  not_found: copy.errorNotFound,
  unknown: copy.errorUnknown,
};

export interface GuideErrorMessage {
  text: string;
  /** True when the screen is known (or not known NOT) to disagree with the
   * server, so the panel offers "Обновить страницу" rather than a plain retry. */
  needsReload: boolean;
}

/** Turns a caught error into what the editor should read and be offered. */
export function guideErrorMessage(error: unknown): GuideErrorMessage {
  const failure = classifyGuideFailure(error);
  return { text: FAILURE_TEXT[failure.kind], needsReload: failure.needsReload };
}
