import type {
  GuideCategory,
  GuideCollection,
  GuideCollectionDetail,
  GuideCollectionVenue,
  RestaurantRepository,
} from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GuideRubricScreen from "../gastroguide/rubric/[slug]";

/**
 * Экран одной рубрики гастрогида (node 3492:13723). Проверяем то, что ломается
 * тихо:
 *
 *   1. в шапке стоит название РУБРИКИ (из `GET /gastroguide/categories`), а в
 *      списке — заведения её подборок;
 *   2. одно и то же заведение в двух подборках одной рубрики даёт ОДНУ
 *      карточку: иначе на проде появятся две одинаковые подряд;
 *   3. плашек «№1» и «ВЫБОР VISIT ALMATY» с макета на экране НЕТ — под ними
 *      нет ни одного поля в ответе API, и решение владельца их не заводить
 *      обязано пережить любую следующую правку вёрстки.
 */

const t = getDictionary("ru");

const push = vi.fn();
const back = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back, replace: vi.fn(), canGoBack: () => true }),
  usePathname: () => "/gastroguide/rubric/kazakh-cuisine-rubric",
  useLocalSearchParams: () => ({ slug: "kazakh-cuisine-rubric" }),
}));

vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));

vi.mock("../../src/lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const getGuideCategories = vi.fn<() => Promise<GuideCategory[]>>();
const getGuideCollections = vi.fn<() => Promise<GuideCollection[]>>();
const getGuideCollection = vi.fn<(slug: string) => Promise<GuideCollectionDetail>>();

vi.mock("../../src/lib/repository", () => ({
  useRepository: () =>
    ({
      getGuideCategories,
      getGuideCollections,
      getGuideCollection,
    }) as unknown as RestaurantRepository,
}));

function collection(slug: string, title: string, categorySlugs: string[]): GuideCollection {
  return {
    slug,
    kind: "collection",
    title,
    subtitle: "",
    description: "Аутентичные вкусы степи.",
    coverImageUrl: "https://cdn.example/cover.jpg",
    venueCount: 2,
    categorySlugs,
  };
}

function venue(restaurantId: string, name: string): GuideCollectionVenue {
  return {
    restaurantId,
    name,
    note: "",
    address: "Достык 1",
    cuisineType: "Казахская",
    city: "Алматы",
    priceCategory: "₸₸",
    imageUrl: "https://cdn.example/venue.jpg",
    instagram: "",
    highlight: null,
  };
}

function detail(base: GuideCollection, venues: GuideCollectionVenue[]): GuideCollectionDetail {
  return { ...base, venues };
}

const RUBRIC = collection("kazakh-collection", "Подборка про степь", ["kazakh-cuisine-rubric"]);
const OTHER = collection("coffee", "Кофе", ["coffee-rubric"]);

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GuideRubricScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  push.mockClear();
  getGuideCategories.mockResolvedValue([
    { slug: "kazakh-cuisine-rubric", title: "Казахская кухня", position: 1 },
    { slug: "coffee-rubric", title: "Кофе", position: 2 },
  ]);
  getGuideCollections.mockResolvedValue([RUBRIC, OTHER]);
  getGuideCollection.mockImplementation(async (slug) => {
    if (slug === "kazakh-collection") {
      return detail(RUBRIC, [venue("r1", "Дареджани"), venue("r2", "Аул")]);
    }
    return detail(OTHER, []);
  });
});

describe("экран рубрики гастрогида", () => {
  it("показывает название рубрики и заведения её подборок", async () => {
    renderScreen();

    // Название — из справочника рубрик, а НЕ название подборки.
    await waitFor(() => expect(screen.getByText("Казахская кухня")).toBeTruthy());
    expect(screen.queryByText("Подборка про степь")).toBeNull();

    expect(screen.getByText("Дареджани")).toBeTruthy();
    expect(screen.getByText("Аул")).toBeTruthy();
    // Заголовок списка с макета (node 3492:13743).
    expect(screen.getByText(t.articles.rubricEditorialTitle)).toBeTruthy();
    // Подпись карточки — «кухня · ступень чека», без выдуманного расстояния.
    expect(screen.getAllByText("Казахская · ₸₸").length).toBe(2);
    // Подборка чужой рубрики на экран не попала.
    expect(getGuideCollection).toHaveBeenCalledWith("kazakh-collection");
    expect(getGuideCollection).not.toHaveBeenCalledWith("coffee");
  });

  it("заведение из двух подборок одной рубрики даёт одну карточку", async () => {
    const second = collection("kazakh-second", "Ещё про степь", ["kazakh-cuisine-rubric"]);
    getGuideCollections.mockResolvedValue([RUBRIC, second]);
    getGuideCollection.mockImplementation(async (slug) =>
      slug === "kazakh-collection"
        ? detail(RUBRIC, [venue("r1", "Дареджани"), venue("r2", "Аул")])
        : detail(second, [venue("r2", "Аул"), venue("r3", "Наван")]),
    );

    renderScreen();

    await waitFor(() => expect(screen.getByText("Наван")).toBeTruthy());
    expect(screen.getAllByText("Аул").length).toBe(1);
    expect(screen.getAllByText("Дареджани").length).toBe(1);
  });

  it("плашек «№1» и «ВЫБОР VISIT ALMATY» с макета на экране нет", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByText("Дареджани")).toBeTruthy());
    // Ранга у заведения в ответе API нет — номера мест на карточках быть не
    // может ни в каком виде.
    expect(screen.queryByText("№1")).toBeNull();
    expect(screen.queryByText(/№\s*\d/)).toBeNull();
    // Редакционной отметки в ответе тоже нет.
    expect(screen.queryByText(/ВЫБОР VISIT/i)).toBeNull();
  });

  it("тап по карточке открывает заведение", async () => {
    renderScreen();

    const card = await screen.findByLabelText(t.articles.openVenue("Дареджани"));
    card.click();

    expect(push).toHaveBeenCalledWith("/restaurant/r1");
  });

  it("рубрика без подборок — честная пустота, а не ошибка", async () => {
    getGuideCollections.mockResolvedValue([OTHER]);

    renderScreen();

    await waitFor(() => expect(screen.getByText(t.articles.rubricEmptyTitle)).toBeTruthy());
    // Название всё равно из справочника: гость видит, куда он попал.
    expect(screen.getByText("Казахская кухня")).toBeTruthy();
  });

  it("неизвестный слаг рубрики — «не найдена», а не пустой экран", async () => {
    getGuideCategories.mockResolvedValue([]);
    getGuideCollections.mockResolvedValue([OTHER]);

    renderScreen();

    await waitFor(() => expect(screen.getByText(t.articles.rubricNotFoundTitle)).toBeTruthy());
  });

  it("на этом экране, в отличие от корня вкладки, есть рабочая стрелка «назад»", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByText("Дареджани")).toBeTruthy());
    const arrow = screen.getByLabelText(t.a11y.backButton);
    arrow.click();

    expect(back).toHaveBeenCalled();
  });
});
