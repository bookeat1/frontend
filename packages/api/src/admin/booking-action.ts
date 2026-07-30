import { RepositoryError } from "../repository";

/**
 * What a refused venue answer to a booking request
 * (POST /admin/restaurants/:id/bookings/:bookingId/{confirm,reject}) actually
 * was, once the machine-readable `code` of the error envelope has been read.
 *
 * WHY THIS EXISTS: the human text on the wire is a fixed English string built
 * by response.classify from the sentinel alone — "invalid status transition",
 * "forbidden", "not found". None of it is showable to a hostess, and one of
 * them is not even an error from her point of view: `invalid_status` on a
 * pending request means somebody (a colleague, the SLA worker, the guest)
 * already answered it, so the row she is looking at is stale and the useful
 * action is to re-read the list, not to press the button again.
 *
 * The wording lives in the panel (@bookeat/i18n); this module only decides
 * WHICH outcome happened, because that decision is a contract with the backend
 * and must be testable without a DOM.
 */
export type BookingActionFailureKind =
  /** 422 `invalid_status` — the booking is no longer pending. Somebody else
   * answered it first, or the request expired. Nothing this staff member did
   * is wrong; the list has to be refreshed. */
  | "already_answered"
  /** 422 with any other code — the request itself was refused (a validation
   * rule of the venue). Retrying the identical call cannot change it. */
  | "refused"
  /** 403 — this account no longer manages this venue. */
  | "forbidden"
  /** 401 — the session is gone. */
  | "unauthorized"
  /** 404 — the booking is not there (deleted, or a stale row). */
  | "not_found"
  /**
   * Everything else: 5xx, a timeout, no network, an unlabelled status. This is
   * the case where we do NOT know whether the answer was recorded, kept apart
   * on purpose so no screen can claim "ничего не изменилось".
   */
  | "unknown";

export interface BookingActionFailure {
  kind: BookingActionFailureKind;
  /**
   * Whether the booking's status changed. `false` only when the SERVER said
   * so; `"unknown"` whenever it did not — a request that timed out may well
   * have committed.
   */
  applied: false | "unknown";
  /** True only when re-reading the list is what resolves the situation. */
  staleList: boolean;
}

/**
 * Classifies a failed confirm/reject. Accepts `unknown` because it sits on a
 * `catch`.
 *
 * The narrow code wins over the status: `invalid_status` is attached by
 * domain.ErrInvalidStatus in usecase/bookings/status.go and is the only thing
 * on the wire that separates "already answered" from a plain validation
 * refusal, both of which arrive as 422.
 */
export function classifyBookingActionFailure(error: unknown): BookingActionFailure {
  const code = error instanceof RepositoryError ? error.code : undefined;
  const status = error instanceof RepositoryError ? error.status : undefined;

  if (code === "invalid_status") {
    return { kind: "already_answered", applied: false, staleList: true };
  }

  switch (status) {
    case 401:
      return { kind: "unauthorized", applied: false, staleList: false };
    case 403:
      return { kind: "forbidden", applied: false, staleList: false };
    case 404:
      return { kind: "not_found", applied: false, staleList: true };
    case 422:
      // ErrValidation is only ever returned before or instead of a commit, so
      // "nothing changed" is a fact here, not a guess.
      return { kind: "refused", applied: false, staleList: false };
    default:
      return { kind: "unknown", applied: "unknown", staleList: true };
  }
}
