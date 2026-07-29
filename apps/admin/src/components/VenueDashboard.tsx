"use client";

import { useMemo, useState } from "react";
import type { VenueLoadSlot } from "@bookeat/api/admin";

import { formatMinorTenge } from "@/lib/format";
import { useVenueLoad, useVenueSummary } from "@/lib/use-venue-dashboard";

import { EmptyState, ErrorState, LoadingState } from "./StateViews";

const STATUS_LABEL: Record<string, string> = {
  pending: "Ожидают ответа",
  confirmed: "Подтверждены",
  waitlist: "В листе ожидания",
  arrived: "Гость пришёл",
  completed: "Завершены",
  cancelled: "Отменены",
  no_show: "Не пришли",
};

/** Reason codes the app sends today. An unknown code shows as itself rather
 * than disappearing, and an EMPTY one is the count nobody explained — the row
 * a venue most needs to see, so it is labelled, not hidden. */
const REASON_LABEL: Record<string, string> = {
  "": "Причина не указана",
  changed_plans: "Изменились планы",
  found_another_place: "Выбрали другое место",
  wrong_time: "Ошиблись со временем",
  restaurant_request: "По просьбе заведения",
  other: "Другое",
};

const PERIODS = [
  { key: "7", label: "7 дней", days: 7 },
  { key: "30", label: "30 дней", days: 30 },
  { key: "90", label: "90 дней", days: 90 },
] as const;

/** Monday first: staff read a week starting Monday, while the API follows
 * time.Weekday (0 = Sunday). */
const WEEKDAYS = [
  { index: 1, short: "Пн" },
  { index: 2, short: "Вт" },
  { index: 3, short: "Ср" },
  { index: 4, short: "Чт" },
  { index: 5, short: "Пт" },
  { index: 6, short: "Сб" },
  { index: 0, short: "Вс" },
];

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

/** The load grid. Only hours the venue actually books are shown: rendering a
 * full 24 columns would bury six busy evening hours in eighteen empty ones. */
function LoadGrid({ slots }: { slots: VenueLoadSlot[] }) {
  const hours = useMemo(
    () => Array.from(new Set(slots.map((s) => s.hour))).sort((a, b) => a - b),
    [slots],
  );
  const max = useMemo(() => Math.max(...slots.map((s) => s.bookings), 1), [slots]);
  const byCell = useMemo(() => {
    const m = new Map<string, VenueLoadSlot>();
    for (const s of slots) m.set(`${s.weekday}:${s.hour}`, s);
    return m;
  }, [slots]);

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white p-3">
      <table className="border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="w-8" />
            {hours.map((h) => (
              <th key={h} className="w-10 font-normal text-neutral-500">
                {String(h).padStart(2, "0")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.map((d) => (
            <tr key={d.index}>
              <td className="pr-1 text-neutral-500">{d.short}</td>
              {hours.map((h) => {
                const cell = byCell.get(`${d.index}:${h}`);
                const n = cell?.bookings ?? 0;
                // Opacity carries the load; a bare number would make an empty
                // grid look identical to a busy one at a glance.
                const alpha = n === 0 ? 0 : 0.15 + (0.85 * n) / max;
                return (
                  <td
                    key={h}
                    title={n ? `${d.short} ${h}:00 — ${n} броней, ${cell?.guests ?? 0} гостей` : undefined}
                    className="h-8 w-10 rounded text-center align-middle"
                    style={{
                      backgroundColor: n ? `rgba(220, 38, 38, ${alpha})` : "#F5F5F5",
                      color: alpha > 0.55 ? "#fff" : "#404040",
                    }}
                  >
                    {n || ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VenueDashboard() {
  const [periodKey, setPeriodKey] = useState<(typeof PERIODS)[number]["key"]>("30");
  const period = useMemo(() => {
    const days = PERIODS.find((p) => p.key === periodKey)?.days ?? 30;
    return { from: isoDaysAgo(days) };
  }, [periodKey]);

  const summary = useVenueSummary(period);
  const load = useVenueLoad(period);

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Сводка</h1>
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

      {summary.isLoading ? (
        <LoadingState />
      ) : summary.isError ? (
        <ErrorState onRetry={() => summary.refetch()} />
      ) : summary.data ? (
        <>
          <Section title="За период">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card title="Броней" value={String(summary.data.total)} />
              <Card
                title="Отмены и неявки"
                value={`${summary.data.cancelled_share}%`}
                hint="от всех броней за период"
              />
              <Card title="Средняя компания" value={`${summary.data.avg_party_size}`} hint="гостей на бронь" />
              <Card
                title="Предзаказы"
                value={String(summary.data.preorder_bookings)}
                hint={`на ${formatMinorTenge(summary.data.preorder_total_minor)}`}
              />
            </div>
          </Section>

          <Section title="По статусам">
            {summary.data.by_status.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {summary.data.by_status.map((s) => (
                  <Card key={s.status} title={STATUS_LABEL[s.status] ?? s.status} value={String(s.count)} />
                ))}
              </div>
            ) : (
              <EmptyState title="За выбранный период броней не было" />
            )}
          </Section>

          {summary.data.cancel_reasons.length > 0 ? (
            <Section title="Почему отменяли">
              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                {summary.data.cancel_reasons.map((r) => (
                  <div
                    key={r.reason || "unknown"}
                    className="flex items-center justify-between border-b border-neutral-100 px-4 py-2 text-sm last:border-0"
                  >
                    <span className="text-neutral-900">{REASON_LABEL[r.reason] ?? r.reason}</span>
                    <span className="text-neutral-500">{r.count}</span>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </>
      ) : null}

      <Section title="Когда у вас занято">
        {load.isLoading ? (
          <LoadingState />
        ) : load.isError ? (
          <ErrorState onRetry={() => load.refetch()} />
        ) : load.data && load.data.length > 0 ? (
          <>
            <LoadGrid slots={load.data} />
            <p className="mt-2 text-xs text-neutral-400">
              Часы местные. Отменённые брони не учитываются.
            </p>
          </>
        ) : (
          <EmptyState title="За выбранный период броней не было" />
        )}
      </Section>
    </div>
  );
}
