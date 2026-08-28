import type { GuideCollection, GuideRoute, RestaurantRepository } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ГАСТРОГИД ОБНОВЛЯЕТСЯ ЖЕСТОМ «ПОТЯНУТЬ ВНИЗ».
 *
 * Экран собран из ДВУХ независимых ручек — подборки и гастропрогулки, — и
 * ломается здесь ровно то же место, что на главной: индикатор, привязанный к
 * одному запросу, погас бы на первом ответе, пока второй блок ещё едет.
 * Поэтому проверяется, что жест переспрашивает ОБА блока и что кружок ждёт
 * ПОСЛЕДНИЙ ответ.
 *
 * Про подмену `RefreshControl` — см. заголовок home-pull-to-refresh.test.tsx:
 * в react-native-web он пустышка, настоящее оттягивание проверяется только на
 * устройстве.
 */

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: () => false }),
  usePathname: () => "/gastroguide",
}));

vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));

vi.mock("../../src/lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

// Шапка тянет локальный jpg через `require` — Node в тесте разобрать его не
// может (та же подмена, что в gastroguide-screen.test.tsx).
vi.mock("../../src/components/articles/GuideHero", () => ({
  GUIDE_HERO_CONTENT_HEIGHT: 200,
  GuideHero: () => null,
}));

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

const getGuideCollections = vi.fn<() => Promise<GuideCollection[]>>();
const getGuideRoutes = vi.fn<(city: string) => Promise<GuideRoute[]>>();

vi.mock("../../src/lib/repository", () => ({
  useRepository: () =>
    ({ getGuideCollections, getGuideRoutes }) as unknown as RestaurantRepository,
}));

const GastroguideScreen = (await import("../gastroguide")).default;

function collection(slug: string): GuideCollection {
  return {
    slug,
    kind: "collection",
    title: `Подборка ${slug}`,
    subtitle: "",
    description: "Описание подборки",
    coverImageUrl: null,
    venueCount: 2,
    categorySlugs: [],
  };
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <GastroguideScreen />
    </QueryClientProvider>,
  );
}

async function pull() {
  const person = userEvent.setup();
  await person.click(await screen.findByRole("button", { name: "потянуть вниз" }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  getGuideCollections.mockReset().mockResolvedValue([collection("a")]);
  getGuideRoutes.mockReset().mockResolvedValue([]);
});

describe("гастрогид: потянуть вниз, чтобы обновить", () => {
  it("переспрашивает и подборки, и гастропрогулки", async () => {
    renderScreen();

    await waitFor(() => {
      expect(getGuideCollections).toHaveBeenCalledTimes(1);
      expect(getGuideRoutes).toHaveBeenCalledTimes(1);
    });

    await pull();

    await waitFor(() => {
      expect(getGuideCollections).toHaveBeenCalledTimes(2);
      expect(getGuideRoutes).toHaveBeenCalledTimes(2);
    });
  });

  it("кружок гаснет только когда ответил ПОСЛЕДНИЙ из двух блоков", async () => {
    renderScreen();
    await waitFor(() => expect(getGuideRoutes).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("кружка нет")).toBeTruthy();

    // Гастропрогулки отвечают не сразу — подборки успевают вернуться раньше.
    const routes = deferred<GuideRoute[]>();
    getGuideRoutes.mockReturnValueOnce(routes.promise);

    await pull();

    expect(await screen.findByText("кружок крутится")).toBeTruthy();
    await waitFor(() => expect(getGuideCollections).toHaveBeenCalledTimes(2));
    // Подборки уже ответили, а кружок обязан остаться.
    expect(screen.getByText("кружок крутится")).toBeTruthy();

    await act(async () => {
      routes.resolve([]);
    });

    await waitFor(() => expect(screen.getByText("кружка нет")).toBeTruthy());
  });
});
