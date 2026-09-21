import { describe, expect, it } from "vitest";
import { pushNavigationTarget } from "../push-routing";

/**
 * push-campaigns spec, §4 criterion 32: a tap on `content.event` opens
 * `/event/[id]`, a tap on `content.promo` opens `/promotion/[id]`, and a
 * payload this build does not recognise opens NOTHING (spec §3.14 — an old
 * build degrades honestly rather than guessing).
 *
 * The three pre-existing `booking.*` events are pinned too, so this file is
 * the one place a future change to the union can break loudly instead of on
 * someone's phone.
 */
describe("pushNavigationTarget", () => {
  it("booking.confirmed opens /booking/[id]", () => {
    const target = pushNavigationTarget({
      event: "booking.confirmed",
      booking_id: "b-1",
      restaurant_id: "r-1",
    });
    expect(target).toEqual({
      pathname: "/booking/[id]",
      params: { id: "b-1" },
      kind: "booking",
    });
  });

  it("booking.cancelled and booking.reminder also open /booking/[id]", () => {
    for (const event of ["booking.cancelled", "booking.reminder"]) {
      const target = pushNavigationTarget({ event, booking_id: "b-2" });
      expect(target?.pathname).toBe("/booking/[id]");
      expect(target?.kind).toBe("booking");
    }
  });

  it("content.event opens /event/[id] with the campaign id for analytics", () => {
    const target = pushNavigationTarget({
      event: "content.event",
      campaign_id: "c-1",
      event_id: "e-1",
      restaurant_id: "r-1",
    });
    expect(target).toEqual({
      pathname: "/event/[id]",
      params: { id: "e-1" },
      kind: "event",
      campaignId: "c-1",
    });
  });

  it("content.promo opens /promotion/[id] with the campaign id for analytics", () => {
    const target = pushNavigationTarget({
      event: "content.promo",
      campaign_id: "c-2",
      promo_id: "p-1",
    });
    expect(target).toEqual({
      pathname: "/promotion/[id]",
      params: { id: "p-1" },
      kind: "promo",
      campaignId: "c-2",
    });
  });

  it("content.event without an event_id opens nothing", () => {
    expect(pushNavigationTarget({ event: "content.event", campaign_id: "c-1" })).toBeNull();
  });

  it("content.promo without a promo_id opens nothing", () => {
    expect(pushNavigationTarget({ event: "content.promo", campaign_id: "c-1" })).toBeNull();
  });

  it("booking.* without a booking_id opens nothing", () => {
    expect(pushNavigationTarget({ event: "booking.confirmed" })).toBeNull();
  });

  it("an unknown event opens nothing — a newer backend than this build", () => {
    expect(
      pushNavigationTarget({ event: "content.new_venue", campaign_id: "c-3", venue_id: "v-1" }),
    ).toBeNull();
  });

  it("no event field, or a non-object payload, opens nothing", () => {
    expect(pushNavigationTarget({ booking_id: "b-1" })).toBeNull();
    expect(pushNavigationTarget({ event: undefined, booking_id: "b-1" })).toBeNull();
    expect(pushNavigationTarget(null)).toBeNull();
    expect(pushNavigationTarget(undefined)).toBeNull();
    expect(pushNavigationTarget("content.event")).toBeNull();
    expect(pushNavigationTarget([])).toBeNull();
  });

  it("a number where a string belongs is not assumed — the payload survives a JSON round trip", () => {
    expect(pushNavigationTarget({ event: "booking.confirmed", booking_id: 42 })).toBeNull();
  });

  it("blank string fields count as absent", () => {
    expect(pushNavigationTarget({ event: "content.event", event_id: "   " })).toBeNull();
    expect(pushNavigationTarget({ event: "booking.confirmed", booking_id: "" })).toBeNull();
  });
});
