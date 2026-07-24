import type { BookingStatus } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";

/** Color per booking lifecycle state. Tailwind-safe literal classes (no
 * dynamic interpolation, so JIT keeps them). */
const styles: Record<BookingStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  waitlist: "bg-sky-100 text-sky-800",
  arrived: "bg-indigo-100 text-indigo-800",
  completed: "bg-slate-200 text-slate-700",
  cancelled: "bg-slate-100 text-slate-500",
  no_show: "bg-rose-100 text-rose-700",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const label = t.admin.statuses[status] ?? status;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-pill px-md py-xxs text-[12px] font-medium ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}
