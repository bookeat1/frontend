import type { GuideCollection, GuideRoute, RestaurantRepository } from "@bookeat/api";
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
 *   5. Стрелки «назад» на корне вкладки НЕТ НИКОГДА — даже когда в стеке есть
 *      куда возвращаться (заход с главной по шеврону «Гастрогид»). Заголовок
 *      при этом остаётся по центру.
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
      eyebrow,
      headline,
      subline,
    }: {
      title: string;
      eyebrow: string;
      headline: string;
      subline: string;
    }) => (
      <div>
        <FlowHeader title={title} tone="onDark" />
        <span>{eyebrow}</span>
        <span>{headline}</span>
        <span>{subline}</span>
      </div>
    ),
  };
});

const getGuideCollections = vi.fn<() => Promise<GuideCollection[]>>();
const getGuideRoutes = vi.fn<(city: string) => Promise<GuideRoute[]>>();

vi.mock("../../src/lib/repository", () => ({
  useRepository: () =>
    ({ getGuideCollections, getGuideRoutes }) as unknown as RestaurantRepository,
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

function route(slug: string, title: string, durationLabel = "1 день · 4 точки"): GuideRoute {
  return {
    slug,
    title,
    description: "Описание маршрута",
    coverImageUrl: "https://cdn.example/route.jpg",
    durationLabel,
    pointCount: 4,
  };
}

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
  getGuideRoutes.mockResolvedValue([]);
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

  it("на корне вкладки стрелки «назад» нет — ни с пустым стеком, ни с непустым", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText("Казахская кухня")).toBeTruthy());
    expect(screen.queryByLabelText(t.a11y.backButton)).toBeNull();

    // Заход с главной по шеврону «Гастрогид» оставляет в стеке запись, и
    // раньше ровно на этом экран рисовал стрелку. Возвращаться из корня
    // вкладки некуда — стрелки не должно быть и здесь.
    canGoBack = true;
    renderScreen();
    await waitFor(() => expect(screen.getAllByText("Казахская кухня").length).toBeGreaterThan(0));
    expect(screen.queryByLabelText(t.a11y.backButton)).toBeNull();
    expect(back).not.toHaveBeenCalled();
  });

  it("оставляет заголовок шапки на месте, без стрелки", async () => {
    renderScreen();

    // С макета «Editorial v2» (node 3192:6251) в шапке стоит брендовая
    // надпись с городом, а не слово «Гастрогид». Город берётся тот же, что
    // во всех городозависимых запросах экрана: в тесте профиля нет и
    // хранилище пусто, поэтому это откат словаря.
    const heading = await screen.findByRole("heading", {
      name: t.articles.guideBrandTitle(t.explore.cityFallback),
    });
    expect(heading).toBeTruthy();
    // Слева от заголовка остаётся пустой слот той же ширины, что и кнопка,
    // поэтому шапка не съезжает: заголовок — по-прежнему средняя колонка.
    expect(heading.previousElementSibling).toBeTruthy();
    expect(heading.previousElementSibling?.getAttribute("role")).not.toBe("button");
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

  it("секции «Гастропрогулки» нет, пока маршрутов нет", async () => {
    renderScreen();

    // Ждём отрисовки подборок, чтобы проверка не поймала момент до загрузки.
    await screen.findByText("Казахская кухня");
    expect(screen.queryByText(t.articles.routesTitle)).toBeNull();
  });

  it("маршруты рисуются секцией ниже подборок и открываются по нажатию", async () => {
    const user = userEvent.setup();
    getGuideRoutes.mockResolvedValue([route("classic-almaty-tour", "Классический тур по Алматы")]);

    renderScreen();

    expect(await screen.findByText(t.articles.routesTitle)).toBeTruthy();
    const card = await screen.findByLabelText(
      t.articles.card("Классический тур по Алматы", "1 день · 4 точки"),
    );
    await user.click(card);

    expect(push).toHaveBeenCalledWith("/routes/classic-almaty-tour");
  });

  it("без редакционной строки длительности карточка показывает число точек", async () => {
    getGuideRoutes.mockResolvedValue([route("almaty-citizen-day", "День алматинца", "")]);

    renderScreen();

    expect(await screen.findByText("4 точки")).toBeTruthy();
  });

  it("отказ ручки маршрутов не рушит экран: подборки на месте, секции маршрутов нет", async () => {
    getGuideRoutes.mockRejectedValue(new Error("сеть недоступна"));

    renderScreen();

    expect(await screen.findByText("Казахская кухня")).toBeTruthy();
    await waitFor(() => expect(getGuideRoutes).toHaveBeenCalled());
    expect(screen.queryByText(t.articles.routesTitle)).toBeNull();
  });
});
