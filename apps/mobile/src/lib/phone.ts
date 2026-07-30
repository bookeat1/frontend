/**
 * The one place a phone number is parsed, formatted and normalized.
 *
 * A number in this app is always the pair (country, national digits) — never a
 * free string that someone later has to guess the meaning of. The country
 * comes from the selector on the left of the field; the national digits are
 * what the guest types on the right. `toE164` is what leaves the device, and
 * it is exactly what the server's own normalizer would produce for the same
 * input (internal/auth/phone/phone.go: a value already starting with "+" is
 * kept digit-for-digit), so the number we show and the number the server
 * stores are the same string.
 *
 * THE HARD PART IS PASTE, and it is handled in exactly one function:
 * `parsePhoneInput`. Everything a guest can paste — "+7 701 234 56 78",
 * "87012345678", "7 (701) 234-56-78", "+1 212 555 1234" — goes through it and
 * comes back as a country plus the national digits. It is also what runs on
 * every keystroke, which is deliberate: there is no "was this a paste?"
 * heuristic to get wrong, because the same rules give the right answer for one
 * character and for a whole number.
 *
 * The rule the parser will not break: it never moves the country selector
 * while the guest is typing a number that still fits the country they are on.
 * A field that changes country under a fast typist's fingers is worse than no
 * field at all.
 */

import {
  DEFAULT_COUNTRY,
  matchDialCode,
  maxNationalDigits,
  nationalLength,
  type Country,
} from "./countries";

export interface PhoneValue {
  country: Country;
  /** Digits only, no country code, no separators. */
  national: string;
}

/**
 * The shortest thing we are willing to call a phone number, counting the
 * country code. Kept low on purpose: several real national plans are this
 * short (Tonga, the Solomon Islands), and refusing a number the venue could
 * actually dial is a worse failure than accepting a typo — the venue phones
 * the guest, it does not parse the string.
 */
const MIN_TOTAL_DIGITS = 7;

export function emptyPhone(country: Country = DEFAULT_COUNTRY): PhoneValue {
  return { country, national: "" };
}

function clamp(value: PhoneValue): PhoneValue {
  return { ...value, national: value.national.slice(0, maxNationalDigits(value.country)) };
}

/**
 * Turns whatever is now in the input — typed, pasted, or half-deleted — into a
 * country and its national digits.
 *
 * `current` is the country the selector is on, and it is the tie-breaker: a
 * bare string of digits is read as a local number first, and only re-attributed
 * to another country when it cannot be a local one.
 */
export function parsePhoneInput(raw: string, current: Country): PhoneValue {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits === "") return { country: current, national: "" };

  // 1. A leading "+" is the guest stating that the country code is in there.
  //    Believe them: this is the one unambiguous signal in the whole problem.
  if (trimmed.startsWith("+")) {
    const country = matchDialCode(digits);
    if (country) return clamp({ country, national: digits.slice(country.dial.length) });
    // A "+" in front of a code we do not carry. Keep the digits — refusing
    // them would be the table's ignorance charged to the guest.
    return clamp({ country: current, national: digits });
  }

  const cap = maxNationalDigits(current);
  const known = nationalLength(current);

  // 2. The domestic trunk digit ("8 701…" is how a KZ number is said out
  //    loud). Stripped the moment it appears rather than at the eleventh
  //    digit, so the mask never shows "(870) 123-45-6" and then rearranges
  //    itself. Lossless: no national number in these countries starts with it.
  let d = digits;
  if (
    current.trunk &&
    d.startsWith(current.trunk) &&
    (known === undefined || d.length <= known + 1)
  ) {
    d = d.slice(current.trunk.length);
  }

  // 3. It still fits the country we are on, so it IS a local number. This
  //    branch is what keeps the selector still while someone types.
  if (d.length <= cap) return { country: current, national: d };

  // 4. Too long to be local. Something with a country code in front was
  //    pasted without a plus. Try our own code first — "7 (701) 234-56-78" is
  //    a Kazakh number, not a foreign one.
  if (d.startsWith(current.dial)) {
    const rest = d.slice(current.dial.length);
    if (rest.length <= cap) return { country: current, national: rest };
  }

  // 5. Then whoever else's code it starts with.
  const other = matchDialCode(d);
  if (other) return clamp({ country: other, national: d.slice(other.dial.length) });

  // 6. Unplaceable. Keep as many digits as the field can hold instead of
  //    dropping the number on the floor.
  return clamp({ country: current, national: d });
}

