import { RepositoryError } from "@bookeat/api";
import type { Dictionary } from "@bookeat/i18n";

/** The `auth` section of the dictionary — the only part this module reads. */
export type AuthCopy = Dictionary["auth"];

/**
 * Turns a failed `POST /auth/otp/request` (or its phone-change twin) into a
 * sentence that is TRUE for that particular failure.
 *
 * Lives in its own module rather than inside the screen for one reason: this is
 * the part of the sign-in gate that is worth a unit test, and testing it inside
 * a React Native screen would mean rendering the screen to assert a string.
 *
 * The order of the branches is load-bearing:
 *   1. 429 — the server itself said how long to wait; that number beats any
 *      other reading of the failure.
 *   2. 422 — after the client has checked the number is complete, the only
 *      422 left is the per-phone budget (1/min, 5/hour).
 *   3. timeout — checked BEFORE offline, because a timeout also carries the
 *      `networkFailure` flag. We stopped listening; the server may well have
 *      delivered the code, so telling the guest to check their connection
 *      would send them looking in the wrong place.
 *   4. 5xx — the server answered and answered with its own failure. The
 *      guest's connection is fine and there is nothing for them to fix.
 *   5. offline — genuinely no network. The one case where "проверьте
 *      соединение" is honest, and also the fallback for anything unclassified
 *      (a malformed body, an unexpected 4xx): it asks for the only action that
 *      can help and claims nothing we do not know.
 */
export function describeOtpRequestError(
  error: unknown,
  copy: AuthCopy,
  fallbackRetrySeconds: number,
): string {
  return classifyOtpRequestFailure(error, copy, fallbackRetrySeconds).message;
}

/** What the screen should DO about a failed OTP request, not just what it says. */
export interface OtpRequestFailure {
  /** The sentence to show the guest. */
  message: string;
  /**
   * The code probably EXISTS on the server despite this failure, so the guest
   * should be taken to the code field and the message shown there as a warning
   * — not as a refusal on the phone step.
   *
   * True for exactly one case: our own deadline expired. The backend creates
   * the row in `otp_codes` and hands the code to the delivery waterfall within
   * about a second (verified in production logs), long before we stop
   * listening, and it keeps the code even if the request is dropped. Refusing
   * to show the field then means the guest holds a valid code with nowhere to
   * type it.
   *
   * False for everything else, and the difference is not cosmetic:
   *   - 422 / 429 — the server REFUSED to create a code. There is nothing to
   *     type; the code field would be a trap.
   *   - offline — the request never left the device.
   *   - 5xx — the server answered with a failure of its own; we have no reason
   *     to believe a code was created, and a wrong guess here strands the guest
   *     on a field that can never accept anything.
   */
  canStillEnterCode: boolean;
}

/**
 * The whole decision about a failed OTP request in one place: the sentence AND
 * whether the flow may continue to the code step. See the branch order in the
 * doc comment above — `isTimeout` must be tested before `isOffline`, because a
 * timeout carries both flags.
 */
export function classifyOtpRequestFailure(
  error: unknown,
  copy: AuthCopy,
  fallbackRetrySeconds: number,
): OtpRequestFailure {
  if (error instanceof RepositoryError) {
    if (error.isRateLimited) {
      return {
        message: copy.errorRateLimited(error.retryAfterSeconds ?? fallbackRetrySeconds),
        canStillEnterCode: false,
      };
    }
    if (error.isValidation) {
      return { message: copy.errorTooOften, canStillEnterCode: false };
    }
    if (error.isTimeout) {
      return { message: copy.errorTimedOut, canStillEnterCode: true };
    }
    if (error.isServerFailure) {
      return { message: copy.errorServerFailure, canStillEnterCode: false };
    }
  }
  return { message: copy.errorDescription, canStillEnterCode: false };
}
