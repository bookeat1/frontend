import type { GuideCategory, GuideCollection, RestaurantRepository } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ArticlesScreen from "../articles";

/**
 * Экран гастрогида. Проверяем ровно то, что ломается тихо и что было решено
 * осознанно:
 *
 *   1. Сетка рубрик НЕ рисуется, когда `GET /gastroguide/categories` отдал
 *      пусто — это состояние прода, и плитки-заглушки в нём недопустимы.
 *   2. Рубрика показывается только с подборками за ней и работает отбором.
 *   3. На карточке подборки НЕТ сердечка: избранного для подборок на бэкенде
 *      не существует, а инертное сердечко из этого приложения уже убирали.
 *   4. Стрелка «назад» появляется только когда есть куда возвращаться:
 *      `/articles` — корень вкладки.
 */

const t = getDictionary("ru");

const push = vi.fn();
const back = vi.fn();
let canGoBack = false;

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back, replace: vi.fn(), canGoBack: () => canGoBack }),
  usePathname: () => "/articles",
}));

vi.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

vi.mock("../../src/lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

// Шапка тянет локальный jpg через `require` — Node в тесте пытается РАЗОБРАТЬ
// его как модуль и падает с «Invalid or unexpected token» (проверено: без этой
// подмены валятся все семь тестов). Тот же приём, что у шапки главной, которую
// по той же причине не рендерит ни один тест. Подменяется только кадр: стрелку
// и заголовок рисует настоящий FlowHeader, и проверки шапки остаются честными.
vi.mock("../../src/components/articles/GuideHero", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/components/articles/GuideHero")
  >("../../src/components/articles/GuideHero");
  const { FlowHeader } = await import("../../src/components/FlowHeader");
  return {
    ...actual,
    GuideHero: ({
      title,
      headline,
      onBack,
    }: {
      title: string;
      headline: string;
      onBack?: () => void;
    }) => (
      <div>
        <FlowHeader title={title} onBack={onBack} tone="onDark" />
        <span>{headline}</span>
      </div>
    ),
  };
});

const getGuideCollections = vi.fn<() => Promise<GuideCollection[]>>();
const getGuideCategories = vi.fn<() => Promise<GuideCategory[]>>();

vi.mock("../../src/lib/repository", () => ({
  useRepository: () =>
    ({ getGuideCollections, getGuideCategories }) as unknown as RestaurantRepository,
}));

function collection(slug: string, title: string, categorySlugs: string[]): GuideCollection {
  return {
    slug,
    title,
    subtitle: "",
    description: "Описание подборки",
    coverImageUrl: null,
    venueCount: 2,
    categorySlugs,
  };
}

const COLLECTIONS = [
  collection("etno-almaty", "Этно Алматы", ["etno"]),
  collection("coffee-city", "Кофейный город", ["coffee"]),
];

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ArticlesScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  canGoBack = false;
  getGuideCollections.mockResolvedValue(COLLECTIONS);
  getGuideCategories.mockResolvedValue([]);
});

describe("экран гастрогида", () => {
  it("без рубрик показывает подборки и не рисует ни одной плитки рубрики", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByText("Этно Алматы")).toBeTruthy());
    expect(screen.getByText("Кофейный город")).toBeTruthy();
    expect(screen.queryByLabelText(t.articles.rubricFilter("Этно"))).toBeNull();
  });

  it("рисует только те рубрики, за которыми есть подборки", async () => {
    getGuideCategories.mockResolvedValue([
      { slug: "etno", title: "Этно", position: 1 },
      { slug: "wine", title: "Вино", position: 2 },
    ]);

    renderScreen();

    await waitFor(() =>
      expect(screen.getByLabelText(t.articles.rubricFilter("Этно"))).toBeTruthy(),
    );
    expect(screen.queryByLabelText(t.articles.rubricFilter("Вино"))).toBeNull();
  });

  it("нажатие на рубрику оставляет её подборки, повторное нажатие возвращает все", async () => {
    getGuideCategories.mockResolvedValue([{ slug: "etno", title: "Этно", position: 1 }]);
    const user = userEvent.setup();

    renderScreen();

    const tile = await screen.findByLabelText(t.articles.rubricFilter("Этно"));
    await user.click(tile);

    await waitFor(() => expect(screen.queryByText("Кофейный город")).toBeNull());
    expect(screen.getByText("Этно Алматы")).toBeTruthy();

    await user.click(screen.getByLabelText(t.articles.rubricFilter("Этно")));
    await waitFor(() => expect(screen.getByText("Кофейный город")).toBeTruthy());
  });

  it("на карточке подборки нет сердечка", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByText("Этно Алматы")).toBeTruthy());
    expect(screen.queryByLabelText(t.explore.favoriteAdd("Этно Алматы"))).toBeNull();
    expect(screen.queryByLabelText(t.explore.favoriteRemove("Этно Алматы"))).toBeNull();
  });

  it("на корне вкладки стрелки «назад» нет, а при заходе из другого экрана она есть", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText("Этно Алматы")).toBeTruthy());
    expect(screen.queryByLabelText(t.a11y.backButton)).toBeNull();

    canGoBack = true;
    renderScreen();
    await waitFor(() => expect(screen.getAllByLabelText(t.a11y.backButton).length).toBe(1));
  });

  it("пустой ответ — спокойное пустое состояние, а не ошибка", async () => {
    getGuideCollections.mockResolvedValue([]);

    renderScreen();

    await waitFor(() => expect(screen.getByText(t.articles.emptyTitle)).toBeTruthy());
  });

  it("отказ ручки подборок показывает состояние ошибки с повтором", async () => {
    getGuideCollections.mockRejectedValue(new Error("boom"));

    renderScreen();

    await waitFor(() => expect(screen.getByText(t.states.failedTitle)).toBeTruthy());
  });
});