/**
 * Reads a stored/server number ("+77010000000"). Null when there is nothing
 * resembling a number in it.
 *
 * It does NOT force a leading "+" onto a value that lacks one. Doing so looks
 * harmless and is not: "87012345678" is the domestic way to write a Kazakh
 * number, and forcing the plus makes "+8 701…" — a dial code nobody has, which
 * then falls through to the default country and prints as "+7 (870) 123-45-6…",
 * an invented number shown as the guest's own. Without the plus the same string
 * takes the domestic path and comes back as the number it actually is.
 */
export function phoneFromE164(stored: string | null | undefined): PhoneValue | null {
  if (!stored) return null;
  const trimmed = stored.trim();
  if (!trimmed.replace(/\D/g, "")) return null;
  return parsePhoneInput(trimmed, DEFAULT_COUNTRY);
}

/**
 * `(701) 234-56-78` for a country whose format we know, growing as the guest
 * types; the digits untouched for a country whose format we do not. The
 * country code itself is NOT here — it is drawn in the selector, where the
 * caret can never reach it.
 */
export function formatNational(national: string, country: Country): string {
  const groups = country.groups;
  if (!groups || national === "") return national;

  let rest = national;
  const parts: string[] = [];
  for (const size of groups) {
    if (!rest) break;
    parts.push(rest.slice(0, size));
    rest = rest.slice(size);
  }
  // Anything past the known format (only reachable if the table is wrong) is
  // appended rather than silently dropped.
  if (rest) parts.push(rest);

  const firstComplete = parts[0].length === groups[0];
  let out = firstComplete ? `(${parts[0]})` : `(${parts[0]}`;
  if (parts.length > 1) out += ` ${parts[1]}`;
  for (let i = 2; i < parts.length; i += 1) out += `-${parts[i]}`;
  return out;
}

/** What goes on the wire: E.164. Empty string when there is no number yet —
 * "+7" on its own is not a number and must not read as one. */
export function toE164(value: PhoneValue): string {
  if (!value.national) return "";
  return `+${value.country.dial}${value.national}`;
}

/**
 * Whether this is a number we are prepared to submit.
 *
 * For a country whose format we know it is an exact digit count. For every
 * other country it is a floor, not a pattern — see MIN_TOTAL_DIGITS. We do not
 * own a validator for the whole world and will not pretend to.
 */
export function isPhoneComplete(value: PhoneValue): boolean {
  const known = nationalLength(value.country);
  if (known !== undefined) return value.national.length === known;
  return value.country.dial.length + value.national.length >= MIN_TOTAL_DIGITS;
}

/** The whole number the way a person reads it: `+7 (701) 234-56-78`. */
export function formatPhoneForDisplay(value: PhoneValue): string {
  if (!value.national) return `+${value.country.dial}`;
  return `+${value.country.dial} ${formatNational(value.national, value.country)}`;
}

/**
 * A number as the SERVER stores it ("+77010000000") shown the way a person
 * reads it: `+7 (701) 000-00-00`.
 *
 * THE TRAP THIS GUARDS: the number must never be re-attributed to another
 * country to make it fit a mask. "+1 212 555 1234" is a US number and is shown
 * as one; it may not become "+7 (121) 255-51-23", a number nobody owns,
 * presented to the guest as their own. When the country's format is not one we
 * claim to know, or the digit count does not match it, the stored string is
 * returned untouched — an unformatted true number beats a formatted false one.
 */
export function formatStoredPhoneForDisplay(raw: string): string {
  const value = phoneFromE164(raw);
  if (!value) return raw;
  const known = nationalLength(value.country);
  if (known === undefined || value.national.length !== known) return raw;

  // The safety net, and the reason this function is not just a formatter call:
  // the parser is allowed to drop digits it cannot place (it has a field to
  // keep usable), and a display has no such licence. Every digit of the input
  // must be accounted for by one of the three ways a number is written —
  // international, domestic-with-trunk, or bare national — or we show the
  // stored string and format nothing.
  const digits = raw.replace(/\D/g, "");
  const explained =
    digits === value.country.dial + value.national ||
    digits === value.national ||
    (value.country.trunk !== undefined && digits === value.country.trunk + value.national);
  if (!explained) return raw;

  return formatPhoneForDisplay(value);
}
