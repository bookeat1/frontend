"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatMinorTenge } from "@/lib/format";
import {
  comparisonRanges,
  countByStatus,
  deltaPercent,
  formatDelta,
  formatRate,
  lostRatePercent,
  totalBookings,
} from "@/lib/platform-metrics";
import {
  useFeedQueueCount,
  useIsPlatformAdmin,
  usePlatformBookings,
  usePlatformOverview,
  usePlatformPayments,
  usePlatformTopRestaurants,
} from "@/lib/use-platform-dashboard";

import { EmptyState, ErrorState, LoadingState } from "./StateViews";

/** Russian labels for the booking statuses the backend groups by. An unknown
 * status falls through to its raw value rather than disappearing: a new status
 * on the backend must show up as an unfamiliar word, not as a missing row. */
const STATUS_LABEL: Record<string, string> = {
  pending: "Ожидают",
  confirmed: "Подтверждены",
  arrived: "Гость пришёл",
  completed: "Завершены",
  cancelled: "Отменены",
  no_show: "Не пришли",
  waitlist: "В листе ожидания",
};

const PERIODS = [
  { key: "7", label: "7 дней", days: 7, previousLabel: "к прошлой неделе" },
  { key: "30", label: "30 дней", days: 30, previousLabel: "к прошлым 30 дням" },
  { key: "90", label: "90 дней", days: 90, previousLabel: "к прошлым 90 дням" },
] as const;

/**
 * The platform screen a superadmin lands on.
 *
 * Ordered by what a person came here to do, not by what is easiest to query:
 * first what is WAITING for a decision, then how the period is going compared
 * with the one before it, then which venues are behind those numbers. The
 * totals ("сколько всего заведений") sit at the bottom — they are context, and
 * they never change between two visits.
 *
 * Every period number is fetched twice, for this window and the one before it,
 * so a count can be read as better or worse instead of just big or small. The
 * backend has no period-over-period endpoint; two dated reads are the whole
 * mechanism.
 */
