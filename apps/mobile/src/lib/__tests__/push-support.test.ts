import { describe, expect, it } from "vitest";
import { pushNavigationTarget } from "../push-routing";
import { describePushSupport, devicePlatformFor } from "../push-support";

/**
 * WHAT BREAKS FOR THE GUEST IF THIS FILE GOES RED.
 *
 * Two things a guest must never see, both decided here:
 *
 *  - an error, a spinner or an empty card on a build where push physically
 *    cannot work. Expo Go on Android has had no push since SDK 53, a simulator
 *    gets no APNs token, the web build has no Expo token at all, and this
 *    project has no EAS id yet. Every one of those is "quietly no", never
 *    "something went wrong";
 *  - a tapped notification that opens the wrong screen — or opens the home
 *    screen and pretends that was the point. A payload that does not name a
 *    booking opens nothing.
 */

describe("where push can and cannot work", () => {
  const ok = { os: "ios", isDevice: true, isExpoGo: false, projectId: "p-1" };

  it("works on a real phone in a build with an EAS project", () => {
    expect(describePushSupport(ok)).toEqual({ supported: true, projectId: "p-1" });
    expect(describePushSupport({ ...ok, os: "android" })).toEqual({
      supported: true,
      projectId: "p-1",
    });
  });

  it("is off on web", () => {
    expect(describePushSupport({ ...ok, os: "web" })).toEqual({
      supported: false,
      reason: "web",
    });
  });

  it("is off on a simulator", () => {
    expect(describePushSupport({ ...ok, isDevice: false })).toEqual({
      supported: false,
      reason: "simulator",
    });
  });

  it("is off in Expo Go on Android but stays on in Expo Go on iOS", () => {
    expect(describePushSupport({ ...ok, os: "android", isExpoGo: true })).toEqual({
      supported: false,
      reason: "expo-go-android",
    });
    // The SDK 53 removal is Android-only; the iOS client still mints tokens,
    // and turning it off there would cost the only way to try this by hand
    // without a development build.
    expect(describePushSupport({ ...ok, os: "ios", isExpoGo: true })).toEqual({
      supported: true,
      projectId: "p-1",
    });
  });

  it("is off without an EAS project id, including a blank one", () => {
    expect(describePushSupport({ ...ok, projectId: undefined })).toEqual({
      supported: false,
      reason: "no-project-id",
    });
    expect(describePushSupport({ ...ok, projectId: "   " })).toEqual({
      supported: false,
      reason: "no-project-id",
    });
  });

  it("reports the reason a developer must fix FIRST when several apply", () => {
    // Web AND no project id AND a simulator: "web" is the outer truth, and a
    // developer chasing "no-project-id" on a web build would be chasing the
    // wrong thing.
    expect(
      describePushSupport({ os: "web", isDevice: false, isExpoGo: true, projectId: undefined }),
    ).toEqual({ supported: false, reason: "web" });
  });

  it("maps the runtime to the platform value the backend accepts", () => {
    expect(devicePlatformFor("ios")).toBe("ios");
    expect(devicePlatformFor("android")).toBe("android");
    expect(devicePlatformFor("web")).toBeUndefined();
    expect(devicePlatformFor("windows")).toBeUndefined();
  });
});

describe("where a tapped notification takes the guest", () => {
  /** Exactly what guestpush.go's buildGuestMessage puts in `Data`. */
  const payload = {
    event: "booking.confirmed",
    booking_id: "8f6c1f42-1e4a-4a3a-9f2e-1a2b3c4d5e6f",
    restaurant_id: "0f0c1f42-1e4a-4a3a-9f2e-1a2b3c4d5e6f",
    starts_at: "2026-07-28T19:00:00+05:00",
  };

  it("opens the booking the notification is about", () => {
    expect(pushNavigationTarget(payload)).toEqual({
      pathname: "/booking/[id]",
      params: { id: "8f6c1f42-1e4a-4a3a-9f2e-1a2b3c4d5e6f" },
    });
  });

  it("does the same for all three events the backend sends", () => {
    for (const event of ["booking.confirmed", "booking.cancelled", "booking.reminder"]) {
      expect(pushNavigationTarget({ ...payload, event })).not.toBeNull();
    }
  });

  it("opens nothing when the payload names no booking", () => {
    expect(pushNavigationTarget({ ...payload, booking_id: "" })).toBeNull();
    expect(pushNavigationTarget({ ...payload, booking_id: "   " })).toBeNull();
    expect(pushNavigationTarget({ event: "booking.confirmed" })).toBeNull();
    // A number where a string belongs: the payload survives a JSON round trip
    // on the way through the OS, so nothing about the runtime type is assumed.
    expect(pushNavigationTarget({ ...payload, booking_id: 42 })).toBeNull();
  });

  it("opens nothing for an event this build does not know", () => {
    // A newer backend sending a fourth event type must not be guessed at.
    expect(pushNavigationTarget({ ...payload, event: "booking.completed" })).toBeNull();
    expect(pushNavigationTarget({ ...payload, event: undefined })).toBeNull();
  });

  it("survives junk instead of a payload", () => {
    expect(pushNavigationTarget(undefined)).toBeNull();
    expect(pushNavigationTarget(null)).toBeNull();
    expect(pushNavigationTarget("booking.confirmed")).toBeNull();
    expect(pushNavigationTarget([])).toBeNull();
  });
});
