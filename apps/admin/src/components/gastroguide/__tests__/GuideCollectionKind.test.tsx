import type {
  GuideCollection,
  GuideCollectionDetail,
  GuideCollectionInput,
  GuideCollectionListParams,
} from "@bookeat/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ЧТО ЭТОТ ФАЙЛ ДЕРЖИТ: панель умеет заводить ОБЕ сущности, и вид записи
 * берётся из РАЗДЕЛА, а не из выбора редактора (2026-08-28).
 *
 * Разделение статей и подборок сделано на бэкенде колонкой `kind`. Если панель
 * про неё не знает, разделение существует только на сервере: редактор
 * по-прежнему создаёт «что-то одно», оно молча становится подборкой
 * (`kind` по умолчанию), и раздел «Статьи» в приложении остаётся пустым — при
 * том что редактор уверен, что статью он написал.
 *
 * Три вещи ломаются тихо и держатся здесь:
 *   1. экран статей просит у сервера ТОЛЬКО статьи (`?kind=article`), а не
 *      фильтрует общий ответ;
 *   2. создание с экрана статей уходит с `kind: "article"`, с экрана
 *      гастрогида — с `kind: "collection"`;
 *   3. на статье НЕТ подборщика рубрик: у статьи рубрик не бывает, и сервер
 *      отвечает на такую пару 422 — показывать переключатели, каждый из
 *      которых вернёт ошибку, нельзя.
 */

vi.mock("@/lib/use-cities", () => ({
  useCityDictionary: () => ({ data: [], isPending: false, isError: false }),
}));

const { GuideCollectionsView } = await import("../GuideCollectionsView");
const { GuideCollectionDetailView } = await import("../GuideCollectionDetailView");

const listGuideCollections = vi.fn<(p?: GuideCollectionListParams) => Promise<unknown>>();
const createGuideCollection = vi.fn<(input: GuideCollectionInput) => Promise<GuideCollection>>();

function row(over: Partial<GuideCollection> = {}): GuideCollection {
  return {
    id: "gc-1",
    slug: "almaty-longread",
    kind: "article",
    title: "Сейчас Алматы ест невероятно хорошо",
    subtitle: "",
    description: "",
    cover_image_url: null,
    city: null,
    status: "draft",
    published_at: null,
    position: 0,
    venue_count: 1,
    category_slugs: [],
    updated_at: "2026-08-28T10:00:00Z",
    ...over,
  };
}

function renderList(kind: "collection" | "article") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GuideCollectionsView
        kind={kind}
        client={{ listGuideCollections, createGuideCollection } as never}
      />
    </QueryClientProvider>,
  );
}

/** Заполняет обязательные поля формы и жмёт «Сохранить». */
function submitNew(title: string, slug: string) {
  fireEvent.change(screen.getByLabelText(/^Заголовок/), { target: { value: title } });
  fireEvent.change(screen.getByLabelText(/^Слаг/), { target: { value: slug } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
}

beforeEach(() => {
  listGuideCollections.mockReset().mockResolvedValue({ items: [row()], total: 1 });
  createGuideCollection.mockReset().mockResolvedValue(row());
});

afterEach(cleanup);

describe("панель: статьи и подборки гастрогида — разные разделы", () => {
  it("экран статей просит у сервера только статьи", async () => {
    renderList("article");

    await waitFor(() => expect(listGuideCollections).toHaveBeenCalled());
    expect(listGuideCollections.mock.calls[0][0]?.kind).toBe("article");
  });

  it("экран гастрогида просит у сервера только подборки", async () => {
    renderList("collection");

    await waitFor(() => expect(listGuideCollections).toHaveBeenCalled());
    expect(listGuideCollections.mock.calls[0][0]?.kind).toBe("collection");
  });

  it("создание с экрана статей уходит с kind: \"article\"", async () => {
    renderList("article");

    await waitFor(() => expect(listGuideCollections).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Новая статья" }));
    submitNew("Манифест третьей волны", "coffee-manifest");

    await waitFor(() => expect(createGuideCollection).toHaveBeenCalled());
    expect(createGuideCollection.mock.calls[0][0].kind).toBe("article");
    expect(createGuideCollection.mock.calls[0][0].slug).toBe("coffee-manifest");
  });

  it("создание с экрана гастрогида по-прежнему заводит подборку", async () => {
    renderList("collection");

    await waitFor(() => expect(listGuideCollections).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Новая подборка" }));
    submitNew("Казахская кухня", "kazakh-cuisine");

    await waitFor(() => expect(createGuideCollection).toHaveBeenCalled());
    expect(createGuideCollection.mock.calls[0][0].kind).toBe("collection");
  });

  it("«Открыть» ведёт в свой раздел, а не в чужой", async () => {
    renderList("article");

    const link = await screen.findByRole("link", { name: "Открыть" });
    expect(link.getAttribute("href")).toBe("/articles?collection=gc-1");
  });
});

/* --- подборщик рубрик --- */

function detail(kind: "collection" | "article"): GuideCollectionDetail {
  return { ...row({ kind }), venues: [], categories: [] };
}

function renderDetail(kind: "collection" | "article") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const detailClient = {
    getGuideCollection: vi.fn().mockResolvedValue(detail(kind)),
    listGuideCategories: vi
      .fn()
      .mockResolvedValue([
        { id: "cat-1", slug: "kazakh", title: "Казахская кухня", position: 1, is_active: true },
      ]),
    searchVenues: vi.fn().mockResolvedValue({ items: [] }),
  };
  render(
    <QueryClientProvider client={client}>
      <GuideCollectionDetailView collectionId="gc-1" client={detailClient as never} />
    </QueryClientProvider>,
  );
  return detailClient;
}

describe("панель: рубрики есть только у подборки", () => {
  it("у статьи подборщика рубрик нет вовсе", async () => {
    renderDetail("article");

    // Ждём загрузки самой записи, иначе проверка поймала бы момент до неё.
    await screen.findByRole("heading", { name: /Сейчас Алматы ест невероятно хорошо/ });
    expect(screen.queryByRole("heading", { name: "Рубрики" })).toBeNull();
    expect(screen.queryByLabelText("Казахская кухня")).toBeNull();
    // И возвращает статья в СВОЙ раздел.
    expect(screen.getByRole("link", { name: /К списку статей/ }).getAttribute("href")).toBe(
      "/articles",
    );
  });

  it("у подборки подборщик рубрик на месте", async () => {
    renderDetail("collection");

    expect(await screen.findByRole("heading", { name: "Рубрики" })).toBeTruthy();
    expect(screen.getByLabelText("Казахская кухня")).toBeTruthy();
    expect(screen.getByRole("link", { name: /К списку подборок/ }).getAttribute("href")).toBe(
      "/gastroguide",
    );
  });
});
