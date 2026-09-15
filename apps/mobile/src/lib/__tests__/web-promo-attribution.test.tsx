import { render } from "@testing-library/react";
import React from "react";
import { Platform } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __store as secureStoreMemory } from "../../../../../test/stubs/expo-secure-store";

/**
 * `DetourProvider` never mounts on the mobile-web export, so
 * `DetourLinkRouter` never runs there either — a guest opening
 * `book-eat.com/...?promo=<uuid>` in a phone browser had no code path to
 * capture the tag at all (see `bookeat-mobile-web-marathon-promo-id.md`).
 * `WebPromoAttribution` is that path. These tests hold three things:
 *   - a recognized `?promo=` writes to the SAME storage record
 *     `DetourLinkRouter` writes natively (`CAMPAIGN_ATTRIBUTION_KEY`);
 *   - an unrecognized/malformed value is dropped, same as the native path;
 *   - native platforms are entirely unaffected — the call site in
 *     `app/_layout.tsx` gates this component on `Platform.OS === "web"`, but
 *     the component's own effect is exercised here directly to prove it does
 *     not write on non-web platforms either, in case that gate is ever lost.
 */

let searchParams: Record<string, string | string[] | undefined> = {};

vi.mock("expo-router", () => ({
  useGlobalSearchParams: () => searchParams,
}));

const PROMO_UUID = "6a3736b9-d4e5-4ec6-9ed2-7233476184fd";
const UNKNOWN_PROMO_UUID = "00000000-0000-4000-8000-000000000000";

// Same reasoning as detour-link-router.test.tsx: KNOWN_CAMPAIGN_IDS is a
// top-level const read once at module load, so the env var must be stubbed
// before campaign-attribution.ts (even transitively, via
// web-promo-attribution.tsx) is imported for the first time.
vi.stubEnv("EXPO_PUBLIC_MARATHON_PROMO_ID", PROMO_UUID);

const { WebPromoAttribution } = await import("../web-promo-attribution");
const { CAMPAIGN_ATTRIBUTION_KEY } = await import("../campaign-attribution");

function pretendPlatform(os: "ios" | "android" | "web") {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true, writable: true });
}

beforeEach(() => {
  searchParams = {};
  secureStoreMemory.clear();
  pretendPlatform("web");
});

/** The effect's own write is async (`await writeCampaignAttribution`);
 * `render` does not wait for it. */
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("WebPromoAttribution: атрибуция кампании на мобильном вебе", () => {
  it("сохраняет ?promo= известной акции в то же хранилище, что и Detour-путь", async () => {
    searchParams = { promo: PROMO_UUID };

    render(<WebPromoAttribution />);
    await flush();

    const stored = secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toMatchObject({ campaignId: PROMO_UUID });
  });

  it("UUID не из списка известных акций — не пишется", async () => {
    searchParams = { promo: UNKNOWN_PROMO_UUID };

    render(<WebPromoAttribution />);
    await flush();

    expect(secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY)).toBeUndefined();
  });

  it("без ?promo= в адресе — ничего не пишет и не падает", async () => {
    searchParams = { city: "almaty" };

    render(<WebPromoAttribution />);
    await flush();

    expect(secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY)).toBeUndefined();
  });

  it("массив значений параметра (повтор ?promo= в адресе) — берёт первое", async () => {
    searchParams = { promo: [PROMO_UUID, UNKNOWN_PROMO_UUID] };

    render(<WebPromoAttribution />);
    await flush();

    const stored = secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY);
    expect(JSON.parse(stored!)).toMatchObject({ campaignId: PROMO_UUID });
  });

  it("нативная платформа: поведение не меняется — эффект не пишет, даже если компонент случайно смонтирован", async () => {
    // app/_layout.tsx уже не рендерит <WebPromoAttribution /> на native
    // (`{Platform.OS === "web" && <WebPromoAttribution />}`), но компонент
    // держит ту же проверку и внутри своего эффекта — двойной гейт, тот же
    // приём, что у DetourProviderGate. Тест монтирует компонент напрямую
    // (в обход layout-гейта) именно чтобы показать: даже тогда native-путь
    // остаётся исключительно за Detour, второй писатель не появляется.
    pretendPlatform("ios");
    searchParams = { promo: PROMO_UUID };

    render(<WebPromoAttribution />);
    await flush();

    expect(secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY)).toBeUndefined();
  });
});
