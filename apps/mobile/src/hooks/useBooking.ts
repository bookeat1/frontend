import type {
  Booking,
  BookingPage,
  BookingPayment,
  CancelBookingInput,
  CreateBookingInput,
  PreorderLineInput,
} from "@bookeat/api";
import { RepositoryError } from "@bookeat/api";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useAuth } from "../lib/auth";
import { useRepository } from "../lib/repository";

/**
 * Bookable slots for one day. The query key carries the party size because
 * availability is computed per party — a cached answer for 2 says nothing
 * about 8.
 *
 * `staleTime: 0`: slots go stale the moment somebody else books one, and the
 * cost of a wrong answer here is a guest picking a time that then 409s.
 */
export function useAvailability(input: {
  restaurantId: string | undefined;
  date: string;
  guests: number;
}) {
  const repository = useRepository();
  return useQuery({
    queryKey: ["availability", input.restaurantId, input.date, input.guests],
    queryFn: () => {
      if (!input.restaurantId) throw new Error("Missing restaurant id");
      return repository.getAvailability({
        restaurantId: input.restaurantId,
        date: input.date,
        guests: input.guests,
      });
    },
    enabled: Boolean(input.restaurantId),
    staleTime: 0,
  });
}

/** The venue's full menu for the pre-order step. Static enough to cache for a
 * few minutes; a real venue returns up to ~300 dishes and refetching that on
 * every screen focus is pure waste on a phone connection. */
export function useMenuSections(restaurantId: string | undefined) {
  const repository = useRepository();
  return useQuery({
    queryKey: ["menu-sections", restaurantId],
    queryFn: () => {
      if (!restaurantId) throw new Error("Missing restaurant id");
      return repository.getMenuSections(restaurantId);
    },
    enabled: Boolean(restaurantId),
    staleTime: 5 * 60_000,
  });
}

export function useBooking(bookingId: string | undefined) {
  const repository = useRepository();
  const { status } = useAuth();
  return useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => {
      if (!bookingId) throw new Error("Missing booking id");
      return repository.getBooking(bookingId);
    },
    // Waiting for the session to hydrate avoids a guaranteed 401 on a cold
    // start straight into a booking deep link.
    enabled: Boolean(bookingId) && status === "signed-in",
  });
}

export const MY_BOOKINGS_QUERY_KEY = ["my-bookings"] as const;

/** How many bookings one page of the list screen asks for. */
const MY_BOOKINGS_PAGE_SIZE = 20;

/**
 * The guest's own bookings (`GET /bookings`), page by page.
 *
 * Paginated rather than "fetch everything": the server order is
 * `starts_at DESC` and a guest who has been using the app for a year has a
 * long tail nobody scrolls to. `pages === 0` means the guest has no bookings
 * at all — that is a finished list, not "more to come".
 *
 * Session-gated for the same reason as useBooking: an anonymous call is a
 * guaranteed 401, and the screen shows a sign-in prompt instead.
 */
export function useMyBookings() {
  const repository = useRepository();
  const { status } = useAuth();

  return useInfiniteQuery({
    queryKey: MY_BOOKINGS_QUERY_KEY,
    queryFn: ({ pageParam }) =>
      repository.listMyBookings({ page: pageParam, perPage: MY_BOOKINGS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last: BookingPage) =>
      last.page < last.pages ? last.page + 1 : undefined,
    enabled: status === "signed-in",
    // A booking can be confirmed or cancelled by the venue at any moment, so
    // the list is re-read when the screen is opened again.
    staleTime: 0,
  });
}

export interface CreateBookingVariables {
  input: CreateBookingInput;
  idempotencyKey: string;
  /** Sent as a second request once the booking exists — the pre-order endpoint
   * is booking-scoped, so it cannot be part of creating one. */
  preorder: PreorderLineInput[];
}

export interface CreateBookingOutcome {
  booking: Booking;
  /**
   * True when the booking was created but attaching the pre-order failed
   * (after one retry). The flow must NOT report this as a failed booking —
   * the table is held; the confirmation screen shows a notice instead.
   */
  preorderFailed: boolean;
}

/**
 * Creates the booking and, if the guest picked dishes, attaches the pre-order.
 *
 * Two requests rather than one on purpose: `POST /bookings` does accept an
 * `items` array, but that path takes the price from the client. `PUT
 * /bookings/:id/preorder` prices every line from the venue's own menu, so no
 * number about money leaves the device.
 *
 * The token is refreshed immediately before submitting: access tokens live
 * ~15 minutes and a guest can easily sit on this screen for longer.
 */
export function useCreateBooking() {
  const repository = useRepository();
  const queryClient = useQueryClient();
  const { ensureFreshToken } = useAuth();

  return useMutation<CreateBookingOutcome, unknown, CreateBookingVariables>({
    mutationFn: async ({ input, idempotencyKey, preorder }) => {
      const token = await ensureFreshToken();
      if (!token) {
        throw new RepositoryError("Session expired before booking", undefined, 401);
      }
      const booking = await repository.createBooking(input, idempotencyKey);
      if (preorder.length === 0) {
        return { booking, preorderFailed: false };
      }
      // One retry, then give up and report it. PUT /preorder is idempotent by
      // construction (it REPLACES the lines), so retrying cannot duplicate an
      // order — which is exactly why a blind retry is safe here and would not
      // be on the create call.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await repository.setPreorder(booking.id, preorder);
          return { booking, preorderFailed: false };
        } catch {
          // fall through to the next attempt
        }
      }
      return { booking, preorderFailed: true };
    },
    onSuccess: ({ booking }) => {
      queryClient.setQueryData(["booking", booking.id], booking);
      // The slot this booking took is gone; anything cached for that venue is
      // now a lie.
      void queryClient.invalidateQueries({ queryKey: ["availability", booking.restaurantId] });
      // The guest now has one more booking than the list screen knows about.
      void queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_QUERY_KEY });
    },
  });
}

