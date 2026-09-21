import { describe, expect, it } from "vitest";
import { describePushSupport, devicePlatformFor } from "../push-support";

/**
 * WHAT BREAKS FOR THE GUEST IF THIS FILE GOES RED.
 *
 * An error, a spinner or an empty card on a build where push physically
 * cannot work. Expo Go on Android has had no push since SDK 53, a simulator
 * gets no APNs token, the web build has no Expo token at all, and this
 * project has no EAS id yet. Every one of those is "quietly no", never
 * "something went wrong".
 *
 * Routing a tapped notification to the right screen is `push-routing.ts`'s
 * own concern — see `__tests__/push-routing.test.ts`.
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
