"use client";

import { useMemo, useState } from "react";

import { formatMinorTenge } from "@/lib/format";
import {
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
  { key: "7", label: "7 дней", days: 7 },
  { key: "30", label: "30 дней", days: 30 },
  { key: "90", label: "90 дней", days: 90 },
] as const;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function Card({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-neutral-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-neutral-400">{hint}</div> : null}
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

export function PlatformDashboard() {
  const isAdmin = useIsPlatformAdmin();
  const [periodKey, setPeriodKey] = useState<(typeof PERIODS)[number]["key"]>("30");
  const [topBy, setTopBy] = useState<"bookings" | "gmv">("bookings");

  const period = useMemo(() => {
    const days = PERIODS.find((p) => p.key === periodKey)?.days ?? 30;
    return { from: isoDaysAgo(days) };
  }, [periodKey]);

  const overview = usePlatformOverview();
  const bookings = usePlatformBookings(period);
  const payments = usePlatformPayments(period);
  const top = usePlatformTopRestaurants(period, topBy);

  // The role check is a UX guard, not a security one: the backend gates every
  // one of these endpoints on the admin role regardless. It exists so a venue
  // manager who lands here sees an explanation instead of four failed requests.
  if (!isAdmin) {
    return (
      <EmptyState
        title="Раздел только для администраторов платформы"
        description="Здесь показатели всей платформы. Данные вашего заведения — в разделе «Брони»."
      />
    );
  }

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

      <Section title="Всего в системе">
        {overview.isLoading ? (
          <LoadingState />
        ) : overview.isError ? (
          <ErrorState onRetry={() => overview.refetch()} />
        ) : overview.data ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Card
              title="Заведений"
              value={String(overview.data.total_restaurants)}
              hint={`активных ${overview.data.active_restaurants}`}
            />
            <Card title="Пользователей" value={String(overview.data.total_users)} />
            <Card title="Броней за всё время" value={String(overview.data.total_bookings)} />
            <Card title="Броней за 7 дней" value={String(overview.data.bookings_last_7_days)} />
            <Card title="Броней за 30 дней" value={String(overview.data.bookings_last_30_days)} />
          </div>
        ) : null}
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

      <Section title="Деньги за период">
        {payments.isLoading ? (
          <LoadingState />
        ) : payments.isError ? (
          <ErrorState onRetry={() => payments.refetch()} />
        ) : payments.data ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card
              title="Проведено"
              value={formatMinorTenge(payments.data.captured.amount_minor)}
              hint={`платежей ${payments.data.captured.count}`}
            />
            <Card
              title="Возвращено"
              value={formatMinorTenge(payments.data.refunded.amount_minor)}
              hint={`возвратов ${payments.data.refunded.count}`}
            />
          </div>
        ) : null}
        <p className="mt-2 text-xs text-neutral-400">
          Проведено — это оборот через эквайринг, а не доход платформы.
        </p>
      </Section>

      <Section title="Топ заведений">
        <div className="mb-3 flex gap-1 rounded-lg bg-neutral-100 p-1 w-fit">
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
    </div>
  );
}