export function usePreorder(bookingId: string | undefined) {
  const repository = useRepository();
  const { status } = useAuth();
  return useQuery({
    queryKey: ["preorder", bookingId],
    queryFn: () => {
      if (!bookingId) throw new Error("Missing booking id");
      return repository.getPreorder(bookingId);
    },
    enabled: Boolean(bookingId) && status === "signed-in",
  });
}

/**
 * The booking's live payment, or `null` when it has none. Only fetched for a
 * booking that can still be cancelled: the answer exists solely to tell the
 * guest what a cancellation costs, and there is no reason to spend a request
 * on a booking that is already over.
 *
 * `retry: 1` rather than the default 3 — the cancel dialog waits on this, and
 * a slow triple retry would leave the guest looking at "проверяем…" far
 * longer than they'd tolerate before we admit we don't know.
 */
export function useBookingPayment(bookingId: string | undefined, enabled: boolean) {
  const repository = useRepository();
  const { status } = useAuth();
  return useQuery<BookingPayment | null>({
    queryKey: ["booking-payment", bookingId],
    queryFn: () => {
      if (!bookingId) throw new Error("Missing booking id");
      return repository.getBookingPayment(bookingId);
    },
    enabled: Boolean(bookingId) && enabled && status === "signed-in",
    retry: 1,
    staleTime: 60_000,
  });
}

export interface CancelBookingVariables {
  bookingId: string;
  input?: CancelBookingInput;
}

/**
 * Cancels a booking.
 *
 * DOUBLE TAP. `POST /bookings/:id/cancel` is NOT idempotent — a replay of a
 * successful cancel answers 422 "invalid status transition" — so there are
 * three independent guards, deliberately not one:
 *   1. the dialog's confirm button is disabled while `isPending`;
 *   2. `mutationFn` refuses to start when a cancel for the same booking is
 *      already in flight (`inFlight`), which also covers a second tap that
 *      arrives inside React's render window before the disabled prop lands;
 *   3. even if a second request did get out, the 422 branch below resolves it
 *      into a success as long as the booking really is cancelled.
 *
 * ALREADY CANCELLED. A 422 "invalid status transition" is not reported as a
 * failure on faith — it could equally mean "completed" or "no_show". The
 * booking is RE-READ, and only a booking that actually comes back `cancelled`
 * is treated as success. Anything else is a real error.
 *
 * CACHE. On success the booking in the cache is REPLACED rather than
 * invalidated, so the screen re-renders as cancelled with no refetch flash.
 * The cancel response carries no `free_cancel_deadline` (it is the plain
 * booking payload, not the details one), so the previous value is preserved
 * instead of being overwritten with null.
 */
export function useCancelBooking() {
  const repository = useRepository();
  const queryClient = useQueryClient();
  const { ensureFreshToken } = useAuth();
  const inFlight = useRef<Set<string>>(new Set());

  return useMutation<Booking, unknown, CancelBookingVariables>({
    mutationFn: async ({ bookingId, input }) => {
      if (inFlight.current.has(bookingId)) {
        throw new RepositoryError(`Cancel already in flight for ${bookingId}`, undefined, 409);
      }
      inFlight.current.add(bookingId);
      try {
        const token = await ensureFreshToken();
        if (!token) {
          throw new RepositoryError("Session expired before cancelling", undefined, 401);
        }
        try {
          return await repository.cancelBooking(bookingId, input);
        } catch (error) {
          if (!(error instanceof RepositoryError) || !error.isInvalidStatusTransition) {
            throw error;
          }
          // Terminal state. Find out WHICH one before calling it a success.
          const current = await repository.getBooking(bookingId);
          if (current.status === "cancelled") return current;
          throw error;
        }
      } finally {
        inFlight.current.delete(bookingId);
      }
    },
    onSuccess: (booking) => {
      queryClient.setQueryData<Booking>(["booking", booking.id], (previous) => ({
        ...booking,
        // The cancel payload has no free_cancel_deadline; keep what we knew.
        freeCancelDeadline: booking.freeCancelDeadline ?? previous?.freeCancelDeadline ?? null,
      }));
      // The table is back on the market.
      void queryClient.invalidateQueries({ queryKey: ["availability", booking.restaurantId] });
      // Whatever the deposit did, our copy of the payment is now stale.
      void queryClient.invalidateQueries({ queryKey: ["booking-payment", booking.id] });
      // The list screen still shows this booking as live.
      void queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_QUERY_KEY });
    },
  });
}
