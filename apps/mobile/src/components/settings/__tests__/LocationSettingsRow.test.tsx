import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Строка «Геопозиция» в настройках (спека geolocation-permission.md, критерий 15).
 */

vi.mock("../../../lib/geo/location-native", () => ({
  hasLocationModule: () => false,
  importLocation: () => Promise.reject(new Error("not used")),
}));

const openSettings = vi.fn(async () => {});
vi.mock("react-native", async () => {
  const actual = (await vi.importActual("react-native-web")) as { Linking: object };
  return { ...actual, Linking: { ...actual.Linking, openSettings } };
});

vi.mock("../../../lib/locale", async () => {
  const { getDictionary } = await import("@bookeat/i18n");
  return { useLocale: () => ({ locale: "ru", dictionary: getDictionary(), setLocale: vi.fn() }) };
});

const trackEvent = vi.fn();
vi.mock("../../../lib/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

const { makeLocation, locationWrapper } = await import("../../../lib/geo/__tests__/fake-location");
const { LocationSettingsRow } = await import("../LocationSettingsRow");
const { getDictionary } = await import("@bookeat/i18n");
const t = getDictionary();

function renderRow(loc: ReturnType<typeof makeLocation>) {
  const Wrapper = locationWrapper({ current: loc });
  return render(
    <Wrapper>
      <LocationSettingsRow />
    </Wrapper>,
  );
}

beforeEach(() => {
  openSettings.mockClear();
  trackEvent.mockClear();
});

describe("LocationSettingsRow", () => {
  it.each(["pending", "unsupported"] as const)("статус %s: строки нет", (permission) => {
    const { container } = renderRow(makeLocation({ permission }));
    expect(container.textContent).toBe("");
  });

  it("undetermined: подсказка, тап вызывает системный диалог", async () => {
    const loc = makeLocation({ permission: "undetermined" });
    renderRow(loc);
    expect(screen.getByText(t.location.settingsHintUndetermined)).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(loc.request).toHaveBeenCalledTimes(1));
    expect(openSettings).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith("location_prompt_shown", { surface: "mobile_settings" });
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith("location_permission_result", {
        surface: "mobile_settings",
        result: "denied",
        precise: null,
      }),
    );
  });

  it("granted: «Включена», тап открывает настройки телефона", () => {
    const loc = makeLocation({ permission: "granted" });
    renderRow(loc);
    expect(screen.getByText(t.location.settingsOn)).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(loc.request).not.toHaveBeenCalled();
  });

  it("denied без canAskAgain: «Выключена…», тап в настройки, request не зовётся", () => {
    const loc = makeLocation({ permission: "denied", canAskAgain: false });
    renderRow(loc);
    expect(screen.getByText(t.location.settingsOff)).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(loc.request).not.toHaveBeenCalled();
  });

  it("granted, но геолокация на телефоне выключена: своя подсказка", () => {
    renderRow(makeLocation({ permission: "granted", servicesOff: true }));
    expect(screen.getByText(t.location.settingsServicesOff)).toBeTruthy();
  });
});
