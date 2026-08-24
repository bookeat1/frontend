"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminBooking, AdminBookingPreorderItem, BookingStatus } from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatMinorTenge, formatTime, todayISODate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { StatusBadge } from "./ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "./StateViews";

type BookingAction = "confirm" | "cancel" | "no-show";

const STATUS_OPTIONS: BookingStatus[] = [
  "pending",
  "confirmed",
  "waitlist",
  "arrived",
  "completed",
  "cancelled",
  "no_show",
];

/** Which actions make sense for a given status. The backend is the real
 * authority on transitions; this only hides obviously-invalid buttons. */
function availableActions(status: BookingStatus): BookingAction[] {
  switch (status) {
    case "pending":
    case "waitlist":
      return ["confirm", "cancel"];
    case "confirmed":
    case "arrived":
      return ["cancel", "no-show"];
    default:
      return [];
  }
}

export function BookingsView() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant!.id;
  const queryClient = useQueryClient();

  const [date, setDate] = useState<string>(todayISODate());
  const [status, setStatus] = useState<BookingStatus | "">("");

  const queryKey = ["bookings", restaurantId, date, status] as const;

  const bookingsQuery = useQuery({
    queryKey,
    queryFn: () =>
      apiClient.listBookings(restaurantId, {
        date,
        statuses: status ? [status] : undefined,
        per_page: 100,
      }),
  });

  const action = useMutation({
    mutationFn: ({ bookingId, kind }: { bookingId: string; kind: BookingAction }) => {
      if (kind === "confirm") return apiClient.confirmBooking(restaurantId, bookingId);
      if (kind === "cancel") return apiClient.cancelBooking(restaurantId, bookingId);
      return apiClient.noShowBooking(restaurantId, bookingId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return (
    <section className="mx-auto flex max-w-[1100px] flex-col gap-lg">
      <header className="flex flex-wrap items-end justify-between gap-md">
        <h1 className="text-xl font-bold text-text">{t.admin.bookings.title}</h1>
        <div className="flex flex-wrap items-end gap-md">
          <label className="flex flex-col gap-xs">
            <span className="text-[12px] font-medium text-text-muted">
              {t.admin.bookings.dateLabel}
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || todayISODate())}
              className="min-h-[40px] rounded-card border border-hairline bg-white px-md text-sm text-text outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="text-[12px] font-medium text-text-muted">
              {t.admin.bookings.colStatus}
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BookingStatus | "")}
              className="min-h-[40px] rounded-card border border-hairline bg-white px-md text-sm text-text outline-none focus:border-brand"
            >
              <option value="">{t.admin.bookings.allStatuses}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t.admin.statuses[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {action.isError ? (
        <p role="alert" className="rounded-card bg-rose-50 px-md py-sm text-sm text-rose-700">
          {t.admin.bookings.actionFailed}
        </p>
      ) : null}

      {bookingsQuery.isPending ? (
        <LoadingState title={t.admin.bookings.loadingTitle} />
      ) : bookingsQuery.isError ? (
        <ErrorState onRetry={() => void bookingsQuery.refetch()} />
      ) : bookingsQuery.data.items.length === 0 ? (
        <EmptyState
          title={t.admin.bookings.emptyTitle}
          description={t.admin.bookings.emptyDescription}
        />
      ) : (
        <>
          <p className="text-sm text-text-muted">
            {t.admin.bookings.total(bookingsQuery.data.total)}
          </p>
          <BookingsTable
            bookings={bookingsQuery.data.items}
            pending={action.isPending ? action.variables : undefined}
            onAction={(bookingId, kind) => action.mutate({ bookingId, kind })}
          />
        </>
      )}
    </section>
  );
}

/**
 * Состав предзаказа под именем гостя.
 *
 * Ничего не рисует у брони без предзаказа: пустой заголовок «Предзаказ» в
 * каждой строке — это шум, из-за которого перестают замечать те строки, где
 * заказ действительно есть.
 */
