import { __mockRestaurants, type Restaurant, type RestaurantStory } from "@bookeat/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ЭКРАН ЗАВЕДЕНИЯ ОБНОВЛЯЕТСЯ ЖЕСТОМ.
 *
 * На экране ДВА независимых запроса — профиль заведения и лента сторис, — и
 * жест обязан переспросить оба, а кружок гаснуть по последнему ответу. Тот же
 * разбор, что на главной, и та же оговорка: `RefreshControl` в
 * react-native-web пустой, поэтому здесь он подменён кнопкой с подписью, а сам
 * жест пальцем проверяется на устройстве.
 */

const getRestaurant = vi.fn<(id: string) => Promise<Restaurant>>();
const getRestaurantStories = vi.fn<(id: string) => Promise<RestaurantStory[]>>();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: () => false }),
  usePathname: () => "/restaurant/r1",
  useLocalSearchParams: () => ({ id: "r1" }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/components/booking/MapPreview", () => ({ MapPreview: () => null }));

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

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-out", repository: {} }),
}));

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getRestaurant, getRestaurantStories }),
}));

const RestaurantDetailScreen = (await import("../restaurant/[id]/index")).default;

function venue(): Restaurant {
  return { ...__mockRestaurants[0], id: "r1" };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RestaurantDetailScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getRestaurant.mockReset().mockResolvedValue(venue());
  getRestaurantStories.mockReset().mockResolvedValue([]);
});

describe("экран заведения: потянуть вниз", () => {
  it("переспрашивает и профиль, и сторис, и держит кружок до последнего ответа", async () => {
    renderScreen();
    await waitFor(() => {
      expect(getRestaurant).toHaveBeenCalledTimes(1);
      expect(getRestaurantStories).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("кружка нет")).toBeTruthy();

    // Сторис отвечают позже профиля.
    const stories = deferred<RestaurantStory[]>();
    getRestaurantStories.mockReturnValueOnce(stories.promise);

    const person = userEvent.setup();
    await person.click(screen.getByRole("button", { name: "потянуть вниз" }));

    expect(await screen.findByText("кружок крутится")).toBeTruthy();
    await waitFor(() => expect(getRestaurant).toHaveBeenCalledTimes(2));
    expect(getRestaurantStories).toHaveBeenCalledTimes(2);
    // Профиль вернулся, сторис ещё едут — кружок остаётся.
    expect(screen.getByText("кружок крутится")).toBeTruthy();

    await act(async () => {
      stories.resolve([]);
    });

    await waitFor(() => expect(screen.getByText("кружка нет")).toBeTruthy());
  });
});
