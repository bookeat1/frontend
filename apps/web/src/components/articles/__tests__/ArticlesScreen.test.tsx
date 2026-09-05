import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import { guideCollection, pending, renderScreen, repositoryStub } from "@web/test/harness";

/**
 * Список статей (узел 5033:7382): четыре состояния и ссылка карточки на
 * `/articles/:slug`. Данные — `listArticles`, а не `getGuideCollections`:
 * экран не должен показывать подборки гастрогида.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/articles",
}));

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

const { ArticlesScreen } = await import("@web/components/articles/ArticlesScreen");

describe("список статей", () => {
  it("пока запрос летит — скелет со статусом загрузки", () => {
    repository.listArticles = vi.fn(() => pending());
    renderScreen(<ArticlesScreen />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(repository.getGuideCollections).not.toHaveBeenCalled();
  });

  it("карточки ведут на /articles/:slug и подписаны «От BookEat»", async () => {
    repository.listArticles = vi.fn(async () => [
      guideCollection({ slug: "week-picks", kind: "article", title: "Куда сходить на неделе" }),
      guideCollection({ slug: "coffee", kind: "article", title: "Кофейни, ради которых стоит ехать" }),
    ]);
    renderScreen(<ArticlesScreen />);

    const link = await screen.findByRole("link", { name: "Куда сходить на неделе" });
    expect(link.getAttribute("href")).toBe("/articles/week-picks");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByText("От BookEat")).toHaveLength(2);
  });

  it("пустой ответ — спокойное «Пока нет статей», без ошибки", async () => {
    repository.listArticles = vi.fn(async () => []);
    renderScreen(<ArticlesScreen />);

    expect(await screen.findByText("Пока нет статей")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("сбой сети — ошибка с кнопкой «Повторить», которая перезапрашивает", async () => {
    repository.listArticles = vi.fn(async () => {
      throw new Error("offline");
    });
    renderScreen(<ArticlesScreen />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Повторить" });
    retry.click();
    expect(repository.listArticles).toHaveBeenCalledTimes(2);
  });
});
