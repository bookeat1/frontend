import type {
  Cuisine,
  EventPage,
  GuideCollection,
  HomePromo,
  RestaurantSummary,
} from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ЧТО ЭТОТ ФАЙЛ ДЕРЖИТ: раздел «Статьи» на главной НЕ ведёт в гастрогид.
 *
 * Это ровно тот баг, который увидел владелец (2026-08-28): и «Смотреть все», и
 * тап по карточке приземлялись на экран гастрогида, потому что `/articles` был
 * его корнем, а сам раздел кормился ручкой подборок. Теперь у статей своя
 * ручка и свои адреса, а гастрогид живёт по `/gastroguide`.
 *
 * ВТОРАЯ ПОЛОВИНА ДОКАЗАТЕЛЬСТВА ЛЕЖИТ В articles-entity-separation.test.tsx:
 * там модуль маршрута `app/articles.tsx` рендерится напрямую и проверяется,
 * что он ходит в `GET /articles`. Вместе это и есть «адрес `/articles` ведёт в
 * статьи», которое одним тестом с подменённым роутером не выразить.
 *
 * Утверждения намеренно ДВУСТОРОННИЕ: мало проверить, куда переход пошёл, —
 * проверяется ещё и то, что он НЕ пошёл ни на один адрес гастрогида. Иначе
 * регрессия «снова открывает гастрогид» пройдёт мимо теста, если однажды
 * экран начнёт слать два перехода.
 */

const t = getDictionary("ru");

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

// Шапка главной тянет локальный jpg через `require` — Node в тесте пытается
// разобрать его как модуль и падает. К проверяемым переходам она отношения не
// имеет (тот же приём, что в home-pull-to-refresh.test.tsx).
vi.mock("../../src/components/explore/HomeHeader", () => ({
  HomeHeader: () => null,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-out", repository: { getMe: vi.fn(), updateMe: vi.fn() } }),
}));

vi.mock("../../src/lib/locale", async () => {
  const { getDictionary: dictionary } = await import("@bookeat/i18n");
  return {
    useLocale: () => ({ locale: "ru", dictionary: dictionary("ru"), setLocale: vi.fn() }),
  };
});

const listArticles = vi.fn<() => Promise<GuideCollection[]>>();
const getGuideCollections = vi.fn<() => Promise<GuideCollection[]>>();

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({
    getRecommendedRestaurants: vi.fn<() => Promise<RestaurantSummary[]>>(async () => []),
    getCatalogPreview: vi.fn<() => Promise<RestaurantSummary[]>>(async () => []),
    getCuisines: vi.fn<() => Promise<Cuisine[]>>(async () => []),
    listUpcomingEvents: vi.fn<() => Promise<EventPage>>(async () => ({
      items: [],
      total: 0,
      page: 1,
      pages: 1,
      perPage: 12,
    })),
    getPromotions: vi.fn<() => Promise<HomePromo[]>>(async () => []),
    listArticles,
    getGuideCollections,
  }),
}));

const HomeScreen = (await import("../index")).default;

const ARTICLE: GuideCollection = {
  slug: "almaty-longread",
  kind: "article",
  title: "Сейчас Алматы ест невероятно хорошо",
  subtitle: "",
  description: "Редакционный лонгрид",
  coverImageUrl: "https://cdn.example/cover.jpg",
  venueCount: 3,
  categorySlugs: [],
};

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <HomeScreen />
    </QueryClientProvider>,
  );
}

/** Ни один переход не ушёл в гастрогид — ни на корень вкладки, ни на подборку,
 * ни на рубрику. */
function expectNoGastroguideNavigation() {
  const targets = push.mock.calls.map(([route]) => String(route));
  expect(targets.filter((route) => route.startsWith("/gastroguide"))).toEqual([]);
}

beforeEach(() => {
  push.mockClear();
  listArticles.mockReset().mockResolvedValue([ARTICLE]);
  getGuideCollections.mockReset().mockResolvedValue([]);
});

describe("раздел «Статьи» на главной", () => {
  it("«Смотреть все» открывает список статей, а не гастрогид", async () => {
    const person = userEvent.setup();

    renderHome();

    const seeAll = await screen.findByLabelText(t.explore.sectionSeeAll(t.explore.articlesTitle));
    await person.click(seeAll);

    expect(push).toHaveBeenCalledWith("/articles");
    expectNoGastroguideNavigation();
  });

  it("тап по карточке открывает саму статью, а не подборку гастрогида", async () => {
    const person = userEvent.setup();

    renderHome();

    const card = await screen.findByLabelText(
      t.articles.card(ARTICLE.title, t.explore.articleAuthorDefault),
    );
    await person.click(card);

    expect(push).toHaveBeenCalledWith("/articles/almaty-longread");
    expectNoGastroguideNavigation();
  });

  it("раздел кормится ручкой статей, а подборки гастрогида на главную не ходят", async () => {
    renderHome();

    expect(await screen.findByText(ARTICLE.title)).toBeTruthy();
    expect(listArticles).toHaveBeenCalled();
    expect(getGuideCollections).not.toHaveBeenCalled();
  });
});
