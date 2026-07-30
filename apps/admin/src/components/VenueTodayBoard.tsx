"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  classifyBookingActionFailure,
  type AdminBooking,
  type BookingActionFailureKind,
  type BookingReasonInput,
  type VenueToday,
  type VenueTodayBooking,
  type VenueTodayParams,
} from "@bookeat/api/admin";

import { apiClient } from "@/lib/api";
import { t } from "@/lib/i18n";
import { formatTime } from "@/lib/format";
import { formatBookingWhen, formatWaiting, telHref } from "@/lib/venue-today";
import { Button } from "./ui/Button";
import { StatusBadge } from "./ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "./StateViews";

/**
 * The operational top of the panel's landing page: the requests nobody has
 * answered yet, and the venue's own day.
 *
 * It sits ABOVE the period counters (VenueDashboard) because a hostess opening
 * the panel mid-shift is not asking "how was the month" — she is asking "who is
 * waiting for me and who walks in next". Both blocks come from ONE endpoint
 * (GET /restaurants/:id/dashboard/today) and therefore from one query: they are
 * two views of the same instant, and letting them refetch separately would show
 * a request in "требуют ответа" that the list below already shows as confirmed.
 */

/** How many requests fit on the screen before the link takes over. Five is what
 * a person scans without scrolling on a tablet; the rest live on /bookings. */
const AWAITING_VISIBLE = 5;

/** The three client methods this block needs. A prop rather than a hard import
 * of the singleton so it can be rendered against a fake in a test — the shared
 * client reads its base URL from the environment at module load. */
export interface VenueTodayClient {
  venueDashboardToday(restaurantId: string, params?: VenueTodayParams): Promise<VenueToday>;
  confirmBooking(
    restaurantId: string,
    bookingId: string,
    body?: BookingReasonInput,
  ): Promise<AdminBooking>;
  rejectBooking(
    restaurantId: string,
    bookingId: string,
    body?: BookingReasonInput,
  ): Promise<AdminBooking>;
}

const copy = t.admin.today;

/** Wording per outcome. Exhaustive by type: a new kind in @bookeat/api stops
 * compiling here instead of silently borrowing another one's sentence. */
const FAILURE_TEXT: Record<BookingActionFailureKind, string> = {
  already_answered: copy.failure.alreadyAnswered,
  refused: copy.failure.refused,
  forbidden: copy.failure.forbidden,
  unauthorized: copy.failure.unauthorized,
  not_found: copy.failure.notFound,
  unknown: copy.failure.unknown,
};

type ActionKind = "confirm" | "reject";

