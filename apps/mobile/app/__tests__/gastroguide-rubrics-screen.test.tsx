import type { GuideCategory, GuideCollection, RestaurantRepository } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GuideRubricsScreen from "../gastroguide/rubrics";

/**
 * ЭКРАН «ВСЕ РУБРИКИ» (`/gastroguide/rubrics`, правка владельца 28.08.2026
 * «лучше столбиком»). Проверяем то, что ломается тихо:
 *
 *   1. список берётся из СПРАВОЧНИКА рубрик (`GET /gastroguide/categories`), а
 *      не из ленты подборок: рубрика, у которой ещё нет ни одной подборки, в
 *      ленте на корне вкладки не показывается — и обязана показаться здесь;
 *   2. плитка ведёт на экран рубрики по ЕЁ СОБСТВЕННОМУ слагу (а не по слагу
 *      подборки, из которой лента строит свои плитки);
 *   3. плитки — тот же компонент, что в ленте, а не копия вёрстки;
 *   4. отказ ленты ПОДБОРОК не рушит экран: без него у плиток нет фотографий,
 *      но названия рубрик — то, ради чего сюда пришли.
 */

const t = getDictionary("ru");

const push = vi.fn();
const back = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back, replace: vi.fn(), canGoBack: () => true }),
  usePathname: () => "/gastroguide/rubrics",
}));

vi.mock("../../src/lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

// Градиент-затемнение плитки — нативный модуль; на структуру, которую держит
// этот файл, он не влияет.
vi.mock("expo-linear-gradient", () => ({ LinearGradient: () => null }));

const getGuideCategories = vi.fn<() => Promise<GuideCategory[]>>();
const getGuideCollections = vi.fn<() => Promise<GuideCollection[]>>();

vi.mock("../../src/lib/repository", () => ({
  useRepository: () =>
    ({ getGuideCategories, getGuideCollections }) as unknown as RestaurantRepository,
}));

const CATEGORIES: GuideCategory[] = [
  { slug: "kazakh-cuisine", title: "Казахская кухня", position: 1 },
  { slug: "coffee", title: "Кофейная культура", position: 2 },
  // У этой рубрики нет ни одной подборки — в ленте на корне вкладки её нет.
  { slug: "mountains", title: "Горы и гастрономия", position: 3 },
];

const COLLECTIONS: GuideCollection[] = [
  {
    slug: "steppe-tastes",
    kind: "collection",
    title: "Вкусы степи",
    subtitle: "",
    description: "Аутентичные вкусы степи.",
    coverImageUrl: "https://cdn.example/steppe.jpg",
    venueCount: 2,
    categorySlugs: ["kazakh-cuisine"],
  },
];

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GuideRubricsScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getGuideCategories.mockResolvedValue(CATEGORIES);
  getGuideCollections.mockResolvedValue(COLLECTIONS);
});

describe("экран «Все рубрики»", () => {
  it("показывает ВСЕ рубрики справочника, включая те, у которых нет подборок", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByText("Казахская кухня")).toBeTruthy());
    expect(screen.getByText("Кофейная культура")).toBeTruthy();
    // Ради этой строки экран и берёт справочник, а не ленту подборок.
    expect(screen.getByText("Горы и гастрономия")).toBeTruthy();
  });

  it("ведёт плиткой на экран рубрики по её собственному слагу", async () => {
    const person = userEvent.setup();
    renderScreen();

    const tile = await screen.findByRole("button", {
      name: t.articles.openRubric("Горы и гастрономия"),
    });
    await person.click(tile);

    expect(push).toHaveBeenCalledWith("/gastroguide/rubric/mountains");
  });

  it("рисует плитки тем же компонентом, что и лента на корне вкладки", async () => {
    // Не «похожая вёрстка», а буквально тот же файл: разойтись двум копиям
    // куда проще, чем одному компоненту.
    const source = GuideRubricsScreen.toString();
    expect(source).toContain("GuideRubricTile");

    const { GuideRubricTile } = await import(
      "../../src/components/articles/GuideRubricRail"
    );
    expect(GuideRubricTile).toBeTypeOf("function");
  });

  it("заголовок экрана — тот же «Рубрики», что у ленты, и есть стрелка назад", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByText(t.articles.rubricsTitle)).toBeTruthy());
    expect(screen.getByRole("button", { name: t.a11y.backButton })).toBeTruthy();
  });

  it("переживает отказ ленты подборок: рубрики на месте", async () => {
    getGuideCollections.mockRejectedValue(new Error("нет сети"));
    renderScreen();

    await waitFor(() => expect(screen.getByText("Казахская кухня")).toBeTruthy());
  });

  it("пустой справочник — честное «рубрик пока нет», а не ошибка", async () => {
    getGuideCategories.mockResolvedValue([]);
    renderScreen();

    await waitFor(() => expect(screen.getByText(t.articles.rubricsAllEmptyTitle)).toBeTruthy());
  });
});
