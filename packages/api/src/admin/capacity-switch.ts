import { RepositoryError } from "../repository";

/**
 * What a refused capacity-mode switch (PATCH /restaurants/:id/booking-policy)
 * actually was, once the machine-readable `code` of the error envelope has
 * been read.
 *
 * WHY THIS EXISTS: the endpoint answers 409 for a lost race and 422 for
 * "your own data does not allow it", and the human text the server sends is a
 * fixed, generic English string produced by response.classify — "already
 * exists" for every 409, "validation failed" for every 422. Neither is
 * showable to a staff member, and the first is worse than useless: the switch
 * it describes changed NOTHING and the useful action is simply to press the
 * button again.
 *
 * The wording lives in the panel (@bookeat/i18n); this module only decides
 * WHICH of the mutually exclusive outcomes happened, because that decision is
 * a contract with the backend and must be testable without a DOM.
 */
export type CapacitySwitchFailureKind =
  /** `capacity_switch_conflict` — another transaction was changing a booking's
   * status while the switch tried to commit, so the deferred trigger of
   * migration 0059 refused and the switch rolled back WHOLE. Nothing changed
   * and a retry a moment later almost always succeeds. */
  | "conflict_retryable"
  /** `capacity_switch_too_many_bookings` — the venue has more live bookings in
   * the affected window than one switch may reconcile (300). Refused before
   * touching anything, and a retry does NOT help: the window has to get
   * smaller, or support has to do it. */
  | "too_many_bookings"
  /** A plain 422: the venue's own data refuses the change (no active tables,
   * a capacity smaller than what is already sold, a booking that does not fit,
   * a missing seat count). Nothing changed; retrying the identical request
   * cannot change the answer. The server does NOT say which of these it was —
   * see the note below. */
  | "refused"
  /** 403 — this account is not staff of this venue (any more). */
  | "forbidden"
  /** 401 — the session is gone. */
  | "unauthorized"
  /** 404 — the venue is not there. */
  | "not_found"
  /**
   * Everything else: an unlabelled 409 from an older server build, a 5xx, a
   * 503, a timeout, no network. These are NOT a family — they are the single
   * case where we do not know whether the switch happened, and they are kept
   * together precisely so no screen can accidentally treat one of them as
   * "nothing changed".
   */
  | "unknown";

export interface CapacitySwitchFailure {
  kind: CapacitySwitchFailureKind;
  /**
   * Whether the venue's mode was changed.
   *
   * `false` only when the SERVER told us so. `"unknown"` whenever it did not —
   * a request that timed out may well have committed. A screen must never
   * print "ничего не изменилось" on `"unknown"`; it has to send the staff
   * member to re-read the current state.
   */
  applied: false | "unknown";
  /**
   * True only for the one refusal that a plain retry of the SAME request
   * resolves. Everything else is either permanent (the venue must change
   * something first) or of unknown outcome, and re-sending it is not the
   * action to offer.
   */
  retryable: boolean;
}

/**
 * Classifies a failed capacity-mode switch. Accepts `unknown` because it sits
 * on a `catch`.
 *
 * The rules, in the order that matters:
 *
 *  1. The narrow codes win, whatever the status they arrive with. They are
 *     attached by domain.WithCode in usecase/bookings/venue_policy.go and are
 *     the only thing on the wire that identifies these two outcomes.
 *  2. A 422 with the generic `validation_failed` (or no code) is a refusal:
 *     ErrValidation is only ever returned before or instead of a commit, so
 *     "nothing changed" is a fact here, not a guess.
 *  3. A 409 with the GENERIC `already_exists` code — or with no code at all,
 *     which is what a server build older than 2026-07-25 sends — is `unknown`.
 *     It very probably is the same lost race, but "very probably" is not what
 *     a staff member should be told about their venue's occupancy.
 *  4. Anything with no status (offline, timeout, malformed body) or a 5xx is
 *     `unknown` too: the request may have reached the database.
 */
export function classifyCapacitySwitchFailure(error: unknown): CapacitySwitchFailure {
  const code = error instanceof RepositoryError ? error.code : undefined;
  const status = error instanceof RepositoryError ? error.status : undefined;

  if (code === "capacity_switch_conflict") {
    return { kind: "conflict_retryable", applied: false, retryable: true };
  }
  if (code === "capacity_switch_too_many_bookings") {
    return { kind: "too_many_bookings", applied: false, retryable: false };
  }

  switch (status) {
    case 401:
      return { kind: "unauthorized", applied: false, retryable: false };
    case 403:
      return { kind: "forbidden", applied: false, retryable: false };
    case 404:
      return { kind: "not_found", applied: false, retryable: false };
    case 422:
      // Both 422 codes this endpoint can produce (`validation_failed`,
      // `invalid_status`) mean the write never happened.
      return { kind: "refused", applied: false, retryable: false };
    default:
      return { kind: "unknown", applied: "unknown", retryable: false };
  }
}
