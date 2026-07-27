/**
 * Where a tapped notification takes the guest.
 *
 * The payload is whatever arrived over the network, so it is typed `unknown`
 * and validated field by field. A push that does not carry a usable booking id
 * opens NOTHING — the app stays where it is. That is the deliberate choice: a
 * fallback to the home screen would silently swallow a routing bug and look to
 * the guest like the tap did nothing anyway.
 *
 * The shape below is not guessed. It is what
 * `buildGuestMessage` in backend-core/internal/usecase/notifications/
 * guestpush.go puts in `Data`, and Expo delivers it verbatim under
 * `notification.request.content.data`:
 *
 *   event         "booking.confirmed" | "booking.cancelled" | "booking.reminder"
 *   booking_id    UUID string
 *   restaurant_id UUID string
 *   starts_at     RFC3339
 *
 * All four values are strings server-side (`map[string]string`), but iOS and
 * Android both hand the payload back through a JSON round trip, so nothing may
 * be assumed about the runtime type.
 */

/** The three events the guest channel sends. Anything else is a payload from a
 * newer backend than this build and is ignored rather than guessed at. */
const KNOWN_EVENTS = ["booking.confirmed", "booking.cancelled", "booking.reminder"] as const;

export type GuestPushEvent = (typeof KNOWN_EVENTS)[number];

export interface PushTarget {
  /** The expo-router route. Typed as the literal so a renamed route breaks the
   * build here instead of at runtime on someone's phone. */
  pathname: "/booking/[id]";
  params: { id: string };
}

function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * The screen a tap should open, or null when the payload cannot name one.
 *
 * `event` is validated but not branched on: all three guest events are about
 * ONE booking and all three land on the same screen, which re-reads the
 * booking from the server — so a reminder and a cancellation show the truth
 * without this file having to know the difference.
 */
export function pushNavigationTarget(data: unknown): PushTarget | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;

  const event = stringField(record, "event");
  if (!event || !(KNOWN_EVENTS as readonly string[]).includes(event)) return null;

  const bookingId = stringField(record, "booking_id");
  if (!bookingId) return null;

  return { pathname: "/booking/[id]", params: { id: bookingId } };
}
