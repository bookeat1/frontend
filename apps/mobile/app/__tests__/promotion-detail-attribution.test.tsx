import type { HomePromo, RestaurantRepository } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __store as secureStoreMemory } from "../../../../test/stubs/expo-secure-store";

/**
 * "App already installed" mirror of `web-promo-attribution.test.tsx` — see
 * `specs/marathon-qr-promo-20260906.md` R3.1 item 5.
 *
 * `app/+native-intent.tsx` (`detour-native-intent-route.ts`) now routes an
 * already-installed guest's tap on the Almaty Marathon Detour link straight
 * to `/promotion/<id>?promo=<id>`, bypassing `DetourLinkRouter` entirely
 * (that component only fires on the deferred, first-install path). Before
 * this fix nothing on this landing screen read `?promo=` at all, so a guest
 * who already had the app lost the campaign tag outright. These tests hold:
 *   - a recognized `?promo=` writes to the SAME storage record the deferred
 *     path and mobile-web both write to (`CAMPAIGN_ATTRIBUTION_KEY`);
 *   - an unrecognized UUID is dropped, same as the other two paths;
 *   - no `promo` param in the route — nothing is written, no crash.
 */

let searchParams: Record<string, string | string[] | undefined> = { id: "p-1" };

const push = vi.fn();
const back = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back, replace: vi.fn(), canGoBack: () => true }),
  usePathname: () => "/promotion/p-1",
  useLocalSearchParams: () => searchParams,
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("expo-linear-gradient", () => ({ LinearGradient: () => null }));

vi.mock("../../src/lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-out", repository: { getMe: vi.fn(), updateMe: vi.fn() } }),
}));

vi.mock("../../src/hooks/useFavorites", () => ({
  usePromoFavorite: () => ({ isFavorite: false, failed: false, toggle: vi.fn() }),
}));

vi.mock("../../src/hooks/useRestaurant", () => ({
  useRestaurant: () => ({ data: undefined }),
}));

const getPromotions = vi.fn<() => Promise<HomePromo[]>>();

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getPromotions }) as unknown as RestaurantRepository,
}));

const PROMO_UUID = "6a3736b9-d4e5-4ec6-9ed2-7233476184fd";
const UNKNOWN_PROMO_UUID = "00000000-0000-4000-8000-000000000000";

// Same reasoning as web-promo-attribution.test.tsx: KNOWN_CAMPAIGN_IDS is a
// top-level const read once at module load, so the env var must be stubbed
// before campaign-attribution.ts (even transitively) is imported.
vi.stubEnv("EXPO_PUBLIC_MARATHON_PROMO_ID", PROMO_UUID);

const { default: PromotionDetailScreen } = await import("../promotion/[id]");
const { CAMPAIGN_ATTRIBUTION_KEY } = await import("../../src/lib/campaign-attribution");

const PROMO: HomePromo = {
  id: "p-1",
  restaurantId: "r-1",
  restaurantName: "Del Papa",
  title: "Двойная пицца",
  description: "Вторая пицца в подарок каждую среду.",
  startsAt: "2026-09-01T00:00:00Z",
  endsAt: "2026-09-30T00:00:00Z",
  coverImageUrl: "https://cdn.example/promo.jpg",
  images: ["https://cdn.example/promo-2.jpg"],
  discountPercent: 20,
};

function renderScreen() {
  getPromotions.mockResolvedValue([PROMO]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PromotionDetailScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  secureStoreMemory.clear();
  searchParams = { id: "p-1" };
});

describe("карточка акции: атрибуция «приложение уже установлено»", () => {
  it("?promo=<известный UUID> в маршруте — пишет ту же метку, что и deferred-путь/веб", async () => {
    searchParams = { id: "p-1", promo: PROMO_UUID };
    renderScreen();

    await waitFor(() => expect(screen.getByText(PROMO.title)).toBeTruthy());
    await waitFor(() => expect(secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY)).toBeTruthy());

    const stored = secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY);
    expect(JSON.parse(stored!)).toMatchObject({ campaignId: PROMO_UUID });
  });

  it("UUID не из списка известных акций — не пишется", async () => {
    searchParams = { id: "p-1", promo: UNKNOWN_PROMO_UUID };
    renderScreen();

    await waitFor(() => expect(screen.getByText(PROMO.title)).toBeTruthy());
    expect(secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY)).toBeUndefined();
  });

  it("без ?promo= в маршруте — ничего не пишет и не падает", async () => {
    searchParams = { id: "p-1" };
    renderScreen();

    await waitFor(() => expect(screen.getByText(PROMO.title)).toBeTruthy());
    expect(secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY)).toBeUndefined();
  });
});
