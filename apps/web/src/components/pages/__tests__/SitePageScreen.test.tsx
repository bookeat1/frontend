import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { RepositoryError, type PlatformPage } from "@bookeat/api/client";

import { pending, renderScreen, repositoryStub, sitePage } from "@web/test/harness";

/**
 * Одна из семи текстовых страниц (T4, `GET /pages/:slug`). Главное — не
 * спутать «не опубликована» (404) с «пропала связь»: тексты и поведение
 * разные, а повторять 404 бессмысленно.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/offer",
}));

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

const { SitePageScreen } = await import("@web/components/pages/SitePageScreen");

describe("страница текстового раздела платформы", () => {
  it("пока запрос летит — скелет", () => {
    repository.getPage = vi.fn(() => pending<PlatformPage>());
    renderScreen(<SitePageScreen slug="offer" />);

    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("успех — заголовок и текст страницы, запрос ушёл с правильным слагом", async () => {
    repository.getPage = vi.fn(async () => sitePage({ slug: "offer", title: "Оферта" }));
    renderScreen(<SitePageScreen slug="offer" />);

    expect(await screen.findByRole("heading", { level: 1, name: "Оферта" })).toBeTruthy();
    expect(screen.getByText("Текст публичной оферты.")).toBeTruthy();
    expect(repository.getPage).toHaveBeenCalledWith("offer");
  });

  it("markdown тела рендерится через общий компонент — заголовок раздела становится h2", async () => {
    repository.getPage = vi.fn(async () =>
      sitePage({ slug: "privacy", title: "Политика данных", body: "## Сбор данных\n\nТекст." }),
    );
    renderScreen(<SitePageScreen slug="privacy" />);

    expect(await screen.findByRole("heading", { level: 2, name: "Сбор данных" })).toBeTruthy();
  });

  it("404 (не опубликована) — «страница не найдена», без повтора запроса", async () => {
    repository.getPage = vi.fn(async () => {
      throw new RepositoryError("not found", undefined, 404);
    });
    renderScreen(<SitePageScreen slug="jobs" />);

    expect(await screen.findByText("Страница не найдена")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
    expect(screen.getByRole("link", { name: "На главную" }).getAttribute("href")).toBe("/");
    expect(repository.getPage).toHaveBeenCalledTimes(1);
  });

  it("сбой сети — ошибка с «Повторить»", async () => {
    repository.getPage = vi.fn(async () => {
      throw new Error("offline");
    });
    renderScreen(<SitePageScreen slug="contacts" />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
  });
});