export function VenueTodayBoard({
  restaurantId,
  client = apiClient,
}: {
  restaurantId: string;
  client?: VenueTodayClient;
}) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["venue-today", restaurantId] as const, [restaurantId]);
  const [failure, setFailure] = useState<BookingActionFailureKind | null>(null);

  const today = useQuery({
    queryKey,
    queryFn: () => client.venueDashboardToday(restaurantId),
    // Short: this is the one screen where a stale answer costs a guest. Long
    // enough that switching tabs does not hammer the endpoint.
    staleTime: 30_000,
  });

  const answer = useMutation({
    mutationFn: ({ bookingId, kind }: { bookingId: string; kind: ActionKind }) =>
      kind === "confirm"
        ? client.confirmBooking(restaurantId, bookingId)
        : client.rejectBooking(restaurantId, bookingId),
    onMutate: () => setFailure(null),
    onSuccess: () => {
      // The whole view is invalidated, not patched: confirming a request moves
      // it out of one block and into the other, and the counters below it
      // («N броней · M гостей») are server-computed over the whole day.
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => {
      const outcome = classifyBookingActionFailure(error);
      setFailure(outcome.kind);
      // "Already answered", "gone" and "we do not know" all mean the rows on
      // screen no longer describe reality — re-read rather than let staff act
      // on a stale list.
      if (outcome.staleList) void queryClient.invalidateQueries({ queryKey });
    },
  });

  const inFlight = answer.isPending ? (answer.variables ?? null) : null;

  if (today.isPending) return <LoadingState title={copy.loadingTitle} />;
  if (today.isError) return <ErrorState onRetry={() => void today.refetch()} />;

  const data = today.data;
  const visibleAwaiting = data.awaiting.slice(0, AWAITING_VISIBLE);
  const hiddenAwaiting = Math.max(0, data.awaiting_total - visibleAwaiting.length);

  return (
    <div className="flex flex-col gap-xl">
      {failure ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-md rounded-card bg-rose-50 px-md py-sm text-sm text-rose-700"
        >
          <span>{FAILURE_TEXT[failure]}</span>
          <Button variant="secondary" size="sm" onClick={() => void today.refetch()}>
            {copy.refresh}
          </Button>
        </div>
      ) : null}

      {/* No requests: no block at all. An empty «Требуют ответа» card would be
          a permanent piece of furniture reporting that nothing is wrong. */}
      {visibleAwaiting.length > 0 ? (
        <section className="rounded-card border border-hairline bg-white">
          <header className="flex items-center justify-between gap-md px-md py-sm">
            <h2 className="flex items-center gap-sm text-base font-bold text-text">
              {copy.awaitingTitle}
              <span className="inline-flex min-w-[24px] justify-center rounded-pill bg-amber-100 px-sm py-xxs text-[13px] font-semibold text-amber-800">
                {data.awaiting_total}
              </span>
            </h2>
          </header>

          <ul className="flex flex-col">
            {visibleAwaiting.map((booking) => (
              <AwaitingRow
                key={booking.id}
                booking={booking}
                busyKind={inFlight?.bookingId === booking.id ? inFlight.kind : null}
                // While one answer is in flight every button is inert: a second
                // click on a neighbouring row would race the invalidation and
                // act on a row that is about to move.
                disabled={answer.isPending}
                onAnswer={(kind) => answer.mutate({ bookingId: booking.id, kind })}
              />
            ))}
          </ul>

          {hiddenAwaiting > 0 ? (
            <div className="border-t border-hairline px-md py-sm">
              {/* Plain /bookings: the screen keeps its filters in local state,
                  so a `?status=pending` here would be a promise the target does
                  not read. Wire it up when that screen learns query filters. */}
              <Link href="/bookings" className="text-sm font-medium text-brand hover:underline">
                {copy.awaitingMore(hiddenAwaiting)}
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-card border border-hairline bg-white">
        <header className="flex flex-wrap items-baseline justify-between gap-sm px-md py-sm">
          <div>
            <h2 className="text-base font-bold text-text">{copy.todayTitle}</h2>
            <p className="text-sm text-text-muted">
              {copy.todaySubtitle(data.today_total, data.guests)}
            </p>
          </div>
          <Link href="/bookings" className="text-sm font-medium text-brand hover:underline">
            {copy.wholeDay}
          </Link>
        </header>

        {data.today.length === 0 ? (
          <div className="px-md pb-md">
            <EmptyState title={copy.emptyTodayTitle} description={copy.emptyTodayDescription} />
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-sm px-md pb-md sm:grid-cols-2 lg:grid-cols-3">
            {data.today.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-col gap-xs rounded-card border border-hairline p-md"
              >
                {/* Rendered in the READER's timezone, like every other time in
                    the cabinet (formatTime). Which bookings belong to "today"
                    is decided server-side in the VENUE's zone, so a device set
                    to another zone shows the right rows at shifted clock times.
                    Fixing that means threading the venue timezone through the
                    whole panel — one change, not this screen's alone. */}
                <span className="text-2xl font-bold leading-none text-text">
                  {formatTime(booking.starts_at)}
                </span>
                <span className="break-words text-sm font-medium text-text">{booking.name}</span>
                <span className="text-sm text-text-muted">{copy.guestsCount(booking.guests)}</span>
                <StatusBadge status={booking.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AwaitingRow({
  booking,
  busyKind,
  disabled,
  onAnswer,
}: {
  booking: VenueTodayBooking;
  /** Which of this row's two buttons is currently waiting on the server, if
   * any — so the spinner appears on the button the person actually pressed. */
  busyKind: ActionKind | null;
  disabled: boolean;
  onAnswer: (kind: ActionKind) => void;
}) {
  const tel = telHref(booking.phone);

  return (
    <li className="flex flex-col gap-sm border-t border-hairline px-md py-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-xxs">
        <span className="text-sm font-semibold text-text">
          {formatBookingWhen(booking.starts_at)}
        </span>
        <span className="break-words text-sm text-text">
          {booking.name} · {copy.guestsCount(booking.guests)}
        </span>
        {tel ? (
          // A real link, not a copyable string: on the tablet at the host stand
          // this is one tap to call back.
          <a
            href={tel}
            aria-label={copy.callAria(booking.name)}
            className="w-fit text-sm font-medium text-brand hover:underline"
          >
            {booking.phone}
          </a>
        ) : (
          <span className="text-sm text-text-muted">{booking.phone}</span>
        )}
        <span className="text-[13px] text-text-muted">{formatWaiting(booking.waiting_minutes)}</span>
      </div>

      <div className="flex shrink-0 gap-sm">
        <Button
          size="sm"
          onClick={() => onAnswer("confirm")}
          disabled={disabled}
          loading={busyKind === "confirm"}
        >
          {copy.confirm}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onAnswer("reject")}
          disabled={disabled}
          loading={busyKind === "reject"}
        >
          {copy.reject}
        </Button>
      </div>
    </li>
  );
}
