/** Formatting helpers. All dates come from the API as RFC3339 / ISO strings. */

const timeFmt = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

const dateTimeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : timeFmt.format(d);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d);
}

/** Today's date as "YYYY-MM-DD" in the local timezone (for the bookings filter
 * default and the <input type="date"> value). */
export function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Price arrives as a decimal string ("4500.00"); show it with a ₸ suffix and
 * no trailing ".00". */
export function formatPrice(price: string): string {
  const n = Number(price);
  if (Number.isNaN(n)) return price;
  return `${n.toLocaleString("ru-RU")} ₸`;
}

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

/** Full date only, e.g. "5 сентября 2026 г." */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

/** Money helpers. Deposits/ticket prices are stored as integer minor units
 * (tiyin, 1 ₸ = 100 tiyin). Staff enter and read whole ₸, never a float. */

/** Minor units -> whole ₸ (integer, rounded). */
export function minorToTenge(minor: number | null | undefined): number {
  if (minor == null) return 0;
  return Math.round(minor / 100);
}

/** Whole ₸ -> integer minor units. */
export function tengeToMinor(tenge: number): number {
  return Math.round(tenge) * 100;
}

/** Whole ₸ amount from minor units, formatted with a ₸ suffix. */
export function formatMinorTenge(minor: number | null | undefined): string {
  return `${minorToTenge(minor).toLocaleString("ru-RU")} ₸`;
}

/**
 * Convert an RFC3339/ISO instant to the value an <input type="datetime-local">
 * expects ("YYYY-MM-DDTHH:mm") in the browser's local timezone. Returns "" for
 * an invalid input so the field stays empty rather than showing "Invalid Date".
 */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Normalize a stored time-of-day ("09:00", "09:00:00") to the "HH:MM" the
 * backend regex and <input type="time"> both expect. Returns "" for nullish. */
export function toHHMM(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{2}):(\d{2})/.exec(value);
  return m ? `${m[1]}:${m[2]}` : "";
}

/**
 * Convert a datetime-local field value (local wall-clock, no zone) to an
 * RFC3339 UTC instant the backend parses with time.RFC3339. Returns "" when the
 * value is empty/unparseable so the caller can validate before sending.
 */
export function localInputToIso(local: string): string {
  if (!local.trim()) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
