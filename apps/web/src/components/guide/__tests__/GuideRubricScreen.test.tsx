import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { GuideCategory, GuideCollection, GuideCollectionDetail } from "@bookeat/api/client";

import {
  guideCategory,
  guideCollection,
  guideVenue,
  pending,
  renderScreen,
  repositoryStub,
} from "@web/test/harness";

/**
 * Страница одной рубрики (`/guide/rubric/[slug]`, Figma-узел 5078:5739) —
 * четыре состояния и правило «№1»/«ВЫБОР VISIT ALMATY» с макета НЕ рисуются
 * (ни рейтинга, ни отметки редакции в ответе API нет, решение владельца
 * 2026-08-28, то же самое на мобильном экране-близнеце).
 */

const stub = repositoryStub();
vi.mock("@web/lib/api", () => ({
  isApiConfigured: true,
  get repository() {
    return stub;
  },
  setApiLanguage: vi.fn(),
}));
vi.mock("@web/lib/city", async (importOriginal) => {
  const original = await importOriginal<typeof import("@web/lib/city")>();
  return {
    ...original,
    useCity: () => ({
      city: "Алматы",
      setCity: () => {},
      cities: ["Алматы"],
      isLoading: false,
      isError: false,
    }),
  };
});

async function loadScreen(slug = "kazakh-cuisine") {
  const { GuideRubricScreen } = await import("@web/components/guide/GuideRubricScreen");
  return renderScreen(<GuideRubricScreen slug={slug} />);
}

describe("страница рубрики гастрогида", () => {
  it("шапка и заведения рубрики, без «№1» и «ВЫБОР VISIT ALMATY»", async () => {
    stub.getGuideCollections = vi.fn(async () => [
      guideCollection({
        slug: "kazakh",
        title: "Казахская кухня",
        description: "Аутентичные вкусы степи.",
        categorySlugs: ["kazakh-cuisine"],
      }),
    ]);
    stub.getGuideCategories = vi.fn(async () => [
      guideCategory({ slug: "kazakh-cuisine", title: "Казахская кухня" }),
    ]);
    stub.getGuideCollection = vi.fn(async () => ({
      ...guideCollection({ slug: "kazakh", title: "Казахская кухня", categorySlugs: ["kazakh-cuisine"] }),
      venues: [
        guideVenue({ restaurantId: "r-1", name: "Chaihana Palau", cuisineType: "Казахская", priceCategory: "₸₸₸" }),
      ],
    }));

    await loadScreen();

    expect(await screen.findByRole("heading", { name: "Казахская кухня" })).toBeTruthy();
    expect(screen.getByText("Аутентичные вкусы степи.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Избранное редакции" })).toBeTruthy();
    expect(screen.getByText("Chaihana Palau")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Открыть «Chaihana Palau»" }).getAttribute("href")).toBe(
      "/venues/r-1",
    );
    expect(screen.getByText("Казахская · ₸₸₸")).toBeTruthy();
    expect(screen.queryByText("№1")).toBeNull();
    expect(screen.queryByText(/ВЫБОР/)).toBeNull();
  });

  it("загрузка: скелет с role=status", async () => {
    stub.getGuideCollections = vi.fn(() => pending<GuideCollection[]>());
    stub.getGuideCategories = vi.fn(() => pending<GuideCategory[]>());
    await loadScreen();
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });

  it("ошибка сети: сообщение и «Повторить»", async () => {
    stub.getGuideCollections = vi.fn(async () => {
      throw new Error("boom");
    });
    stub.getGuideCategories = vi.fn(async () => []);
    await loadScreen();

    expect(await screen.findByText("Не удалось загрузить")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
  });

  it("неизвестный слаг — «рубрика не найдена», а не ошибка сети", async () => {
    stub.getGuideCollections = vi.fn(async () => []);
    stub.getGuideCategories = vi.fn(async () => []);
    await loadScreen("no-such-rubric");

    expect(await screen.findByText("Рубрика не найдена")).toBeTruthy();
  });

  it("рубрика без заведений — пустое состояние секции", async () => {
    stub.getGuideCollections = vi.fn(async () => [
      guideCollection({ slug: "kazakh", title: "Казахская кухня", categorySlugs: ["kazakh-cuisine"] }),
    ]);
    stub.getGuideCategories = vi.fn(async () => []);
    stub.getGuideCollection = vi.fn(
      async (): Promise<GuideCollectionDetail> => ({
        ...guideCollection({ slug: "kazakh", title: "Казахская кухня", categorySlugs: ["kazakh-cuisine"] }),
        venues: [],
      }),
    );

    await loadScreen("kazakh-cuisine");

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(await screen.findByText("В рубрике пока пусто")).toBeTruthy();
  });
});
