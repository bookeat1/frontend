import { describe, expect, it } from "vitest";
import { ANDROID_NOTIFICATION_CHANNELS } from "../android-notification-channels";

/**
 * push-campaigns spec, §4 criterion 33: the "offers" channel exists ALONGSIDE
 * "bookings", not instead of it, with its own name so a guest can find and
 * mute it in the system channel settings independently.
 *
 * What this does NOT verify: that `Notifications.setNotificationChannelAsync`
 * actually succeeds on a real device (push.tsx calls it; untestable without
 * one — see bugs/bookeat-android-push-devicenotregistered).
 */
describe("ANDROID_NOTIFICATION_CHANNELS", () => {
  it("declares both bookings and offers, with distinct ids", () => {
    const ids = ANDROID_NOTIFICATION_CHANNELS.map((c) => c.id);
    expect(ids).toContain("bookings");
    expect(ids).toContain("offers");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names the offers channel «Акции и события»", () => {
    const offers = ANDROID_NOTIFICATION_CHANNELS.find((c) => c.id === "offers");
    expect(offers?.name).toBe("Акции и события");
  });
});
