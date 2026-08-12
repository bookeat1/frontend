import type { PlatformBookings } from "@bookeat/api/admin";

/**
 * The arithmetic behind the platform dashboard.
 *
 * It lives apart from the screen because every number here is a claim someone
 * will act on ("отмены выросли — иду к заведению"), and a claim must be
 * testable without a browser. The backend serves plain counts over a period, so
 * the comparison, the shares and the window arithmetic happen here — one place,
 * not scattered across the cards.
 */

/** A closed date window, `YYYY-MM-DD`, as the dashboard endpoints take it. */
export interface DateRange {
  from: string;
  to: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/**
 * The current window of `days` ending today (today included), and the window of
 * the SAME length immediately before it.
 *
 * Same length on purpose: comparing 30 days against a calendar month would
 * move the goalposts every month, and "−12%" would sometimes mean "February is
 * short". `today` is a parameter so the arithmetic is reproducible in a test
 * instead of depending on when the suite runs.
 */
export function comparisonRanges(days: number, today: Date): { current: DateRange; previous: DateRange } {
  const end = today;
  const start = shiftDays(end, -(days - 1));
  const prevEnd = shiftDays(start, -1);
  const prevStart = shiftDays(prevEnd, -(days - 1));
  return {
    current: { from: isoDate(start), to: isoDate(end) },
    previous: { from: isoDate(prevStart), to: isoDate(prevEnd) },
  };
}

/**
 * Change from `previous` to `current`, in percent, rounded to a whole number.
 *
 * `null` means "there is nothing to compare with": a previous period of zero
 * has no percentage change, and printing «+100%» (or ∞) for the first booking
 * ever would be a made-up number. The card then shows a dash — honest, and
 * visibly different from «0%», which means "same as before".
 */
export function deltaPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** «+12%» / «−8%» / «0%», or a dash when there is no basis for comparison.
 * Uses the real minus sign, not a hyphen: these sit next to numbers. */
export function formatDelta(delta: number | null): string {
  if (delta === null) return "—";
  if (delta === 0) return "0%";
  return delta > 0 ? `+${delta}%` : `−${Math.abs(delta)}%`;
}

/** Statuses that mean the table stayed empty. Both are the venue's loss, and
 * the dashboard counts them together because the venue does. */
const LOST_STATUSES = new Set(["cancelled", "no_show"]);

export function countByStatus(breakdown: PlatformBookings | undefined, status: string): number {
  if (!breakdown) return 0;
  return breakdown.by_status.find((row) => row.status === status)?.count ?? 0;
}

export function totalBookings(breakdown: PlatformBookings | undefined): number {
  if (!breakdown) return 0;
  // `total` is what the server counted; by_status is only summed when the
  // server did not send a total (an older build).
  if (typeof breakdown.total === "number" && breakdown.total > 0) return breakdown.total;
  return breakdown.by_status.reduce((sum, row) => sum + row.count, 0);
}

export function lostBookings(breakdown: PlatformBookings | undefined): number {
  if (!breakdown) return 0;
  return breakdown.by_status
    .filter((row) => LOST_STATUSES.has(row.status))
    .reduce((sum, row) => sum + row.count, 0);
}

/**
 * Share of bookings that ended in a cancellation or a no-show, in percent with
 * one decimal. `null` on an empty period: 0% would read as "nobody cancelled",
 * which is a different fact from "nobody booked".
 */
export function lostRatePercent(breakdown: PlatformBookings | undefined): number | null {
  const total = totalBookings(breakdown);
  if (total === 0) return null;
  return Math.round((lostBookings(breakdown) / total) * 1000) / 10;
}

export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${rate.toString().replace(".", ",")}%`;
}
