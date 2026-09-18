import { RepositoryError } from "../repository";
import type { PushCampaignRefusalReason, PushCampaignStatus, PushCampaignSummary } from "./types";

/**
 * Every way `POST /admin/push-campaigns` (or the estimate that precedes it)
 * can fail, from the panel's point of view (spec §4 criteria 4, 9; §3.3, §3.8,
 * §3.9). The five `PushCampaignRefusalReason` values are the 422 branches the
 * spec names explicitly; `in_progress` is the 409 from a concurrent campaign
 * on the same subject; `channel_disabled` is the 503 the backend answers with
 * when `GUEST_PUSH_PROVIDER` is empty on the server (§0 predusloviye).
 *
 * ASSUMPTION: the spec does not say which field on the error envelope carries
 * the 422 reason. This follows the same convention already used elsewhere in
 * this client (`classifyPromoCodeFailure`, `classifyPlatformContentFailure`):
 * the reason travels as `response.Envelope.code`, surfaced here as
 * `RepositoryError.code`. Confirm against the merged backend PR at review
 * time — if the reason travels under a different key, only this function
 * needs to change.
 */
export type PushCampaignFailureKind =
  | PushCampaignRefusalReason
  | "in_progress"
  | "channel_disabled"
  | "not_found"
  | "forbidden"
  | "unauthorized"
  | "unknown";

export interface PushCampaignFailure {
  kind: PushCampaignFailureKind;
}

const KNOWN_REFUSAL_REASONS: ReadonlySet<string> = new Set<PushCampaignRefusalReason>([
  "subject_not_published",
  "subject_expired",
  "venue_inactive",
  "city_unresolved",
  "quiet_hours",
]);

/** Разбирает пойманную ошибку `estimatePushCampaign`/`createPushCampaign`.
 * Принимает `unknown`, потому что стоит на `catch`. */
export function classifyPushCampaignFailure(error: unknown): PushCampaignFailure {
  const status = error instanceof RepositoryError ? error.status : undefined;
  const code = error instanceof RepositoryError ? error.code : undefined;
  if (code && KNOWN_REFUSAL_REASONS.has(code)) {
    return { kind: code as PushCampaignRefusalReason };
  }
  switch (status) {
    case 401:
      return { kind: "unauthorized" };
    case 403:
      return { kind: "forbidden" };
    case 404:
      return { kind: "not_found" };
    case 409:
      return { kind: "in_progress" };
    case 503:
      return { kind: "channel_disabled" };
    default:
      return { kind: "unknown" };
  }
}

/** Statuses that mean a worker still might touch the row — the badge polls
 * while any campaign on screen is in one of these (spec §4 criterion 29). */
const IN_FLIGHT_STATUSES: ReadonlySet<PushCampaignStatus> = new Set(["queued", "sending"]);

export function isPushCampaignInFlight(status: PushCampaignStatus): boolean {
  return IN_FLIGHT_STATUSES.has(status);
}

/**
 * Pure decision behind the screen-level poll (spec §4 criterion 29): while any
 * campaign in the list is `queued`/`sending`, refetch every 5s; once none are,
 * stop (return `false`, the react-query convention for "no more polling").
 * Kept outside the hook so it is unit-testable without React or a fake timer.
 */
export function pushCampaignsPollIntervalMs(
  items: readonly Pick<PushCampaignSummary, "status">[] | undefined,
): number | false {
  if (!items?.some((item) => isPushCampaignInFlight(item.status))) return false;
  return 5000;
}
