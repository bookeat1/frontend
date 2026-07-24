"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AdminGuest } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { EmptyState, ErrorState, LoadingState } from "./StateViews";

export function GuestsView() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant!.id;
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["guests", restaurantId],
    queryFn: () => apiClient.listGuests(restaurantId),
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = query.data ?? [];
    if (!needle) return rows;
    return rows.filter(
      (g) =>
        g.name.toLowerCase().includes(needle) ||
        g.phone.toLowerCase().includes(needle) ||
        g.email.toLowerCase().includes(needle),
    );
  }, [query.data, search]);

  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-lg">
      <header className="flex flex-wrap items-end justify-between gap-md">
        <h1 className="text-xl font-bold text-text">{t.admin.guests.title}</h1>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.admin.guests.colName}
          className="min-h-[40px] w-full max-w-[280px] rounded-card border border-hairline bg-white px-md text-sm text-text outline-none focus:border-brand"
        />
      </header>

      {query.isPending ? (
        <LoadingState title={t.admin.guests.loadingTitle} />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (query.data?.length ?? 0) === 0 ? (
        <EmptyState
          title={t.admin.guests.emptyTitle}
          description={t.admin.guests.emptyDescription}
        />
      ) : (
        <>
          <p className="text-sm text-text-muted">{t.admin.guests.total(query.data.length)}</p>
          <GuestsTable guests={filtered} />
        </>
      )}
    </section>
  );
}

function GuestsTable({ guests }: { guests: AdminGuest[] }) {
  return (
    <div className="overflow-x-auto rounded-card bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-hairline text-[12px] uppercase tracking-wide text-text-muted">
            <th className="px-md py-md font-medium">{t.admin.guests.colName}</th>
            <th className="px-md py-md font-medium">{t.admin.guests.colPhone}</th>
            <th className="px-md py-md font-medium">{t.admin.guests.colEmail}</th>
            <th className="px-md py-md text-right font-medium">{t.admin.guests.colBookings}</th>
            <th className="px-md py-md text-right font-medium">{t.admin.guests.colVisits}</th>
            <th className="px-md py-md font-medium">{t.admin.guests.colLast}</th>
          </tr>
        </thead>
        <tbody>
          {guests.map((g) => (
            <tr
              key={g.phone_normalized || g.user_id || g.phone}
              className="border-b border-hairline align-top last:border-0"
            >
              <td className="px-md py-md">
                <span className="block max-w-[240px] break-words font-medium text-text">
                  {g.name || "—"}
                </span>
              </td>
              <td className="whitespace-nowrap px-md py-md text-text-muted">{g.phone || "—"}</td>
              <td className="px-md py-md text-text-muted">
                <span className="block max-w-[220px] truncate">{g.email || "—"}</span>
              </td>
              <td className="px-md py-md text-right text-text">{g.bookings_count}</td>
              <td className="px-md py-md text-right text-text">{g.visits_count}</td>
              <td className="whitespace-nowrap px-md py-md text-text-muted">
                {formatDate(g.last_booking_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
