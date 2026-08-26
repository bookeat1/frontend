import type { HomePromo } from "@bookeat/api";
import { listCard, spacing } from "@bookeat/design-tokens";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * «АКЦИИ»: ЖЕСТ «ПОТЯНУТЬ ВНИЗ» И ВЕРХ СПИСКА.
 *
 * Две правки владельца в одном экране, и обе ломаются в разных слоях:
 *
 *   1. жеста обновления здесь не было вовсе — он появился в тот же день на
 *      главной, «Афише», поиске и карточке заведения, а список акций остался
 *      мёртвым. Проверяется слой ДАННЫХ: жест переспрашивает ленту акций, и
 *      тянуть можно ПУСТОЙ список тоже (кнопки «обновить» там нет нарочно);
 *   2. список акций рисовал СВОЮ раскладку вместо той, что у «Афиши»: общий
 *      `padding: 16` у ленты складывался с отступами карточки, а обложка
 *      осталась 148 из старого файла макетов, когда все остальные
 *      вертикальные списки перешли на общий токен 206. Проверяются РЕАЛЬНЫЕ
 *      числа раскладки, а не снимок экрана.
 *
 * ЧЕГО ЭТОТ ТЕСТ НЕ ДОКАЗЫВАЕТ: самого ЖЕСТА. `RefreshControl` в
 * react-native-web — пустышка: ни оттянуть ленту, ни увидеть индикатор в jsdom
 * нельзя в принципе. Поэтому он подменён видимой кнопкой и подписью — так
 * проверяется, что экран действительно ОТДАЁТ в него свою пару значений.
 * Настоящее оттягивание пальцем проверяется на устройстве.
 */

const getPromotions = vi.fn<() => Promise<HomePromo[]>>();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: () => false }),
  usePathname: () => "/promotions",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
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

// Гость без сессии: лента акций городская и запрашивается и без входа.
vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-out", repository: { getMe: vi.fn(), updateMe: vi.fn() } }),
}));

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getPromotions }),
}));

const PromotionsScreen = (await import("../promotions")).default;

function promo(id: string): HomePromo {
  return {
    id,
    title: `Скидка ${id}`,
    restaurantId: "r1",
    restaurantName: "Ресторан",
    coverImageUrl: null,
    discountPercent: 20,
    startsAt: "2026-08-01T00:00:00Z",
    endsAt: "2026-09-01T00:00:00Z",
  } as HomePromo;
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PromotionsScreen />
    </QueryClientProvider>,
  );
}

async function pull() {
  const person = userEvent.setup();
  await person.click(await screen.findByRole("button", { name: "потянуть вниз" }));
}

/** Обещание, которым управляет тест: так проверяется, когда гаснет кружок. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  getPromotions.mockReset().mockResolvedValue([promo("a"), promo("b")]);
});

describe("«Акции»: потянуть вниз, чтобы обновить", () => {
  it("переспрашивает ленту акций и гасит кружок, когда пришёл ответ", async () => {
    renderScreen();

    await waitFor(() => expect(getPromotions).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("кружка нет")).toBeTruthy();

    const answer = deferred<HomePromo[]>();
    getPromotions.mockReturnValueOnce(answer.promise);

    await pull();

    await waitFor(() => expect(getPromotions).toHaveBeenCalledTimes(2));
    expect(screen.getByText("кружок крутится")).toBeTruthy();

    answer.resolve([promo("a")]);
    await waitFor(() => expect(screen.getByText("кружка нет")).toBeTruthy());
  });

  it("тянется и когда акций нет — кнопки «обновить» там нет нарочно", async () => {
    getPromotions.mockReset().mockResolvedValue([]);
    renderScreen();

    expect(await screen.findByText("Акций пока нет")).toBeTruthy();
    await waitFor(() => expect(getPromotions).toHaveBeenCalledTimes(1));

    await pull();

    await waitFor(() => expect(getPromotions).toHaveBeenCalledTimes(2));
  });
});

describe("«Акции»: верх списка", () => {
  it("лента не добавляет своих боковых полей — их держит карточка", async () => {
    renderScreen();

    const card = await screen.findByRole("button", { name: /Скидка a/ });
    // Контейнер содержимого ленты — родитель карточек.
    const listContent = card.parentElement;
    expect(listContent).toBeTruthy();
    const style = getComputedStyle(listContent as HTMLElement);

    // Первая карточка начинается сразу под шапкой, через один отступ 16 —
    // столько же, сколько в «Афише».
    expect(style.paddingTop).toBe(`${spacing.lg}px`);
    // Боковых полей у ленты нет: общий `padding: 16` складывался с отступами
    // карточки и отжимал фотографию от края экрана на 24 вместо 8.
    expect(style.paddingLeft).toBe("0px");
    expect(style.paddingRight).toBe("0px");
  });

  it("обложка акции той же высоты, что и во всех остальных списках", async () => {
    renderScreen();

    const cover = (await screen.findAllByTestId("photo-placeholder"))[0];
    expect(getComputedStyle(cover).height).toBe(`${listCard.coverHeight}px`);

    // Фотография отступает от края экрана на 8, как в «Афише» и в поиске.
    const coverWrap = cover.parentElement?.parentElement;
    expect(coverWrap).toBeTruthy();
    expect(getComputedStyle(coverWrap as HTMLElement).paddingLeft).toBe(`${spacing.sm}px`);
  });
});
