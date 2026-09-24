import { RepositoryError } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";

const t = getDictionary();

/** Clear message for PUT /bookings/:id/preorder refusals; generic otherwise. */
export function preorderSaveErrorMessage(error: unknown): string {
  if (error instanceof RepositoryError) {
    if (error.isPreorderLocked) return t.booking.preorderEditLocked;
    if (error.isPreorderPaymentInFlight) return t.booking.preorderEditInFlight;
  }
  return t.booking.preorderSaveFailed;
}
