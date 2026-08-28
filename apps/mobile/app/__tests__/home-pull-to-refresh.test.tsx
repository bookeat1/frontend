import type {
  Cuisine,
  EventPage,
  GuideCollection,
  GuideRoute,
  HomePromo,
  RestaurantSummary,
} from "@bookeat/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ГЛАВНАЯ ОБНОВЛЯЕТСЯ ЖЕСТОМ «ПОТЯНУТЬ ВНИЗ».
 *
 * Было: жеста не существовало нигде, кроме «Уведомлений». Владелец потянул
 * главную, ожидая обновления, и не произошло НИЧЕГО — данные подтягивались
 * сами, но привычный жест был мёртвым.
 *
 * Здесь проверяется не спиннер, а слой данных, потому что ломается именно он:
 *
 *   1. жест переспрашивает ВСЕ блоки, которые экран показывает;
 *   2. и НЕ трогает запросы, которых на экране нет (жест на главной не должен
 *      втихую перегонять весь кэш приложения);
 *   3. кружок гаснет, только когда ответил ПОСЛЕДНИЙ блок. Это самое хрупкое
 *      место: `isRefetching` одного запроса погасил бы его на первом ответе,
 *      и жест выглядел бы выполненным, пока полдомашней ещё едет.
 *
 * ЧЕГО ЭТОТ ТЕСТ НЕ ДОКАЗЫВАЕТ: самого ЖЕСТА. `RefreshControl` в
 * react-native-web — пустышка: он выбрасывает `refreshing` и `onRefresh` и
 * рисует обычный `View`, поэтому ни оттянуть ленту, ни увидеть индикатор в
 * jsdom нельзя в принципе. Поэтому `RefreshControl` здесь подменён на видимую
 * кнопку и подпись — так проверяется, что экран действительно ОТДАЁТ в него
 * свою пару значений и что пара ведёт себя правильно. Настоящее оттягивание
 * пальцем проверяется на устройстве.
 */

const getRecommendedRestaurants = vi.fn<() => Promise<RestaurantSummary[]>>();
const getCatalogPreview = vi.fn<() => Promise<RestaurantSummary[]>>();
const getCuisines = vi.fn<() => Promise<Cuisine[]>>();
const listUpcomingEvents = vi.fn<() => Promise<EventPage>>();
const getPromotions = vi.fn<() => Promise<HomePromo[]>>();
const getGuideCollections = vi.fn<() => Promise<GuideCollection[]>>();
/** Запрос, которого на главной НЕТ: гастропрогулки живут на своём экране. */
const getGuideRoutes = vi.fn<() => Promise<GuideRoute[]>>();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: () => false }),
  usePathname: () => "/",
}));

vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

// Шапка тянет локальный jpg через `require`, который Node в тесте разобрать не
// может (та же подмена, что в home-guest-city.test.tsx).
vi.mock("../../src/components/explore/HomeHeader", () => ({
  HomeHeader: () => null,
}));

// Единственная подмена, без которой этот тест невозможен: см. заголовок файла.
vi.mock("react-native", async () => {
  const actual = await vi.importActual<typeof import("react-native")>("react-native");
  return {
    ...actual,
    RefreshControl: ({
      refreshing,
      onRefresh,
      children,
    }: {
      refreshing: boolean;
      onRefresh: () => void;
      children?: React.ReactNode;
    }) => (
      <div>
        <span>{refreshing ? "кружок крутится" : "кружка нет"}</span>
        <button type="button" onClick={onRefresh}>
          потянуть вниз
        </button>
        {children}
      </div>
    ),
  };
});

vi.mock("../../src/lib/locale", async () => {
  const { getDictionary } = await import("@bookeat/i18n");
  return {
    useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
  };
});

// Гость без сессии: запрос профиля выключен, и обновление обязано его
// пропустить, а не «оживить».
vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-out", repository: { getMe: vi.fn(), updateMe: vi.fn() } }),
}));

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({
    getRecommendedRestaurants,
    getCatalogPreview,
    getCuisines,
    listUpcomingEvents,
    getPromotions,
    getGuideCollections,
    getGuideRoutes,
  }),
}));

const HomeScreen = (await import("../index")).default;
const { useGuideRoutes } = await import("../../src/components/explore/use-explore-data");

function emptyPage(): EventPage {
  return { items: [], total: 0, page: 1, pages: 1, perPage: 12 };
}

/** Гастропрогулки, смонтированные РЯДОМ с экраном: тот же кэш, но не главная. */
function GuideRoutesProbe() {
  useGuideRoutes();
  return null;
}

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <HomeScreen />
      <GuideRoutesProbe />
    </QueryClientProvider>,
  );
  return client;
}

/** Обещание, которым управляет тест: так проверяется «пока не ответил
 * последний». */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function pull() {
  const person = userEvent.setup();
  await person.click(await screen.findByRole("button", { name: "потянуть вниз" }));
}

beforeEach(() => {
  getRecommendedRestaurants.mockReset().mockResolvedValue([]);
  getCatalogPreview.mockReset().mockResolvedValue([]);
  getCuisines.mockReset().mockResolvedValue([]);
  listUpcomingEvents.mockReset().mockResolvedValue(emptyPage());
  getPromotions.mockReset().mockResolvedValue([]);
  getGuideCollections.mockReset().mockResolvedValue([]);
  getGuideRoutes.mockReset().mockResolvedValue([]);
});

describe("главная: потянуть вниз, чтобы обновить", () => {
  it("переспрашивает все блоки экрана и ни одного чужого", async () => {
    renderHome();

    // Первая загрузка: по одному запросу на блок.
    await waitFor(() => {
      expect(getRecommendedRestaurants).toHaveBeenCalledTimes(1);
      expect(getCatalogPreview).toHaveBeenCalledTimes(1);
      expect(getCuisines).toHaveBeenCalledTimes(1);
      expect(listUpcomingEvents).toHaveBeenCalledTimes(1);
      expect(getPromotions).toHaveBeenCalledTimes(1);
      expect(getGuideCollections).toHaveBeenCalledTimes(1);
      expect(getGuideRoutes).toHaveBeenCalledTimes(1);
    });

    await pull();

    await waitFor(() => {
      expect(getRecommendedRestaurants).toHaveBeenCalledTimes(2);
      expect(getCatalogPreview).toHaveBeenCalledTimes(2);
      expect(getCuisines).toHaveBeenCalledTimes(2);
      expect(listUpcomingEvents).toHaveBeenCalledTimes(2);
      expect(getPromotions).toHaveBeenCalledTimes(2);
      expect(getGuideCollections).toHaveBeenCalledTimes(2);
    });

    // Гастропрогулок на главной нет — жест их не трогает.
    expect(getGuideRoutes).toHaveBeenCalledTimes(1);
  });

  it("кружок гаснет только когда ответил последний блок", async () => {
    renderHome();
    await waitFor(() => expect(getGuideCollections).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("кружка нет")).toBeTruthy();

    // «Афиша» отвечает не сразу — остальные блоки успевают вернуться раньше.
    const afisha = deferred<EventPage>();
    listUpcomingEvents.mockReturnValueOnce(afisha.promise);

    await pull();

    expect(await screen.findByText("кружок крутится")).toBeTruthy();
    await waitFor(() => expect(getGuideCollections).toHaveBeenCalledTimes(2));
    // Все, кроме «Афиши», уже ответили — а кружок обязан остаться.
    expect(screen.getByText("кружок крутится")).toBeTruthy();

    await act(async () => {
      afisha.resolve(emptyPage());
    });

    await waitFor(() => expect(screen.getByText("кружка нет")).toBeTruthy());
  });
});
