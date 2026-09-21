import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __store as secureStoreMemory } from "../../../../../test/stubs/expo-secure-store";

/**
 * «Приложение уже установлено» для канал-метки `source` (21.09.2026,
 * критерий 3, `specs/marathon-qr-attribution-20260921.md`) — the home-screen
 * mirror of `promotion-detail-attribution.test.tsx`'s coverage for `promo`.
 * `app/+native-intent.tsx` now routes a tap on a `{"source":"tshirt"}`/
 * `{"source":"box"}` Detour link straight to `/?source=<tag>` — this hook is
 * what actually persists it, since `mapDetourResolvedUrlToRoute` is a plain
 * function, not a component.
 */

let searchParams: Record<string, string | string[] | undefined> = {};

vi.mock("expo-router", () => ({
  useLocalSearchParams: () => searchParams,
}));

const { useHomeSourceAttribution } = await import("../useHomeSourceAttribution");
const { CAMPAIGN_ATTRIBUTION_KEY } = await import("../../lib/campaign-attribution");

beforeEach(() => {
  secureStoreMemory.clear();
  searchParams = {};
});

describe("useHomeSourceAttribution", () => {
  it("пишет валидный source в то же хранилище, что и остальные пути атрибуции", async () => {
    searchParams = { source: "tshirt" };
    renderHook(() => useHomeSourceAttribution());
    await Promise.resolve();
    await Promise.resolve();

    const stored = secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toMatchObject({ source: "tshirt" });
  });

  it("невалидный формат source — не пишет (критерий 5)", async () => {
    searchParams = { source: "футболка не по формату" };
    renderHook(() => useHomeSourceAttribution());
    await Promise.resolve();
    await Promise.resolve();

    expect(secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY)).toBeUndefined();
  });

  it("нет source в маршруте — ничего не пишет, не падает (критерий 4)", async () => {
    searchParams = {};
    renderHook(() => useHomeSourceAttribution());
    await Promise.resolve();
    await Promise.resolve();

    expect(secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY)).toBeUndefined();
  });

  it("повторный рендер с тем же source не пишет дважды", async () => {
    searchParams = { source: "box" };
    const { rerender } = renderHook(() => useHomeSourceAttribution());
    await Promise.resolve();
    await Promise.resolve();

    const firstWrite = secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY);
    expect(firstWrite).toBeTruthy();

    rerender();
    await Promise.resolve();
    await Promise.resolve();

    expect(secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY)).toBe(firstWrite);
  });
});
