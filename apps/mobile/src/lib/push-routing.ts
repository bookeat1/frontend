/**
 * Where a tapped notification takes the guest.
 *
 * The payload is whatever arrived over the network, so it is typed `unknown`
 * and validated field by field. A push that does not carry a usable subject id
 * opens NOTHING — the app stays where it is. That is the deliberate choice: a
 * fallback to the home screen would silently swallow a routing bug and look to
 * the guest like the tap did nothing anyway.
 *
 * Two payload families exist today, and neither is guessed:
 *
 *   1. Guest booking pushes — what `buildGuestMessage` in
 *      backend-core/internal/usecase/notifications/guestpush.go puts in
 *      `Data`, delivered verbatim under
 *      `notification.request.content.data`:
 *
 *        event         "booking.confirmed" | "booking.cancelled" | "booking.reminder"
 *        booking_id    UUID string
 *        restaurant_id UUID string
 *        starts_at     RFC3339
 *
 *   2. Push-campaign pushes (push-campaigns spec, §4 criteria 21/32) — sent
 *      by the manual admin campaign, `usecase/pushcampaigns`:
 *
 *        event         "content.event" | "content.promo"
 *        campaign_id   UUID string
 *        event_id      UUID string (only when event = "content.event")
 *        promo_id      UUID string (only when event = "content.promo")
 *        restaurant_id UUID string, optional (absent for a platform subject)
 *
 * All values are strings server-side (`map[string]string`), but iOS and
 * Android both hand the payload back through a JSON round trip, so nothing may
 * be assumed about the runtime type.
 */

/** The three events the guest booking channel sends — all three are about ONE
 * booking and all three land on the same screen, which re-reads the booking
 * from the server. */
const KNOWN_BOOKING_EVENTS = ["booking.confirmed", "booking.cancelled", "booking.reminder"] as const;

/** What a tap should be reported as to Amplitude (`push_opened`, criterion 36) —
 * kept alongside the target rather than re-derived from the route, so the one
 * place that parses the payload is also the one place that names its kind. */
export type PushKind = "booking" | "event" | "promo";

export type PushTarget =
  | {
      /** The expo-router route. Typed as the literal so a renamed route
       * breaks the build here instead of at runtime on someone's phone. */
      pathname: "/booking/[id]";
      params: { id: string };
      kind: "booking";
    }
  | {
      pathname: "/event/[id]";
      params: { id: string };
      kind: "event";
      /** Present on every campaign push; absent is not expected but not
       * fatal — analytics just gets one field less. */
      campaignId?: string;
    }
  | {
      pathname: "/promotion/[id]";
      params: { id: string };
      kind: "promo";
      campaignId?: string;
    };

function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * The screen a tap should open, or null when the payload cannot name one.
 *
 * A payload from a newer backend than this build (an `event` this file does
 * not recognise) is ignored rather than guessed at — the sign of a build that
 * needs an update, not a bug to patch around (spec §3.14).
 */
export function pushNavigationTarget(data: unknown): PushTarget | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;

  const event = stringField(record, "event");
  if (!event) return null;

  if ((KNOWN_BOOKING_EVENTS as readonly string[]).includes(event)) {
    const bookingId = stringField(record, "booking_id");
    if (!bookingId) return null;
    return { pathname: "/booking/[id]", params: { id: bookingId }, kind: "booking" };
  }

  const campaignId = stringField(record, "campaign_id");

  if (event === "content.event") {
    const eventId = stringField(record, "event_id");
    if (!eventId) return null;
    return { pathname: "/event/[id]", params: { id: eventId }, kind: "event", campaignId };
  }

  if (event === "content.promo") {
    const promoId = stringField(record, "promo_id");
    if (!promoId) return null;
    return { pathname: "/promotion/[id]", params: { id: promoId }, kind: "promo", campaignId };
  }

  return null;
}