export function PlatformDashboard() {
  const isAdmin = useIsPlatformAdmin();
  const [periodKey, setPeriodKey] = useState<(typeof PERIODS)[number]["key"]>("30");
  const [topBy, setTopBy] = useState<"bookings" | "gmv">("bookings");

  const period = PERIODS.find((p) => p.key === periodKey) ?? PERIODS[1];
  // Recomputed only when the period changes, not on every render: `new Date()`
  // in a render body would make the query keys unstable and refetch forever.
  const ranges = useMemo(() => comparisonRanges(period.days, new Date()), [period.days]);

  const overview = usePlatformOverview();
  const queue = useFeedQueueCount();
  const bookings = usePlatformBookings(ranges.current);
  const bookingsBefore = usePlatformBookings(ranges.previous);
  const payments = usePlatformPayments(ranges.current);
  const paymentsBefore = usePlatformPayments(ranges.previous);
  const top = usePlatformTopRestaurants(ranges.current, topBy);

  // The role check is a UX guard, not a security one: the backend gates every
  // one of these endpoints on the admin role regardless. It exists so a venue
  // manager who lands here sees an explanation instead of failed requests.
  if (!isAdmin) {
    return (
      <EmptyState
        title="Раздел только для администраторов платформы"
        description="Здесь показатели всей платформы. Данные вашего заведения — в разделе «Брони»."
      />
    );
  }

  const bookingsNow = totalBookings(bookings.data);
  const bookingsThen = totalBookings(bookingsBefore.data);
  const pending = countByStatus(bookings.data, "pending");
  const capturedNow = payments.data?.captured.amount_minor ?? 0;
  const capturedThen = paymentsBefore.data?.captured.amount_minor ?? 0;
  const lostNow = lostRatePercent(bookings.data);
  const lostThen = lostRatePercent(bookingsBefore.data);
  const queueCount = queue.data ?? 0;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Платформа</h1>
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriodKey(p.key)}
              className={`rounded-md px-3 py-1 text-sm ${
                periodKey === p.key ? "bg-white font-medium shadow-sm" : "text-neutral-600"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* WHAT NEEDS A DECISION. Only rendered when something actually does:
          an always-present "0 в очереди" block trains people to skip the top
          of the screen, which is exactly where the urgent thing appears. */}
      {queueCount > 0 || pending > 0 ? (
        <Section title="Требует внимания">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {queueCount > 0 ? (
              <ActionCard
                title="Заявки на главную ждут решения"
                value={String(queueCount)}
                href="/feed-moderation"
                action="Разобрать"
              />
            ) : null}
            {pending > 0 ? (
              <ActionCard
                title="Брони ждут подтверждения заведением"
                value={String(pending)}
                hint="за выбранный период, по всей сети"
              />
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section title={`Пульс · ${period.label}`}>
        {bookings.isLoading || payments.isLoading ? (
          <LoadingState />
        ) : bookings.isError ? (
          <ErrorState onRetry={() => bookings.refetch()} />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card
              title="Брони"
              value={String(bookingsNow)}
              delta={deltaPercent(bookingsNow, bookingsThen)}
              hint={period.previousLabel}
            />
            <Card
              title="Оборот"
              value={formatMinorTenge(capturedNow)}
              delta={deltaPercent(capturedNow, capturedThen)}
              hint={period.previousLabel}
            />
            <Card
              title="Отмены и неявки"
              value={formatRate(lostNow)}
              delta={lostNow !== null && lostThen !== null ? deltaPercent(lostNow, lostThen) : null}
              hint={period.previousLabel}
              // Fewer cancellations is the good direction, so the colour is
              // inverted here. A green «+40%» on cancellations would be a lie
              // told by a stylesheet.
              lowerIsBetter
            />
            <Card
              title="Возвраты"
              value={formatMinorTenge(payments.data?.refunded.amount_minor ?? 0)}
              hint={`возвратов ${payments.data?.refunded.count ?? 0}`}
              lowerIsBetter
            />
          </div>
        )}
        <p className="mt-2 text-xs text-neutral-400">
          Оборот — это деньги, прошедшие через эквайринг, а не доход платформы.
        </p>
      </Section>

      <Section title="Брони по статусам за период">
        {bookings.isLoading ? (
          <LoadingState />
        ) : bookings.isError ? (
          <ErrorState onRetry={() => bookings.refetch()} />
        ) : bookings.data && bookings.data.by_status.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {bookings.data.by_status.map((row) => (
              <Card
                key={row.status}
                title={STATUS_LABEL[row.status] ?? row.status}
                value={String(row.count)}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="За выбранный период броней не было" />
        )}
      </Section>

      <Section title="Топ заведений">
        <div className="mb-3 flex w-fit gap-1 rounded-lg bg-neutral-100 p-1">
          {(
            [
              { key: "bookings", label: "По броням" },
              { key: "gmv", label: "По обороту" },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setTopBy(o.key)}
              className={`rounded-md px-3 py-1 text-sm ${
                topBy === o.key ? "bg-white font-medium shadow-sm" : "text-neutral-600"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {top.isLoading ? (
          <LoadingState />
        ) : top.isError ? (
          <ErrorState onRetry={() => top.refetch()} />
        ) : top.data && top.data.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 text-left text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Заведение</th>
                  <th className="px-4 py-2 font-medium">Броней</th>
                  <th className="px-4 py-2 font-medium">Оборот</th>
                </tr>
              </thead>
              <tbody>
                {top.data.map((r) => (
                  <tr key={r.restaurant_id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2 text-neutral-900">{r.name}</td>
                    <td className="px-4 py-2">{r.bookings_count}</td>
                    <td className="px-4 py-2">{formatMinorTenge(r.gmv_minor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="За выбранный период данных нет" />
        )}
      </Section>

      {/* Context, not news: these barely move between two visits, so they sit
          at the bottom as one quiet line instead of five cards at the top. */}
      <Section title="Всего в системе">
        {overview.isLoading ? (
          <LoadingState />
        ) : overview.isError ? (
          <ErrorState onRetry={() => overview.refetch()} />
        ) : overview.data ? (
          <p className="text-sm text-neutral-600">
            Заведений {overview.data.total_restaurants} (активных{" "}
            {overview.data.active_restaurants}) · пользователей {overview.data.total_users} · броней
            за всё время {overview.data.total_bookings}
          </p>
        ) : null}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold text-neutral-900">{title}</h2>
      {children}
    </section>
  );
}

function Card({
  title,
  value,
  hint,
  delta,
  lowerIsBetter,
}: {
  title: string;
  value: string;
  hint?: string;
  delta?: number | null;
  lowerIsBetter?: boolean;
}) {
  const good = delta === null || delta === undefined || delta === 0 ? null : lowerIsBetter ? delta < 0 : delta > 0;
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-neutral-900">{value}</div>
      {delta !== undefined ? (
        <div className="mt-1 flex items-baseline gap-1 text-xs">
          <span
            className={
              good === null ? "text-neutral-400" : good ? "text-emerald-600" : "text-red-600"
            }
          >
            {formatDelta(delta)}
          </span>
          {hint ? <span className="text-neutral-400">{hint}</span> : null}
        </div>
      ) : hint ? (
        <div className="mt-1 text-xs text-neutral-400">{hint}</div>
      ) : null}
    </div>
  );
}

/** A card that names something to DO. With `href` the whole card is the way in;
 * without one it is a count the person acts on elsewhere (a venue confirms its
 * own bookings — the platform cannot do it for them). */
function ActionCard({
  title,
  value,
  href,
  action,
  hint,
}: {
  title: string;
  value: string;
  href?: string;
  action?: string;
  hint?: string;
}) {
  const body = (
    <>
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-neutral-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-neutral-400">{hint}</div> : null}
      {action ? <div className="mt-2 text-sm font-medium text-brand">{action} →</div> : null}
    </>
  );
  if (!href) {
    return <div className="rounded-xl border border-neutral-200 bg-white p-4">{body}</div>;
  }
  return (
    <Link
      href={href}
      className="block rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {body}
    </Link>
  );
}
