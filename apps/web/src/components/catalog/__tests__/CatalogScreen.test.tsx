import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import type { SearchQuery, SearchResult } from "@bookeat/api/client";

import { pending, renderScreen, repositoryStub, venueSummary } from "@web/test/harness";

/**
 * Листинг проверяется по ЧЕТЫРЁМ состояниям и по одному поведению, которого
 * глазами не видно: клик по фильтру обязан менять аргументы запроса. Разметка
 * карточек не проверяется — её видно на экране, а «фильтр не доехал до
 * сервера» не видно никак.
 */

const replace = vi.fn();
const push = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push, prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

const { CatalogScreen } = await import("@web/components/catalog/CatalogScreen");

/** Последний запрос, ушедший в репозиторий. Именно последний: пока едет список
 * городов, экран успевает спросить выдачу и без города. */
function lastQuery(fn: { mock: { calls: unknown[][] } }): SearchQuery {
  return fn.mock.calls[fn.mock.calls.length - 1][0] as SearchQuery;
}

beforeEach(() => {
  search = "";
  replace.mockClear();
  push.mockClear();
});

describe("листинг заведений", () => {
  it("сердце на карточке ведёт гостя без входа на вход, а не молчит", async () => {
    repository.searchRestaurants = vi.fn(async (query) => ({
      query,
      items: [venueSummary()],
      total: 1,
    }));

    renderScreen(<CatalogScreen />);

    const heart = await screen.findByRole("button", { name: "Избранное" });
    fireEvent.click(heart);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    // И в сеть за избранным никто не ходил: ручка требует сессию.
    expect(repository.addFavorite).not.toHaveBeenCalled();
  });

  it("особенности раскрываются ПО КЛИКУ, а не лежат списком целиком", async () => {
    // Семь удобств в справочнике: пять видно сразу, остальные — по кнопке.
    repository.getAmenities = vi.fn(async () => [
      { id: "terrace", name: "Терраса" },
      { id: "parking", name: "Парковка" },
      { id: "music", name: "Живая музыка" },
      { id: "kids", name: "Детская зона" },
      { id: "namazhana", name: "Namazhana" },
      { id: "veranda", name: "Веранда с видом" },
      { id: "banquet", name: "Банкетный зал" },
    ]);

    renderScreen(<CatalogScreen />);

    expect(await screen.findByLabelText("Терраса")).toBeTruthy();
    expect(screen.queryByLabelText("Банкетный зал")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Показать все 7" }));

    expect(screen.getByLabelText("Банкетный зал")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Свернуть" })).toBeTruthy();
  });

  it("кнопки нет, когда сворачивать нечего: отмеченное не занимает лимит", async () => {
    // Шесть особенностей, отмечена шестая. Все шесть и так на экране, поэтому
    // «Показать все 6» было бы кнопкой, которая по нажатию меняет только
    // собственную надпись.
    search = "features=namazhana";
    repository.getAmenities = vi.fn(async () => [
      { id: "terrace", name: "Терраса" },
      { id: "parking", name: "Парковка" },
      { id: "music", name: "Живая музыка" },
      { id: "kids", name: "Детская зона" },
      { id: "veranda", name: "Веранда с видом" },
      { id: "namazhana", name: "Namazhana" },
    ]);

    renderScreen(<CatalogScreen />);

    expect(await screen.findByLabelText("Namazhana")).toBeTruthy();
    expect(screen.getByLabelText("Веранда с видом")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Показать все/ })).toBeNull();
  });

  it("лимит считает только НЕотмеченные строки", async () => {
    // Отмечены две первые. Раньше они съедали два места из пяти, и «Терраса 7»
    // с «Террасой 8» прятались вместе с двумя честными кандидатами.
    search = "features=a,b";
    repository.getAmenities = vi.fn(async () =>
      ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => ({ id, name: `Особенность ${id}` })),
    );

    renderScreen(<CatalogScreen />);

    // Две отмеченные сверх лимита плюс пять неотмеченных.
    expect(await screen.findByLabelText("Особенность a")).toBeTruthy();
    expect(screen.getByLabelText("Особенность b")).toBeTruthy();
    expect(screen.getByLabelText("Особенность g")).toBeTruthy();
    // Восьмая — единственная спрятанная.
    expect(screen.queryByLabelText("Особенность h")).toBeNull();
    expect(screen.getByRole("button", { name: "Показать все 8" })).toBeTruthy();
  });

  it("выбранная особенность видна и в свёрнутом списке", async () => {
    // Иначе снять фильтр было бы нечем: чекбокс есть, а на экране его нет.
    search = "features=banquet";
    repository.getAmenities = vi.fn(async () => [
      { id: "terrace", name: "Терраса" },
      { id: "parking", name: "Парковка" },
      { id: "music", name: "Живая музыка" },
      { id: "kids", name: "Детская зона" },
      { id: "namazhana", name: "Namazhana" },
      { id: "veranda", name: "Веранда с видом" },
      { id: "banquet", name: "Банкетный зал" },
    ]);

    renderScreen(<CatalogScreen />);

    const checked = await screen.findByLabelText("Банкетный зал");
    expect((checked as HTMLInputElement).checked).toBe(true);
  });

  it("пока запрос летит, показывает загрузку, а не пустую выдачу", async () => {
    repository.searchRestaurants = vi.fn(() => pending<SearchResult>());

    renderScreen(<CatalogScreen />);

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.queryByText("Ничего не нашлось")).toBeNull();
  });

  it("пустой ответ объясняется словами и даёт сбросить фильтры", async () => {
    search = "features=terrace";
    repository.searchRestaurants = vi.fn(async (query) => ({ query, items: [], total: 0 }));

    renderScreen(<CatalogScreen />);

    expect(await screen.findByText("Ничего не нашлось")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    expect(replace).toHaveBeenCalledWith("/venues", { scroll: false });
  });

  it("упавшая сеть — это ошибка с кнопкой «Повторить», а не вечная загрузка", async () => {
    repository.searchRestaurants = vi.fn(async () => {
      throw new Error("network down");
    });

    renderScreen(<CatalogScreen />);

    expect(await screen.findByText("Не удалось загрузить")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
  });

  it("рисует найденные заведения и ведёт на их страницы", async () => {
    repository.searchRestaurants = vi.fn(async (query) => ({
      query,
      items: [venueSummary({ id: "abc", name: "Auyl" })],
      total: 1,
    }));

    renderScreen(<CatalogScreen />);

    const link = await screen.findByRole("link", { name: "Auyl" });
    expect(link.getAttribute("href")).toBe("/venues/abc");
  });

  it("хлебные крошки ведут «Главная / город / Заведения» — с городом выдачи", async () => {
    renderScreen(<CatalogScreen />);

    const nav = await screen.findByRole("navigation", { name: "Путь по сайту" });
    await waitFor(() => expect(nav.textContent).toBe("Главная / Алматы / Заведения"));
    expect(within(nav).getByRole("link", { name: "Главная" }).getAttribute("href")).toBe("/");
  });

  it("галочка кухни МЕНЯЕТ запрос к серверу, а не только вид чипа", async () => {
    repository.getCuisines = vi.fn(async () => [{ id: "kazakh", name: "Казахская" }]);
    const searchRestaurants = vi.fn(async (query) => ({ query, items: [], total: 0 }));
    repository.searchRestaurants = searchRestaurants;

    renderScreen(<CatalogScreen />);

    // Первый запрос уходит ещё без города (список городов сам едет запросом),
    // и как только город приезжает — выдача перезапрашивается уже с ним.
    await waitFor(() => {
      expect(lastQuery(searchRestaurants).filters.city).toBe("Алматы");
    });
    expect(lastQuery(searchRestaurants).filters.cuisineIds).toEqual([]);

    fireEvent.click(await screen.findByRole("checkbox", { name: "Казахская" }));

    // Экран не хранит фильтры у себя: он переписывает адрес, и уже адрес
    // становится новым запросом. Проверяем именно это.
    expect(replace).toHaveBeenCalledWith("/venues?cuisine=kazakh", { scroll: false });

    // А с новым адресом в запрос уходит выбранная кухня.
    search = "cuisine=kazakh";
    searchRestaurants.mockClear();
    renderScreen(<CatalogScreen />);
    await waitFor(() => {
      expect(lastQuery(searchRestaurants).filters.cuisineIds).toEqual(["kazakh"]);
    });
  });

  it("сортировка «по рейтингу» переставляет карточки, а не перезапрашивает сервер", async () => {
    search = "sort=rating";
    repository.searchRestaurants = vi.fn(async (query) => ({
      query,
      items: [
        venueSummary({ id: "low", name: "Тише", rating: 3.9 }),
        venueSummary({ id: "high", name: "Лучше", rating: 4.9 }),
      ],
      total: 2,
    }));

    renderScreen(<CatalogScreen />);

    const headings = await screen.findAllByRole("heading", { level: 3 });
    expect(headings.map((node) => node.textContent)).toEqual(["Лучше", "Тише"]);
  });
});

