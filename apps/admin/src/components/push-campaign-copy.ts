import { classifyPushCampaignFailure, type PushCampaignFailureKind } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";

/**
 * Текст на каждый исход отказа `estimatePushCampaign`/`createPushCampaign`,
 * исчерпывающе по типу — новый вид отказа в `@bookeat/api` перестанет
 * компилироваться здесь, а не молча возьмёт чужую фразу (тот же приём, что
 * `translation-copy.ts`/`platform-content/copy.ts`).
 *
 * ASSUMPTION: см. doc-comment `classifyPushCampaignFailure` в
 * `packages/api/src/admin/push-campaigns.ts` — реальный код 422 ещё не
 * подтверждён на бэкенде.
 */
export function pushCampaignErrorText(error: unknown): string {
  const copy = t.admin.pushCampaigns.errors;
  const TEXT: Record<PushCampaignFailureKind, string> = {
    subject_not_published: copy.subject_not_published,
    subject_expired: copy.subject_expired,
    venue_inactive: copy.venue_inactive,
    city_unresolved: copy.city_unresolved,
    quiet_hours: copy.quiet_hours,
    in_progress: copy.in_progress,
    channel_disabled: copy.channel_disabled,
    not_found: copy.not_found,
    forbidden: copy.forbidden,
    unauthorized: copy.unauthorized,
    unknown: copy.unknown,
  };
  return TEXT[classifyPushCampaignFailure(error).kind];
}
