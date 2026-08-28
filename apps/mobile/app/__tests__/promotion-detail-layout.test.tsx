import type { HomePromo, RestaurantRepository } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatDayMonth } from "../../src/lib/format";

/**
 * ЧТО ЭТОТ ФАЙЛ ДЕРЖИТ: карточка акции собрана ПО ОБРАЗЦУ КАРТОЧКИ АФИШИ
 * (правка владельца 28.08.2026 — «карточка акции должна быть такой же, как
 * афиша и карточка заведения, по структуре»).
 *
 * Раньше у акции была своя шапка: белая полоса со стрелкой и кнопками, под ней
 * фотография в рамке с полями 12 и название на белом. Соблазн вернуть её
 * («у акции же нет ни меток, ни времени») велик, а глазами подмену заметит
 * только тот, кто откроет афишу и акцию подряд. Поэтому проверяется
 * наблюдаемое:
 *
 *   • шапку рисует тот же `EventHero`, что и у афиши, — название и подпись
 *     лежат ПОВЕРХ фотографии;
 *   • на кадре все три плавающие кнопки: «назад», сердечко и «поделиться»;
 *   • скидка показана фирменной плашкой, когда лента её прислала, и её нет,
 *     когда не прислала (выдумывать «−0 %» нельзя);
 *   • блок «Об акции» со сроком действия и блок «Контакты» на месте — второй
 *     общий с афишей и правился 27.08, ломать его нельзя.
 */

const t = getDictionary("ru");

const push = vi.fn();
const back = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back, replace: vi.fn(), canGoBack: () => true }),
  usePathname: () => "/promotion/p-1",
  useLocalSearchParams: () => ({ id: "p-1" }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

// Градиент-затемнение под подписью — нативный модуль; на структуру, которую
// держит этот файл, он не влияет.
vi.mock("expo-linear-gradient", () => ({ LinearGradient: () => null }));

vi.mock("../../src/lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

// Гость без сессии: лента акций городская и запрашивается и без входа.
vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-out", repository: { getMe: vi.fn(), updateMe: vi.fn() } }),
}));

// Избранное акций ходит в свои ручки; карточке важно лишь состояние сердечка.
vi.mock("../../src/hooks/useFavorites", () => ({
  usePromoFavorite: () => ({ isFavorite: false, failed: false, toggle: vi.fn() }),
}));

// Заведение-хозяин для блока «Контакты» — своя ручка, к раскладке кадра
// отношения не имеет.
vi.mock("../../src/hooks/useRestaurant", () => ({
  useRestaurant: () => ({ data: undefined }),
}));

const getPromotions = vi.fn<() => Promise<HomePromo[]>>();

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getPromotions }) as unknown as RestaurantRepository,
}));

const { default: PromotionDetailScreen } = await import("../promotion/[id]");
const { EventHero } = await import("../../src/components/afisha/EventHero");

const PROMO: HomePromo = {
  id: "p-1",
  restaurantId: "r-1",
  restaurantName: "Del Papa",
  title: "Двойная пицца",
  description: "Вторая пицца в подарок каждую среду.",
  startsAt: "2026-09-01T00:00:00Z",
  endsAt: "2026-09-30T00:00:00Z",
  coverImageUrl: "https://cdn.example/promo.jpg",
  images: ["https://cdn.example/promo-2.jpg"],
  discountPercent: 20,
};

function renderPromo(promo: HomePromo = PROMO) {
  getPromotions.mockResolvedValue([promo]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PromotionDetailScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("карточка акции повторяет карточку афиши", () => {
  it("набирает шапку тем же компонентом, что и афиша", () => {
    // Не «похожая вёрстка», а буквально тот же компонент.
    expect(PromotionDetailScreen.toString()).toContain("EventHero");
    expect(EventHero).toBeTypeOf("function");
  });

  it("кладёт название и подпись поверх фотографии", async () => {
    renderPromo();

    await waitFor(() => expect(screen.getByText(PROMO.title)).toBeTruthy());
    expect(screen.getByText(t.promotions.subtitle(["Del Papa", t.promotions.until(formatDayMonth(new Date(PROMO.endsAt)))]))).toBeTruthy();
  });

  it("даёт на кадре все три плавающие кнопки", async () => {
    renderPromo();

    await waitFor(() => expect(screen.getByText(PROMO.title)).toBeTruthy());
    expect(screen.getByRole("button", { name: t.a11y.backButton })).toBeTruthy();
    expect(screen.getByRole("button", { name: t.a11y.shareButton })).toBeTruthy();
    expect(screen.getByRole("button", { name: t.restaurant.favoriteAdd(PROMO.title) })).toBeTruthy();
  });

  it("показывает скидку плашкой на кадре", async () => {
    renderPromo();

    await waitFor(() => expect(screen.getByText(t.explore.promoDiscount(20))).toBeTruthy());
  });

  it("без скидки в ленте плашки нет", async () => {
    renderPromo({ ...PROMO, discountPercent: null });

    await waitFor(() => expect(screen.getByText(PROMO.title)).toBeTruthy());
    expect(screen.queryByText(/−\d+%/)).toBeNull();
  });

  it("оставляет блок «Об акции» со сроком действия", async () => {
    renderPromo();

    await waitFor(() => expect(screen.getByText(t.promotions.aboutTitle)).toBeTruthy());
    expect(screen.getByText(PROMO.description)).toBeTruthy();
    expect(screen.getByText(t.promotions.periodTitle)).toBeTruthy();
    expect(screen.getByText(t.promotions.period(
          formatDayMonth(new Date(PROMO.startsAt)),
          formatDayMonth(new Date(PROMO.endsAt)),
        ))).toBeTruthy();
  });

  it("оставляет липкую кнопку брони заведения-хозяина", async () => {
    renderPromo();

    const cta = await screen.findByRole("button", { name: t.promotions.bookAction });
    cta.click();
    expect(push).toHaveBeenCalledWith("/restaurant/r-1/book");
  });

  it("не рисует блок «Контакты», пока заведение не пришло (общий с афишей блок)", async () => {
    renderPromo();

    await waitFor(() => expect(screen.getByText(PROMO.title)).toBeTruthy());
    expect(screen.queryByText(t.restaurant.contacts)).toBeNull();
  });
});
