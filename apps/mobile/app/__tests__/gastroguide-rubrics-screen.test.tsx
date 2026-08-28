import type { GuideCategory, GuideCollection, RestaurantRepository } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GuideRubricsScreen from "../gastroguide/rubrics";

/**
 * ЭКРАН «ВСЕ РУБРИКИ» (`/gastroguide/rubrics`). Заведён 28.08.2026 по правке
 * владельца «лучше столбиком», в тот же день переведён на вид ЛИСТИНГА АКЦИЙ
 * («сделай рубрики как листинг акций»). Проверяем то, что ломается тихо:
 *
 *   1. список берётся из СПРАВОЧНИКА рубрик (`GET /gastroguide/categories`), а
 *      не из ленты подборок: рубрика, у которой ещё нет ни одной подборки, в
 *      ленте на корне вкладки не показывается — и обязана показаться здесь;
 *   2. карточка ведёт на экран рубрики по ЕЁ СОБСТВЕННОМУ слагу (а не по слагу
 *      подборки, из которой лента строит свои плитки);
 *   3. карточка — та же общая `ListMediaCard`, которой рисуется листинг акций,
 *      а не копия вёрстки и не плитка ленты;
 *   4. подпись под названием — ЧИСЛО ПОДБОРОК рубрики, со склонением; у пустой
 *      рубрики подписи нет вовсе, выдуманного текста там не появляется;
 *   5. отказ ленты ПОДБОРОК не рушит экран: без него у карточек нет ни
 *      фотографий, ни подписи, но названия рубрик — то, ради чего сюда пришли.
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

// Градиент-затемнение карточки — нативный модуль; на структуру, которую
// держит этот файл, он не влияет.
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

function collection(over: Partial<GuideCollection>): GuideCollection {
  return {
    slug: "steppe-tastes",
    kind: "collection",
    title: "Вкусы степи",
    subtitle: "",
    description: "Аутентичные вкусы степи.",
    coverImageUrl: "https://cdn.example/steppe.jpg",
    venueCount: 2,
    categorySlugs: ["kazakh-cuisine"],
    ...over,
  };
}

const COLLECTIONS: GuideCollection[] = [
  collection({}),
  // Вторая подборка той же рубрики — ради счётчика в подписи; обложка у неё
  // своя, и карточка обязана взять НЕ её, а обложку первой.
  collection({
    slug: "steppe-tastes-2",
    title: "Вкусы степи, часть вторая",
    coverImageUrl: "https://cdn.example/steppe-2.jpg",
  }),
  collection({
    slug: "third-wave",
    title: "Третья волна",
    coverImageUrl: "https://cdn.example/coffee.jpg",
    categorySlugs: ["coffee"],
  }),
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

  it("ведёт карточкой на экран рубрики по её собственному слагу", async () => {
    const person = userEvent.setup();
    renderScreen();

    const card = await screen.findByRole("button", {
      name: t.articles.openRubric("Горы и гастрономия"),
    });
    await person.click(card);

    expect(push).toHaveBeenCalledWith("/gastroguide/rubric/mountains");
  });

  it("подписывает рубрику числом её подборок, со склонением", async () => {
    renderScreen();

    // Две подборки помечены «kazakh-cuisine», одна — «coffee».
    await waitFor(() =>
      expect(screen.getByText(t.articles.rubricCollectionCount(2))).toBeTruthy(),
    );
    expect(screen.getByText(t.articles.rubricCollectionCount(1))).toBeTruthy();
    // Склонение — не украшение: подпись читает живой человек.
    expect(t.articles.rubricCollectionCount(1)).toBe("1 подборка");
    expect(t.articles.rubricCollectionCount(2)).toBe("2 подборки");
    expect(t.articles.rubricCollectionCount(5)).toBe("5 подборок");
  });

  it("у рубрики без подборок подписи нет вовсе — ни нуля, ни выдумки", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByText("Горы и гастрономия")).toBeTruthy());
    expect(screen.queryByText(t.articles.rubricCollectionCount(0))).toBeNull();
    // Ни одной подписи, кроме двух честных счётчиков непустых рубрик.
    expect(screen.queryAllByText(/подборк/)).toHaveLength(2);
  });

  it("берёт обложку ПЕРВОЙ подборки рубрики, а не следующих", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByText("Казахская кухня")).toBeTruthy());
    // Снимок декоративен (alt=""), поэтому роли `img` у него нет — берём по
    // тест-идентификатору общей `PhotoView`.
    const sources = screen
      .getAllByTestId("photo-image")
      .map((node) => node.getAttribute("src"));
    expect(sources).toContain("https://cdn.example/steppe.jpg");
    expect(sources).not.toContain("https://cdn.example/steppe-2.jpg");
  });

  it("рисует карточки той же общей ListMediaCard, что и листинг акций", async () => {
    // Не «похожая вёрстка», а буквально тот же файл: разойтись двум копиям
    // куда проще, чем одному компоненту, а владелец просил, чтобы экраны
    // выглядели одинаково.
    const source = GuideRubricsScreen.toString();
    expect(source).toContain("ListMediaCard");
    // Плитки ленты гастрогида здесь больше нет — она осталась только в ленте.
    expect(source).not.toContain("GuideRubricTile");

    const { ListMediaCard } = await import("../../src/components/ListMediaCard");
    expect(ListMediaCard).toBeTypeOf("function");

    const { PromotionListCard } = await import(
      "../../src/components/promotions/PromotionListCard"
    );
    expect(PromotionListCard.toString()).toContain("ListMediaCard");
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
