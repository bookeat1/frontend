import type { GuideRouteDetail, GuideRoutePoint, RestaurantRepository } from "@bookeat/api";
import { RepositoryError } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GuideRouteScreen from "../routes/[slug]";

/**
 * Экран гастропрогулки. Проверяем то, что ломается тихо:
 *
 *   1. Остановка ведёт на экран заведения ТОЛЬКО когда заведение реально
 *      пришло. Если его погасили в каталоге, точка остаётся в маршруте
 *      текстом, но не притворяется кнопкой: ветвление идёт по `venue`, а не по
 *      `kind` (`kind` это замысел редакции, он остаётся «restaurant» и у
 *      погашенного заведения).
 *   2. Остановка с погашенным заведением НЕ ИСЧЕЗАЕТ: выкинуть её значило бы
 *      молча сократить маршрут, у которого в подписи написано «3 точки».
 *   3. Снятый с публикации маршрут (404) — честное «не найдено» без кнопки
 *      повтора, а не ошибка сети.
 *
 * Порядок остановок здесь НЕ проверяется: сортировка по `position` живёт в
 * мэппере ответа (`mapGuideRouteDetail`), и проверять её на экране, который
 * получает уже готовый массив из подменённого репозитория, значило бы проверять
 * сам тест. Её тест лежит рядом с мэппером.
 */

const t = getDictionary("ru");

const push = vi.fn();
const back = vi.fn();

vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ slug: "classic-almaty-tour" }),
  useRouter: () => ({ push, back, replace: vi.fn(), canGoBack: () => true }),
  usePathname: () => "/routes/classic-almaty-tour",
}));

vi.mock("../../src/lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const getGuideRoute = vi.fn<(slug: string) => Promise<GuideRouteDetail>>();

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getGuideRoute }) as unknown as RestaurantRepository,
}));

function point(overrides: Partial<GuideRoutePoint> & Pick<GuideRoutePoint, "id">): GuideRoutePoint {
  return {
    position: 1,
    kind: "place",
    title: "Остановка",
    description: "",
    photoUrl: null,
    address: "",
    venue: null,
    ...overrides,
  };
}

const LIVE_VENUE = {
  id: "r1",
  name: "Daily Coffee",
  address: "Абылайхана 147",
  cuisineType: "Кофейня",
  city: "Алматы",
  priceCategory: "₸₸",
  imageUrl: null,
};

function routeDetail(points: GuideRoutePoint[]): GuideRouteDetail {
  return {
    slug: "classic-almaty-tour",
    title: "Классический тур по Алматы",
    description: "Однодневный маршрут по знаковым точкам города.",
    coverImageUrl: null,
    durationLabel: "1 день · 3 точки",
    pointCount: points.length,
    points,
  };
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GuideRouteScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  push.mockClear();
});

describe("экран гастропрогулки", () => {
  it("остановка с живым заведением открывает его экран", async () => {
    const user = userEvent.setup();
    getGuideRoute.mockResolvedValue(
      routeDetail([
        point({ id: "p1", kind: "restaurant", title: "Утро: Daily Coffee", venue: LIVE_VENUE }),
      ]),
    );

    renderScreen();

    const stop = await screen.findByLabelText(t.articles.openVenue("Daily Coffee"));
    await user.click(stop);

    expect(push).toHaveBeenCalledWith("/restaurant/r1");
  });

  it("остановка с погашенным заведением остаётся в маршруте, но не кнопка", async () => {
    getGuideRoute.mockResolvedValue(
      routeDetail([
        // kind остался «restaurant» — так его и отдаёт бэкенд; заведения нет.
        point({ id: "p1", kind: "restaurant", title: "Ужин: закрытое заведение", venue: null }),
      ]),
    );

    renderScreen();

    expect(await screen.findByText("Ужин: закрытое заведение")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Открыть/ })).toBeNull();
  });

  it("снятый с публикации маршрут показывает «не найдено», а не ошибку сети", async () => {
    getGuideRoute.mockRejectedValue(new RepositoryError("not found", undefined, 404));

    renderScreen();

    expect(await screen.findByText(t.articles.routeNotFoundTitle)).toBeTruthy();
    expect(screen.queryByText(t.common.retry)).toBeNull();
  });
});
