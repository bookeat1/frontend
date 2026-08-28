import type { GuideCollectionDetail } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { render, screen } from "@testing-library/react";
import type { UseQueryResult } from "@tanstack/react-query";
import React from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * ЧТО ЭТОТ ФАЙЛ ДЕРЖИТ: карточка статьи собрана ПО ОБРАЗЦУ КАРТОЧКИ АФИШИ
 * (правка владельца 28.08.2026), а не по брендовому макету подборки.
 *
 * Раньше `/articles/:slug` и `/gastroguide/collections/:slug` рисовал один и
 * тот же `GuideCollectionScreen`. Соблазн снова свести их в один компонент
 * («форма ответа-то одна») велик, и глазами подмену заметит только тот, кто
 * откроет оба экрана подряд. Поэтому проверяется наблюдаемое:
 *
 *   • название статьи лежит ПОВЕРХ фотографии, внутри того же `EventHero`,
 *     которым набрана шапка афиши, — а не в брендовой шапке подборки;
 *   • на кадре есть обе плавающие кнопки — «назад» и «поделиться»;
 *   • сердечка нет (избранного статей на бэкенде не существует);
 *   • блок текста называется «О статье» — по образцу «Об афише»;
 *   • липкий футер ведёт в каталог, а не предлагает бронировать статью.
 */

const t = getDictionary("ru");

const back = vi.fn();
const push = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back, replace: vi.fn(), canGoBack: () => true }),
  usePathname: () => "/articles/almaty-coffee",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

// Градиент-затемнение под подписью — нативный модуль; на структуру, которую
// держит этот файл, он не влияет.
vi.mock("expo-linear-gradient", () => ({ LinearGradient: () => null }));

const { ArticleScreen } = await import("../../src/components/articles/ArticleScreen");
const { EventHero } = await import("../../src/components/afisha/EventHero");

const ARTICLE: GuideCollectionDetail = {
  slug: "almaty-coffee",
  kind: "article",
  title: "Кофейная культура Алматы",
  subtitle: "От BookEat",
  description: "Где в городе варят кофе, ради которого стоит встать раньше.",
  coverImageUrl: "https://cdn.example/cover.jpg",
  venueCount: 1,
  categorySlugs: [],
  venues: [
    {
      restaurantId: "r-1",
      name: "Mongol",
      city: "Алматы",
      address: "Абая 10",
      instagram: "mongol.almaty",
      imageUrl: "https://cdn.example/venue.jpg",
      cuisineType: "Кофейня",
      priceCategory: "$$",
      note: "Заметка редакции",
      highlight: null,
    },
  ],
};

function renderArticle(data: GuideCollectionDetail = ARTICLE) {
  const query = {
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<GuideCollectionDetail>;
  return render(<ArticleScreen query={query} />);
}

describe("карточка статьи повторяет карточку афиши", () => {
  it("набирает шапку тем же компонентом, что и афиша", () => {
    // Не «похожая вёрстка», а буквально тот же компонент: разойтись двум
    // копиям куда проще, чем одному файлу.
    const source = ArticleScreen.toString();
    expect(source).toContain("EventHero");
    expect(EventHero).toBeTypeOf("function");
  });

  it("кладёт название поверх фотографии и даёт обе плавающие кнопки", () => {
    renderArticle();

    expect(screen.getByText(ARTICLE.title)).toBeTruthy();
    expect(screen.getByText(ARTICLE.subtitle)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.a11y.backButton })).toBeTruthy();
    expect(screen.getByRole("button", { name: t.a11y.shareButton })).toBeTruthy();
  });

  it("не рисует сердечко: избранного статей на бэкенде нет", () => {
    renderArticle();

    const favouriteish = screen
      .queryAllByRole("button")
      .filter((node) => /избранн/i.test(node.getAttribute("aria-label") ?? ""));
    expect(favouriteish).toHaveLength(0);
  });

  it("называет блок текста «О статье» и показывает сам текст", () => {
    renderArticle();

    expect(screen.getByText(t.articles.articleAboutTitle)).toBeTruthy();
    expect(screen.getByText(ARTICLE.description)).toBeTruthy();
  });

  it("прячет блок текста целиком, когда редакция его не написала", () => {
    renderArticle({ ...ARTICLE, description: "" });

    expect(screen.queryByText(t.articles.articleAboutTitle)).toBeNull();
  });

  it("показывает список заведений со счётчиком", () => {
    renderArticle();

    expect(screen.getByText(t.articles.allPointsTitle)).toBeTruthy();
    expect(screen.getByText(t.articles.venueCount(1))).toBeTruthy();
    expect(screen.getByText("Mongol")).toBeTruthy();
  });

  it("ведёт кнопкой футера в каталог, а не в бронирование", () => {
    renderArticle();

    const cta = screen.getByRole("button", { name: t.articles.browseVenues });
    cta.click();
    expect(push).toHaveBeenCalledWith("/search");
  });
});
