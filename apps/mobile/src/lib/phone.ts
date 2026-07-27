/**
 * The one place a phone number is formatted and normalized.
 *
 * The app collects exactly one shape — a Kazakh/Russian mobile number written
 * as `+7 (777) 123-45-67` — because that is what the market is and because a
 * free-form field is the fastest way to send the backend something it will
 * normalize into a number nobody owns.
 *
 * The `+7` is fixed by the UI, not typed: the guest enters the ten digits
 * after it. `toE164` is what actually leaves the device, and it matches the
 * server's own normalizer (internal/auth/phone/phone.go: ten digits ⇒ "+7" +
 * digits), so the number we show and the number the code is sent to are the
 * same string.
 */

/** Digits after the country code. */
export const PHONE_NATIONAL_LENGTH = 10;

/** Keeps only the digits a guest can actually own — the ten after +7. A pasted
 * "+7 707…", "8 707…" or "7707…" is reduced to the same ten. */
export function extractNationalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  // A pasted full number arrives with its own country prefix; drop it so the
  // field never shows "+7 (770) 712-34-56" for "+7 707 123 45 67".
  if (digits.length > PHONE_NATIONAL_LENGTH) {
    if (digits.startsWith("7") || digits.startsWith("8")) {
      digits = digits.slice(1);
    }
  }
  return digits.slice(0, PHONE_NATIONAL_LENGTH);
}

/**
 * Formats up to ten national digits as `(777) 123-45-67`, growing as the guest
 * types. The visible `+7 ` prefix lives in the field's own decoration so the
 * caret can never be put before it or delete it.
 */
export function formatNationalDigits(digits: string): string {
  const d = digits.slice(0, PHONE_NATIONAL_LENGTH);
  if (d.length === 0) return "";
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)];
  let out = d.length > 3 ? `(${parts[0]}) ` : `(${parts[0]}`;
  if (parts[1]) out += parts[1];
  if (parts[2]) out += `-${parts[2]}`;
  if (parts[3]) out += `-${parts[3]}`;
  return out;
}

/** True when the guest has entered a complete number. */
export function isCompleteNationalNumber(digits: string): boolean {
  return digits.length === PHONE_NATIONAL_LENGTH;
}

/** What goes to the API: E.164, exactly as internal/auth/phone.Normalize would
 * produce for the same input. */
export function toE164(digits: string): string {
  return `+7${digits.slice(0, PHONE_NATIONAL_LENGTH)}`;
}

/** `+7 (777) 123-45-67` — for showing the number back to the guest on the code
 * step ("код отправлен на …"). */
export function formatE164ForDisplay(digits: string): string {
  return `+7 ${formatNationalDigits(digits)}`;
}

/**
 * A number as the SERVER stores it ("+77010000000") shown the way the guest
 * typed it in at sign-in: `+7 (701) 000-00-00`.
 *
 * Same mask as the sign-in field, deliberately: the profile shows the number
 * the account is keyed on, and it must be recognisably the same string the
 * guest entered — not the E.164 blob the API happens to speak.
 *
 * Anything that is NOT a +7 number is returned untouched. `extractNationalDigits`
 * on its own would happily chop "+1 212 555 1234" down to ten digits and this
 * would then print "+7 (121) 255-51-23" — a number nobody owns, presented as
 * fact. A foreign or malformed number is shown exactly as stored instead.
 */
export function formatStoredPhoneForDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const national =
    digits.length === PHONE_NATIONAL_LENGTH
      ? digits
      : digits.length === PHONE_NATIONAL_LENGTH + 1 && (digits.startsWith("7") || digits.startsWith("8"))
        ? digits.slice(1)
        : null;
  if (national === null) return raw;
  return formatE164ForDisplay(national);
}
