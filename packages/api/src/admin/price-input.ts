/**
 * Client-side parsing/validation of the «Средний чек» range inputs, kept out of
 * the component so the both-or-neither rule can be tested without a DOM.
 *
 * It mirrors the backend's own rule (usecase/restaurants: validatePriceRange /
 * migration 0068's CHECK): the range is either fully absent or fully present
 * with 0 <= min <= max. The difference is intent — the server validates the
 * MERGED row, this validates what the staff member typed, so a half-filled pair
 * is caught here as a clear message instead of a generic 422.
 *
 * The whole-tenge fields accept only non-negative integers: this product has no
 * tiyn in the average check, and a decimal here would be a fraction of a tenge.
 */
export type PriceRangeParseError = "incomplete" | "invalid" | "inverted";

export type PriceRangeInput =
  | { ok: true; min: number | null; max: number | null }
  | { ok: false; error: PriceRangeParseError };

/**
 * @param minRaw raw text of the "от" field
 * @param maxRaw raw text of the "до" field
 * @returns `{ok:true, min, max}` with both numbers or both `null` (no range),
 *   or `{ok:false, error}` where:
 *   - `incomplete` — exactly one field is filled (fill both or clear both);
 *   - `invalid` — a field is not a whole non-negative number;
 *   - `inverted` — max is below min.
 */
export function parsePriceRangeInput(minRaw: string, maxRaw: string): PriceRangeInput {
  const minStr = minRaw.trim();
  const maxStr = maxRaw.trim();

  if (minStr === "" && maxStr === "") return { ok: true, min: null, max: null };
  if (minStr === "" || maxStr === "") return { ok: false, error: "incomplete" };

  const min = Number(minStr);
  const max = Number(maxStr);
  if (
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min < 0 ||
    max < 0
  ) {
    return { ok: false, error: "invalid" };
  }
  if (max < min) return { ok: false, error: "inverted" };

  return { ok: true, min, max };
}
