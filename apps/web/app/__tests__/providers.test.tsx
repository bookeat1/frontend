import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `deep_link_attributed` не должен теряться из-за порядка монтирования
 * (критерий 9 спеки `web-amplitude-analytics-20260916.md`):
 * `CampaignAttributionCapture` (сосед `AuthProvider`) монтируется и пишет
 * метку в `sessionStorage` РАНЬШЕ, чем эффект `AnalyticsProvider` (стоит
 * внутри `AuthProvider`) успевает включить `isEnabled()`. Тест собирает
 * `Providers` целиком — то самое дерево из `app/layout.tsx` — с реальным
 * ключом в окружении и проверяет, что событие всё-таки уходит.
 */

const track = vi.fn();
const init = vi.fn();

vi.mock("@amplitude/analytics-browser", () => ({
  init: (...args: unknown[]) => init(...args),
  add: vi.fn(),
  track: (...args: unknown[]) => track(...args),
  reset: vi.fn(),
  setUserId: vi.fn(),
  identify: vi.fn(),
  Identify: class {
    set() {
      return this;
    }
  },
}));

vi.mock("@web/lib/api", () => ({
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
  authRepository: {
    getMe: () => Promise.reject(new Error("не вошёл")),
    refresh: () => Promise.reject(new Error("не нужен")),
  },
  repository: {
    getCities: () => Promise.resolve(["Астана", "Алматы"]),
  },
}));

const PROMO = "6a3736b9-d4e5-4ec6-9ed2-7233476184fd";

async function importProviders() {
  vi.resetModules();
  process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY = "test-key";
  process.env.NEXT_PUBLIC_MARATHON_PROMO_ID = PROMO;
  const mod = await import("../providers");
  return mod.Providers;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  delete process.env.NEXT_PUBLIC_MARATHON_PROMO_ID;
});

describe("Providers — deep_link_attributed переживает порядок монтирования", () => {
  it("заход с ?promo= — событие уходит после initAnalytics(), а не теряется", async () => {
    window.history.pushState({}, "", `/?promo=${PROMO}`);
    const Providers = await importProviders();

    render(
      <Providers>
        <div>содержимое</div>
      </Providers>,
    );

    await waitFor(() => expect(init).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith("deep_link_attributed", {
        campaign_id: PROMO,
        link_type: "web_query",
      }),
    );
  });

  it("заход без параметра — deep_link_attributed не уходит", async () => {
    window.history.pushState({}, "", "/");
    const Providers = await importProviders();

    render(
      <Providers>
        <div>содержимое</div>
      </Providers>,
    );

    await waitFor(() => expect(init).toHaveBeenCalledTimes(1));
    expect(track).not.toHaveBeenCalledWith("deep_link_attributed", expect.anything());
  });

  it("неизвестный UUID в ?promo= — событие не уходит", async () => {
    window.history.pushState({}, "", "/?promo=00000000-0000-4000-8000-000000000000");
    const Providers = await importProviders();

    render(
      <Providers>
        <div>содержимое</div>
      </Providers>,
    );

    await waitFor(() => expect(init).toHaveBeenCalledTimes(1));
    expect(track).not.toHaveBeenCalledWith("deep_link_attributed", expect.anything());
  });
});
