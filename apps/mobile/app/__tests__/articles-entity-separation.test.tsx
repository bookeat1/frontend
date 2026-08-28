import type {
  GuideCollection,
  GuideRoute,
  RestaurantRepository,
} from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ЧТО ЭТОТ ФАЙЛ ДЕРЖИТ: «Статьи и рубрики гастрогида — РАЗНЫЕ сущности»
 * (решение владельца, 2026-08-28).
 *
 * До разделения экран гастрогида и раздел «Статьи» кормились одной ручкой
 * `GET /gastroguide/collections`, поэтому раздел «Статьи» на главной открывал
 * гастрогид — ровно тот баг, который владелец и увидел. Тест держит границу с
 * двух сторон разом:
 *
 *   • экран `/articles` ходит ТОЛЬКО в `GET /articles` и показывает только
 *     статьи; подборку он не запрашивает вовсе;
 *   • экран `/gastroguide` ходит ТОЛЬКО в `GET /gastroguide/collections` и
 *     показывает только подборки; статью он не запрашивает вовсе.
 *
 * Проверяется именно ВЫЗОВ РУЧКИ, а не отбор по `kind` в отрисовке: фильтр на
 * клиенте выглядел бы так же, но означал бы, что обе сущности делят одну
 * страницу выдачи и вытесняют друг друга.
 */

const t = getDictionary("ru");

const push = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn(), canGoBack: () => false }),
  usePathname: () => "/articles",
}));

vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));

vi.mock("../../src/lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

// Шапка гастрогида тянет локальный jpg через `require` — Node в тесте пытается
// разобрать его как модуль и падает. Подменяется только кадр (тот же приём, что
// в gastroguide-screen.test.tsx); ничего из проверяемого здесь она не рисует.
vi.mock("../../src/components/articles/GuideHero", () => ({
  GUIDE_HERO_CONTENT_HEIGHT: 340,
  GuideHero: () => null,
}));

const listArticles = vi.fn<() => Promise<GuideCollection[]>>();
const getGuideCollections = vi.fn<() => Promise<GuideCollection[]>>();
const getGuideRoutes = vi.fn<(city: string) => Promise<GuideRoute[]>>();

vi.mock("../../src/lib/repository", () => ({
  useRepository: () =>
    ({ listArticles, getGuideCollections, getGuideRoutes }) as unknown as RestaurantRepository,
}));

const ArticlesScreen = (await import("../articles")).default;
const GastroguideScreen = (await import("../gastroguide")).default;

function record(
  slug: string,
  title: string,
  kind: GuideCollection["kind"],
  categorySlugs: string[] = [],
): GuideCollection {
  return {
    slug,
    kind,
    title,
    subtitle: "",
    description: "Описание",
    coverImageUrl: "https://cdn.example/cover.jpg",
    venueCount: 2,
    categorySlugs,
  };
}

/** Как на проде после разделения: четыре подборки с рубриками и четыре статьи
 * без них, каждая — только в своей ручке. */
const COLLECTIONS = [record("kazakh-cuisine", "Казахская кухня", "collection", ["kazakh"])];
const ARTICLES = [record("almaty-longread", "Сейчас Алматы ест невероятно хорошо", "article")];

function renderScreen(node: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  push.mockClear();
  listArticles.mockReset().mockResolvedValue(ARTICLES);
  getGuideCollections.mockReset().mockResolvedValue(COLLECTIONS);
  getGuideRoutes.mockReset().mockResolvedValue([]);
});

describe("статьи и подборки гастрогида — разные сущности", () => {
  it("экран «Статьи» читает GET /articles и не трогает подборки", async () => {
    renderScreen(<ArticlesScreen />);

    expect(await screen.findByText("Сейчас Алматы ест невероятно хорошо")).toBeTruthy();
    expect(listArticles).toHaveBeenCalledTimes(1);
    expect(getGuideCollections).not.toHaveBeenCalled();
    // Подборка гастрогида в раздел статей не попадает ни при каком ответе.
    expect(screen.queryByText("Казахская кухня")).toBeNull();
  });

  it("экран гастрогида читает GET /gastroguide/collections и не трогает статьи", async () => {
    renderScreen(<GastroguideScreen />);

    expect(await screen.findByText("Казахская кухня")).toBeTruthy();
    expect(getGuideCollections).toHaveBeenCalledTimes(1);
    expect(listArticles).not.toHaveBeenCalled();
    expect(screen.queryByText("Сейчас Алматы ест невероятно хорошо")).toBeNull();
  });

  it("карточка статьи открывает статью, а не подборку гастрогида", async () => {
    const person = userEvent.setup();

    renderScreen(<ArticlesScreen />);

    const card = await screen.findByLabelText(
      t.articles.card("Сейчас Алматы ест невероятно хорошо", t.explore.articleAuthorDefault),
    );
    await person.click(card);

    expect(push).toHaveBeenCalledWith("/articles/almaty-longread");
    expect(push).not.toHaveBeenCalledWith("/gastroguide");
    expect(push).not.toHaveBeenCalledWith("/gastroguide/collections/almaty-longread");
  });

  it("пустой ответ ручки статей — спокойное пустое состояние, а не ошибка", async () => {
    listArticles.mockResolvedValue([]);

    renderScreen(<ArticlesScreen />);

    await waitFor(() => expect(screen.getByText(t.articles.emptyTitle)).toBeTruthy());
    expect(screen.queryByText(t.articles.errorTitle)).toBeNull();
  });

  it("отказ ручки статей показывает ошибку с повтором, а не пустой список", async () => {
    listArticles.mockRejectedValue(new Error("boom"));

    renderScreen(<ArticlesScreen />);

    await waitFor(() => expect(screen.getByText(t.articles.errorTitle)).toBeTruthy());
    expect(screen.queryByText(t.articles.emptyTitle)).toBeNull();
  });
});
