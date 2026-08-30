import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

import type { SearchQuery, SearchResult } from "@bookeat/api/client";

import { pending, renderScreen, repositoryStub, venueSummary } from "@web/test/harness";

/**
 * Листинг проверяется по ЧЕТЫРЁМ состояниям и по одному поведению, которого
 * глазами не видно: клик по фильтру обязан менять аргументы запроса. Разметка
 * карточек не проверяется — её видно на экране, а «фильтр не доехал до
 * сервера» не видно никак.
 */

const replace = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
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
});

describe("листинг заведений", () => {
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