function PreorderLines({ items }: { items: AdminBookingPreorderItem[] }) {
  if (!items || items.length === 0) return null;
  const total = items.reduce((sum, i) => sum + i.total_minor, 0);
  return (
    <div className="mt-xs rounded-card bg-surface-subtle px-sm py-xs">
      <span className="block text-[12px] font-medium text-text">
        {t.admin.bookings.preorderTitle}
      </span>
      <ul className="mt-[2px] space-y-[2px]">
        {items.map((item, index) => (
          <li key={`${item.name}-${index}`} className="text-[12px] text-text-muted">
            {item.quantity} × {item.name}
          </li>
        ))}
      </ul>
      <span className="mt-[2px] block text-[12px] text-text-muted">
        {t.admin.bookings.preorderTotal(formatMinorTenge(total))}
      </span>
    </div>
  );
}

export function BookingsTable({
  bookings,
  pending,
  onAction,
}: {
  bookings: AdminBooking[];
  pending: { bookingId: string; kind: BookingAction } | undefined;
  onAction: (bookingId: string, kind: BookingAction) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-card bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-hairline text-[12px] uppercase tracking-wide text-text-muted">
            <th className="px-md py-md font-medium">{t.admin.bookings.colTime}</th>
            <th className="px-md py-md font-medium">{t.admin.bookings.colGuest}</th>
            <th className="px-md py-md font-medium">{t.admin.bookings.colGuests}</th>
            <th className="px-md py-md font-medium">{t.admin.bookings.colStatus}</th>
            <th className="px-md py-md font-medium">{t.admin.bookings.colSource}</th>
            <th className="px-md py-md text-right font-medium">{t.admin.bookings.colActions}</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => {
            const actions = availableActions(b.status);
            return (
              <tr key={b.id} className="border-b border-hairline last:border-0 align-top">
                <td className="whitespace-nowrap px-md py-md font-medium text-text">
                  {formatTime(b.starts_at)}
                </td>
                <td className="px-md py-md">
                  <span className="block max-w-[240px] truncate font-medium text-text">
                    {b.name || "—"}
                  </span>
                  <span className="block text-[12px] text-text-muted">{b.phone}</span>
                  {/* Предзаказ виден прямо в строке брони, а не за отдельным
                      кликом: гость заказал блюда заранее ровно для того, чтобы
                      кухня узнала о них до его прихода. */}
                  <PreorderLines items={b.preorder} />
                </td>
                <td className="px-md py-md text-text">{b.guests}</td>
                <td className="px-md py-md">
                  <StatusBadge status={b.status} />
                </td>
                <td className="px-md py-md text-text-muted">
                  {t.admin.sources[b.source] ?? b.source}
                </td>
                <td className="px-md py-md">
                  <div className="flex flex-wrap justify-end gap-xs">
                    {actions.includes("confirm") ? (
                      <Button
                        size="sm"
                        variant="primary"
                        loading={pending?.bookingId === b.id && pending.kind === "confirm"}
                        disabled={pending?.bookingId === b.id}
                        onClick={() => onAction(b.id, "confirm")}
                      >
                        {t.admin.bookings.confirm}
                      </Button>
                    ) : null}
                    {actions.includes("no-show") ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={pending?.bookingId === b.id && pending.kind === "no-show"}
                        disabled={pending?.bookingId === b.id}
                        onClick={() => onAction(b.id, "no-show")}
                      >
                        {t.admin.bookings.noShow}
                      </Button>
                    ) : null}
                    {actions.includes("cancel") ? (
                      <Button
                        size="sm"
                        variant="danger"
                        loading={pending?.bookingId === b.id && pending.kind === "cancel"}
                        disabled={pending?.bookingId === b.id}
                        onClick={() => onAction(b.id, "cancel")}
                      >
                        {t.admin.bookings.cancel}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
