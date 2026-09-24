import { beforeEach, describe, expect, it, vi } from "vitest";

const openURL = vi.fn(async (_url: string) => undefined);
vi.mock("react-native", () => ({
  Linking: { openURL: (url: string) => openURL(url), openSettings: vi.fn() },
  Platform: { OS: "ios" },
}));

const openBrowserAsync = vi.fn(async (_url: string) => ({ type: "dismiss" }));
let moduleMissing = false;
vi.mock("expo-web-browser", () => {
  return {
    get openBrowserAsync() {
      if (moduleMissing) throw new Error("Cannot find native module 'ExpoWebBrowser'");
      return openBrowserAsync;
    },
  };
});

import { openInAppBrowser } from "../external-links";

beforeEach(() => {
  openURL.mockClear();
  openBrowserAsync.mockClear();
  moduleMissing = false;
});

describe("openInAppBrowser", () => {
  it("shows the page in the in-app browser", async () => {
    await expect(openInAppBrowser("https://pay.example/1")).resolves.toBe("in-app");
    expect(openBrowserAsync).toHaveBeenCalledWith("https://pay.example/1");
    expect(openURL).not.toHaveBeenCalled();
  });

  it("falls back to the external browser when the native module is missing", async () => {
    moduleMissing = true;
    await expect(openInAppBrowser("https://pay.example/1")).resolves.toBe("external");
    expect(openURL).toHaveBeenCalledWith("https://pay.example/1");
  });

  it("reports failure when nothing can open the link", async () => {
    moduleMissing = true;
    openURL.mockRejectedValueOnce(new Error("no browser"));
    await expect(openInAppBrowser("https://pay.example/1")).resolves.toBe("failed");
  });
});
