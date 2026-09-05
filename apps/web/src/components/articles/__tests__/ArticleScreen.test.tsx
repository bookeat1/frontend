import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { RepositoryError, type GuideCollectionDetail } from "@bookeat/api/client";

import { articleDetail, guideVenue, pending, renderScreen, repositoryStub } from "@web/test/harness";

/**
 * Страница статьи (узел 5033:7466). Главное — не спутать «404, статьи нет»
 * и «связь упала»: объяснения разные, и повторять 404 бессмысленно.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/articles/week-picks",
}));

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

const { ArticleScreen } = await import("@web/components/articles/ArticleScreen");

describe("страница статьи", () => {
  it("пока запрос летит — скелет и ссылка «Все статьи» уже на месте", () => {
    repository.getArticle = vi.fn(() => pending<GuideCollectionDetail>());
    renderScreen(<ArticleScreen slug="week-picks" />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Все статьи" }).getAttribute("href")).toBe("/articles");
  });

  it("статья: чип вида, заголовок, автор и блок заведения со ссылкой на заведение", async () => {
    repository.getArticle = vi.fn(async () => articleDetail());
    renderScreen(<ArticleScreen slug="week-picks" />);

    expect(await screen.findByRole("heading", { level: 1, name: "Куда сходить на неделе" })).toBeTruthy();
    expect(screen.getByText("Статья")).toBeTruthy();
    expect(screen.getByText("От BookEat")).toBeTruthy();
    expect(repository.getArticle).toHaveBeenCalledWith("week-picks");

    const block = within(screen.getByRole("list", { name: "Заведения из статьи" })).getByRole("listitem");
    expect(within(block).getByText("Событие")).toBeTruthy();
    expect(within(block).getByText("в Mongol Bar")).toBeTruthy();
    expect(within(block).getByText("Коктейльная среда")).toBeTruthy();
    expect(within(block).getByText("Курмангазы, 43 · @mongol.almaty")).toBeTruthy();
    const link = within(block).getByRole("link", { name: "Открыть заведение Mongol Bar" });
    expect(link.getAttribute("href")).toBe("/venues/r-mongol");
  });

  it("без подсветки блок берёт название и заметку заведения", async () => {
    repository.getArticle = vi.fn(async () =>
      articleDetail({ venues: [guideVenue({ highlight: null, note: "Лучшие завтраки" })] }),
    );
    renderScreen(<ArticleScreen slug="week-picks" />);

    const block = within(await screen.findByRole("list", { name: "Заведения из статьи" })).getByRole("listitem");
    expect(within(block).getByRole("link", { name: "Открыть заведение Mongol Bar" }).textContent).toBe("Mongol Bar");
    expect(within(block).getByText("Лучшие завтраки")).toBeTruthy();
    expect(within(block).queryByText("Событие")).toBeNull();
  });

  it("статья без блоков — кнопка к каталогу, чтобы не кончаться в никуда", async () => {
    repository.getArticle = vi.fn(async () => articleDetail({ venues: [], kind: "collection" }));
    renderScreen(<ArticleScreen slug="week-picks" />);

    const link = await screen.findByRole("link", { name: "Посмотреть заведения" });
    expect(link.getAttribute("href")).toBe("/venues");
    expect(screen.getByText("Подборка")).toBeTruthy();
  });

  it("404 — «не найдена» без кнопки повтора; запрос не повторяется", async () => {
    repository.getArticle = vi.fn(async () => {
      throw new RepositoryError("not found", undefined, 404);
    });
    renderScreen(<ArticleScreen slug="gone" />);

    expect(await screen.findByText("Подборка не найдена")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
    expect(repository.getArticle).toHaveBeenCalledTimes(1);
  });

  it("сбой сети — ошибка с «Повторить»", async () => {
    repository.getArticle = vi.fn(async () => {
      throw new Error("offline");
    });
    renderScreen(<ArticleScreen slug="week-picks" />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
  });
});
