import type { Booking, CreateBookingInput, PreorderLineInput } from "@bookeat/api";
import { RepositoryError } from "@bookeat/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
