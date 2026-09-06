import type { PlatformPageAdmin, PlatformPageInput } from "@bookeat/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * «Страницы сайта» (T4) — простой markdown-редактор без черновика: `PUT`
 * сохраняет `title`/`body` немедленно, и это ровно то, что панель обязана
 * делать, не подсовывая суперадмину лишний шаг «опубликовать».
 */

const auth = { role: "admin" as string, token: "t" as string | null };
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "u-1", role: auth.role }, token: auth.token }),
}));

const { SitePagesView } = await import("../SitePagesView");

function makePage(overrides: Partial<PlatformPageAdmin> = {}): PlatformPageAdmin {
  return {
    slug: "offer",
    title: "Оферта",
    body: "Текст оферты.",
    published_at: "2026-08-01T10:00:00Z",
    ...overrides,
  };
}

function makeClient(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    listPlatformPages: vi.fn(async () => [
      makePage({ slug: "about", title: "О BookEat" }),
      makePage({ slug: "jobs", title: "Вакансии", published_at: null }),
      makePage({ slug: "contacts", title: "Контакты" }),
      makePage({ slug: "how-it-works", title: "Как это работает" }),
      makePage({ slug: "cancellation", title: "Отмена брони" }),
      makePage({ slug: "offer", title: "Оферта" }),
      makePage({ slug: "privacy", title: "Политика данных" }),
    ]),
    getPlatformPage: vi.fn(async () => makePage()),
    updatePlatformPage: vi.fn(async (_slug: string, input: PlatformPageInput) =>
      makePage({ title: input.title, body: input.body }),
    ),
    ...overrides,
  };
}

function renderView(client: ReturnType<typeof makeClient>, slug: Parameters<typeof SitePagesView>[0]["slug"] = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SitePagesView slug={slug} client={client} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth.role = "admin";
  auth.token = "t";
});

afterEach(cleanup);

describe("страницы сайта — доступ", () => {
  it("управляющий заведения видит «нет прав», запрос не уходит", () => {
    auth.role = "restaurant";
    const client = makeClient();
    renderView(client);

    expect(screen.getByText("Раздел только для администраторов платформы")).toBeTruthy();
    expect(client.listPlatformPages).not.toHaveBeenCalled();
  });
});

describe("страницы сайта — список", () => {
  it("рисует все семь строк с их статусом, даже если сервер прислал их не по порядку", async () => {
    const client = makeClient();
    renderView(client);

    expect((await screen.findAllByText("Опубликовано")).length).toBe(6);
    // Все семь подписей на месте.
    for (const label of [
      "О BookEat",
      "Вакансии",
      "Контакты",
      "Как это работает",
      "Отмена брони",
      "Оферта",
      "Политика данных",
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // «Вакансии» не опубликованы (published_at: null в фикстуре).
    const jobsRow = screen.getByText("Вакансии").closest("li");
    expect(jobsRow).not.toBeNull();
    expect(jobsRow?.textContent).toContain("Черновик");
  });

  it("ссылка «Открыть» ведёт на ?page=<slug>", async () => {
    const client = makeClient();
    renderView(client);

    await screen.findByText("О BookEat");
    const aboutRow = screen.getByText("О BookEat").closest("li")!;
    const link = aboutRow.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("/site-pages?page=about");
  });
});

describe("страницы сайта — редактор", () => {
  it("сохраняет ровно {title, body} через PUT, без переводов и без флага публикации", async () => {
    const client = makeClient();
    renderView(client, "offer");

    const titleInput = await screen.findByLabelText(/^Заголовок/);
    expect((titleInput as HTMLInputElement).value).toBe("Оферта");

    fireEvent.change(titleInput, { target: { value: "Публичная оферта" } });
    fireEvent.change(screen.getByLabelText(/Текст \(Markdown\)/), {
      target: { value: "## Раздел 1\n\nТекст оферты." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(client.updatePlatformPage).toHaveBeenCalledTimes(1));
    expect(client.updatePlatformPage).toHaveBeenCalledWith("offer", {
      title: "Публичная оферта",
      body: "## Раздел 1\n\nТекст оферты.",
    });
  });

  it("предпросмотр — тот же Markdown-рендерер: ## становится h2", async () => {
    const client = makeClient({
      getPlatformPage: vi.fn(async () => makePage({ body: "## Заголовок предпросмотра" })),
    });
    renderView(client, "offer");

    expect(await screen.findByRole("heading", { level: 2, name: "Заголовок предпросмотра" })).toBeTruthy();
  });

  it("отказ сохранения не стирает введённый текст", async () => {
    const client = makeClient({
      updatePlatformPage: vi.fn(async () => {
        throw Object.assign(new Error("forbidden"), { status: 403 });
      }),
    });
    renderView(client, "offer");

    const titleInput = await screen.findByLabelText(/^Заголовок/);
    fireEvent.change(titleInput, { target: { value: "Новый заголовок" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((titleInput as HTMLInputElement).value).toBe("Новый заголовок");
  });

  it("пустой заголовок — клиентская проверка, запрос не уходит", async () => {
    const client = makeClient();
    renderView(client, "offer");

    const titleInput = await screen.findByLabelText(/^Заголовок/);
    fireEvent.change(titleInput, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(client.updatePlatformPage).not.toHaveBeenCalled();
  });
});
