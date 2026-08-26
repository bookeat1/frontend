import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import HomeScreen from "../index";

/**
 * Главная: что она делает с ГОТОВЫМ выбором из шторки.
 *
 * Сам выбор (тап по половине капсулы → нижняя шторка с колесом → «Готово»)
 * проверяется на живом компоненте в
 * `src/components/__tests__/home-party-selector.test.tsx`; шапку здесь
 * приходится подменять, потому что она тянет вшитый jpg через `require`, а
 * Node в тесте пытается РАЗОБРАТЬ его как модуль.
 *
 * Здесь проверяется остаток цепочки: экран уносит пару «дата + гости» в
 * каталог И НЕ ПРОСИТ раскрыть там шторку фильтров. Параметр `focus`, который
 * это делал (24.08), убран 26.08 по правке владельца: панель фильтров
 * нагружена, и встречать ею человека, который назвал всего лишь день, — значит
 * пугать его на первом же шаге. Ответ экрана поиска на такие параметры —
 * `search-filter-panel-closed.test.tsx`.
 */

const push = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn(), canGoBack: () => false }),
  usePathname: () => "/",
}));

vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/components/explore/HomeHeader", () => ({
  HomeHeader: ({
    onSearchParty,
  }: {
    onSearchParty: (party: { date: string; guests: number }) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onSearchParty({ date: "2026-09-04", guests: 5 })}
      >
        выбор сделан
      </button>
    </div>
  ),
}));

// Ленты главной ходят каждая за своими данными и к этой проверке отношения не
// имеют; сама их отрисовка покрыта отдельно.
vi.mock("../../src/components/explore/RecommendedSection", () => ({
  RecommendedSection: () => null,
}));
vi.mock("../../src/components/explore/CuisineSection", () => ({ CuisineSection: () => null }));
vi.mock("../../src/components/explore/PromotionsSection", () => ({
  PromotionsSection: () => null,
}));
vi.mock("../../src/components/explore/EventsListSection", () => ({
  EventsListSection: () => null,
}));
vi.mock("../../src/components/explore/ArticlesSection", () => ({ ArticlesSection: () => null }));

vi.mock("../../src/lib/locale", async () => {
  const { getDictionary } = await import("@bookeat/i18n");
  return { useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }) };
});

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-out", repository: {} }),
}));

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <HomeScreen />
    </QueryClientProvider>,
  );
}

describe("главная уносит готовый выбор в каталог", () => {
  it("несёт в /search именно то, что выбрали в шторке", async () => {
    renderHome();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "выбор сделан" }));

    expect(push).toHaveBeenCalledWith({
      pathname: "/search",
      params: { guests: "5", date: "2026-09-04" },
    });
  });

  it("не просит каталог раскрывать шторку фильтров", async () => {
    renderHome();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "выбор сделан" }));

    const [target] = push.mock.calls[0] as [{ params: Record<string, string> }];
    expect(Object.keys(target.params)).not.toContain("focus");
  });
});
