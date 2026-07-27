import { RepositoryError } from "../repository";

/**
 * What a refused gastroguide editor write actually was, once the
 * machine-readable `code` of the error envelope has been read.
 *
 * WHY THIS EXISTS: the guide's editor endpoints answer 409 and 422 for several
 * different reasons, and the human text on the wire is the same generic English
 * string for all of them ("already exists", "validation failed") — response.
 * classify builds it from the sentinel alone. Shown as-is, an editor cannot tell
 * "этот слаг занят" from "в подборке нет активных заведений", and those need
 * opposite actions.
 *
 * The one that matters most is the reorder. Drag-and-drop produces a write the
 * editor did not consciously "submit", so what the panel does after a failure
 * has to be right without being read:
 *
 *   order_stale  → the server refused and wrote NOTHING. The screen is out of
 *                  date; reload, do not re-send.
 *   unknown      → we do NOT know whether the new order landed. Re-sending the
 *                  same order is safe (it carries the whole final sequence, so
 *                  it is idempotent), but the screen must be reloaded first,
 *                  because a membership change may be what made it fail.
 *
 * The wording lives in the panel (@bookeat/i18n); this module only decides WHICH
 * outcome happened, because that decision is a contract with the backend and
 * must be testable without a DOM.
 */
export type GuideFailureKind =
  /** `guide_order_mismatch` — the order sent did not name exactly the
   * collection's current venues. Nothing was written. Somebody attached or
   * detached a venue while this screen was open. */
  | "order_stale"
  /** `guide_slug_taken` — another collection or rubric already uses this slug.
   * Nothing was written; the editor picks a different one. */
  | "slug_taken"
  /** `guide_collection_empty` — publication was refused because the collection
   * holds no venue a guest could open. Nothing was written; attach an active
   * venue first. */
  | "collection_empty"
  /** `guide_venue_already_attached` — this venue is already in THIS collection.
   * Harmless: the intended state already holds. */
  | "venue_already_attached"
  /** A plain 422 with no narrow code: the input was refused (bad slug, empty
   * title). Nothing was written. */
  | "refused"
  /** 403 — not a superadmin. The guide is platform editorial content. */
  | "forbidden"
  /** 401 — the session is gone. */
  | "unauthorized"
  /** 404 — the collection, rubric or venue is not there. */
  | "not_found"
  /**
   * Everything else: a 5xx, a timeout, no network, an unlabelled 409 from an
   * older server build. These are NOT a family — they are the single case where
   * we do not know whether the write happened, and they are kept together so no
   * screen can accidentally tell an editor "ничего не изменилось".
   */
  | "unknown";

export interface GuideFailure {
  kind: GuideFailureKind;
  /**
   * Whether the write landed.
   *
   * `false` only when the SERVER told us so. `"unknown"` whenever it did not —
   * a request that timed out may well have committed. A screen must never print
   * "порядок не сохранён" on `"unknown"`.
   */
  applied: false | "unknown";
  /**
   * True when the editor's screen is known to disagree with the server, so the
   * only honest next step is to re-read it. Deliberately also true for
   * `unknown`: after an outcome we cannot name, re-sending on top of a possibly
   * applied write is how a curation gets scrambled.
   */
  needsReload: boolean;
}

/**
 * Classifies a failed gastroguide editor write. Accepts `unknown` because it
 * sits on a `catch`.
 *
 * The narrow codes win over the status, whatever it arrives with: they are
 * attached by domain.WithCode on the server and are the only thing on the wire
 * that identifies these outcomes. A bare 422 is a refusal (ErrValidation is only
 * ever returned before a commit, so "nothing changed" is a fact here, not a
 * guess); anything with no status, or a 5xx, is `unknown`.
 */
export function classifyGuideFailure(error: unknown): GuideFailure {
  const code = error instanceof RepositoryError ? error.code : undefined;
  const status = error instanceof RepositoryError ? error.status : undefined;

  switch (code) {
    case "guide_order_mismatch":
      return { kind: "order_stale", applied: false, needsReload: true };
    case "guide_slug_taken":
      return { kind: "slug_taken", applied: false, needsReload: false };
    case "guide_collection_empty":
      return { kind: "collection_empty", applied: false, needsReload: false };
    case "guide_venue_already_attached":
      return { kind: "venue_already_attached", applied: false, needsReload: true };
    default:
      break;
  }

  switch (status) {
    case 401:
      return { kind: "unauthorized", applied: false, needsReload: false };
    case 403:
      return { kind: "forbidden", applied: false, needsReload: false };
    case 404:
      return { kind: "not_found", applied: false, needsReload: true };
    case 422:
      return { kind: "refused", applied: false, needsReload: false };
    default:
      return { kind: "unknown", applied: "unknown", needsReload: true };
  }
}