/**
 * Ниже `lg` фильтры живут в шторке за кнопкой «Фильтры» — как в приложении
 * (`apps/mobile/app/__tests__/search-filter-panel-closed.test.tsx`). jsdom не
 * знает брейкпоинтов, поэтому проверяется не «что видно», а поведение:
 * шторка закрыта до нажатия, внутри неё ЧЕРНОВИК, и в адрес он уходит только
 * по «Применить».
 */
describe("шторка фильтров ниже lg", () => {
  it("открывается только кнопкой и показывает список фильтров, не адрес", async () => {
    repository.getCuisines = vi.fn(async () => [{ id: "kazakh", name: "Казахская" }]);
    renderScreen(<CatalogScreen />);

    expect(screen.queryByRole("dialog")).toBeNull();

    // Имя кнопки без счётчика, пока ничего не выбрано.
    fireEvent.click(screen.getByRole("button", { name: "Открыть фильтры" }));

    const dialog = await screen.findByRole("dialog", { name: "Фильтры" });
    expect(await within(dialog).findByRole("checkbox", { name: "Казахская" })).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("галочка в шторке — черновик: адрес меняется только по «Применить»", async () => {
    repository.getCuisines = vi.fn(async () => [{ id: "kazakh", name: "Казахская" }]);
    renderScreen(<CatalogScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Открыть фильтры" }));
    const dialog = await screen.findByRole("dialog", { name: "Фильтры" });

    fireEvent.click(await within(dialog).findByRole("checkbox", { name: "Казахская" }));
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Применить" }));

    expect(replace).toHaveBeenCalledWith("/venues?cuisine=kazakh", { scroll: false });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("закрыть крестиком — отмена: черновик не уходит в адрес", async () => {
    repository.getCuisines = vi.fn(async () => [{ id: "kazakh", name: "Казахская" }]);
    renderScreen(<CatalogScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Открыть фильтры" }));
    const dialog = await screen.findByRole("dialog", { name: "Фильтры" });
    fireEvent.click(await within(dialog).findByRole("checkbox", { name: "Казахская" }));

    fireEvent.click(within(dialog).getByRole("button", { name: "Закрыть" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(replace).not.toHaveBeenCalled();
  });

  it("кнопка называет число выбранных, а «Сбросить» в шторке чистит черновик", async () => {
    search = "cuisine=kazakh&features=terrace";
    repository.getCuisines = vi.fn(async () => [{ id: "kazakh", name: "Казахская" }]);
    repository.getAmenities = vi.fn(async () => [{ id: "terrace", name: "Терраса" }]);
    renderScreen(<CatalogScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Открыть фильтры, выбрано: 2" }));
    const dialog = await screen.findByRole("dialog", { name: "Фильтры" });
    const kazakh = await within(dialog).findByRole<HTMLInputElement>("checkbox", {
      name: "Казахская",
    });
    expect(kazakh.checked).toBe(true);

    fireEvent.click(within(dialog).getByRole("button", { name: "Сбросить" }));
    expect(kazakh.checked).toBe(false);
    // Сброс черновика — ещё не сброс адреса.
    expect(replace).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Применить" }));
    expect(replace).toHaveBeenCalledWith("/venues", { scroll: false });
  });
});
