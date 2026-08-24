import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import HomeScreen from "../index";
import { EXPLORE_DEFAULT_GUESTS } from "../../src/components/explore/use-explore-data";
import { toDateKey } from "../../src/lib/format";

/**
 * Главная: половины капсулы «сегодня · 2 гостя» ведут в каталог ПО-РАЗНОМУ.
 *
 * Обе по-прежнему открывают `/search` и приносят туда выбор (дата + гости —
 * только парой, сервер игнорирует одно без другого), но теперь ещё и говорят,
 * какой фильтр там раскрыть: `focus=date` или `focus=guests`. Экран поиска на
 * этот параметр отвечает в `search-filter-focus.test.tsx`.
 *
 * Шапку приходится подменять: она тянет локальный jpg через `require`, а Node
 * в тесте пытается РАЗОБРАТЬ его как модуль (та же причина, по которой шапку
 * не рендерит ни один другой тест). Подмена оставляет ровно то, что здесь
 * проверяется, — какие колбэки главная вешает на какую половину.
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
    onOpenDate,
    onOpenGuests,
  }: {
    onOpenDate: () => void;
    onOpenGuests: () => void;
  }) => (
    <div>
      <button type="button" onClick={onOpenDate}>
        половина «дата»
      </button>
      <button type="button" onClick={onOpenGuests}>
        половина «гости»
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

describe("капсула главной говорит поиску, какой фильтр раскрыть", () => {
  it("тап по дате несёт focus=date и сам выбор", async () => {
    renderHome();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "половина «дата»" }));

    expect(push).toHaveBeenCalledWith({
      pathname: "/search",
      params: {
        guests: String(EXPLORE_DEFAULT_GUESTS),
        date: toDateKey(new Date()),
        focus: "date",
      },
    });
  });

  it("тап по гостям несёт focus=guests", async () => {
    renderHome();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "половина «гости»" }));

    expect(push).toHaveBeenCalledWith({
      pathname: "/search",
      params: {
        guests: String(EXPLORE_DEFAULT_GUESTS),
        date: toDateKey(new Date()),
        focus: "guests",
      },
    });
  });
});
