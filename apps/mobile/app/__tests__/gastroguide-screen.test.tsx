import type { GuideCollection, RestaurantRepository } from "@bookeat/api";
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
 *   1. Плитка сетки ОТКРЫВАЕТ подборку, а не отбирает список под собой
 *      (прежний отбор был нашей выдумкой и снят после просмотра на устройстве).
 *   2. Сетка и список кормятся одной ручкой подборок и не дублируют друг друга:
 *      подборка с рубрикой — в сетке, без рубрики — карточкой ниже.
 *   3. Подборка без обложки показывает стандартную плашку «фото нет».
 *   4. На карточке подборки НЕТ сердечка: избранного для подборок на бэкенде
 *      не существует, а инертное сердечко из этого приложения уже убирали.
 *   5. Стрелка «назад» появляется только когда есть куда возвращаться:
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

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getGuideCollections }) as unknown as RestaurantRepository,
}));

function collection(
  slug: string,
  title: string,
  categorySlugs: string[],
  coverImageUrl: string | null = "https://cdn.example/cover.jpg",
): GuideCollection {
  return {
    slug,
    title,
    subtitle: "",
    description: "Описание подборки",
    coverImageUrl,
    venueCount: 2,
    categorySlugs,
  };
}

/** Как на проде: часть подборок помечена рубрикой (сетка), часть — нет (список). */
const COLLECTIONS = [
  collection("kazakh-cuisine", "Казахская кухня", ["kazakh-cuisine-rubric"]),
  collection("almaty-longread", "Сейчас Алматы ест невероятно хорошо", []),
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
  push.mockClear();
  canGoBack = false;
  getGuideCollections.mockResolvedValue(COLLECTIONS);
});

describe("экран гастрогида", () => {
  it("нажатие на плитку сетки открывает подборку, а не отбирает список", async () => {
    const user = userEvent.setup();

    renderScreen();

    const tile = await screen.findByLabelText(
      t.articles.card("Казахская кухня", "Описание подборки"),
    );
    await user.click(tile);

    expect(push).toHaveBeenCalledWith("/articles/kazakh-cuisine");
    // Список под сеткой на месте: отбора больше нет.
    expect(screen.getByText("Сейчас Алматы ест невероятно хорошо")).toBeTruthy();
  });

  it("подборка показывается один раз: с рубрикой в сетке, без рубрики карточкой ниже", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getAllByText("Казахская кухня").length).toBe(1));
    expect(screen.getAllByText("Сейчас Алматы ест невероятно хорошо").length).toBe(1);
  });

  it("подборка без обложки рисует плашку «фото нет», а не пустой кадр", async () => {
    getGuideCollections.mockResolvedValue([
      collection("kazakh-cuisine", "Казахская кухня", ["kazakh-cuisine-rubric"], null),
    ]);

    renderScreen();

    await waitFor(() => expect(screen.getByText("Казахская кухня")).toBeTruthy());
    expect(screen.getAllByTestId("photo-placeholder").length).toBe(1);
    expect(screen.queryAllByTestId("photo-image").length).toBe(0);
  });

  it("все подборки без рубрик остаются списком, сетка не рисуется", async () => {
    getGuideCollections.mockResolvedValue([
      collection("almaty-longread", "Сейчас Алматы ест невероятно хорошо", []),
    ]);

    renderScreen();

    await waitFor(() =>
      expect(screen.getByText("Сейчас Алматы ест невероятно хорошо")).toBeTruthy(),
    );
    expect(screen.getAllByText("Сейчас Алматы ест невероятно хорошо").length).toBe(1);
  });

  it("на карточке подборки нет сердечка", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByText("Казахская кухня")).toBeTruthy());
    expect(screen.queryByLabelText(t.explore.favoriteAdd("Казахская кухня"))).toBeNull();
    expect(screen.queryByLabelText(t.explore.favoriteRemove("Казахская кухня"))).toBeNull();
  });

  it("на корне вкладки стрелки «назад» нет, а при заходе из другого экрана она есть", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText("Казахская кухня")).toBeTruthy());
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
