import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AdminMenuItem } from "@bookeat/api/admin";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Миниатюры в списке меню.
 *
 * Экран нужен управляющему, чтобы за один проход глазами найти блюда БЕЗ
 * фотографии. Поэтому закрепляем три вещи: картинка показывается; её
 * отсутствие выглядит как подписанная плашка, а не как пустое место; битая
 * ссылка (R2 отдаёт на удалённый объект голый 404 text/plain) приводит РОВНО к
 * той же плашке — не к иконке сломанной картинки и не к дыре в строке.
 */

const listMenu = vi.fn();

vi.mock("@/lib/api", () => ({
  apiClient: {
    listMenu: (...args: unknown[]) => listMenu(...args),
    setMenuItemAvailability: vi.fn(),
    setStopList: vi.fn(),
  },
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ restaurant: { id: "r-1" } }) }));

const { MenuView } = await import("../MenuView");

function item(over: Partial<AdminMenuItem> = {}): AdminMenuItem {
  return {
    id: "m-1",
    restaurant_id: "r-1",
    name: "Бешбармак",
    description: "",
    price: "4500",
    image_url: null,
    is_available: true,
    category: "Горячее",
    subcategory: null,
    portion_size: null,
    display_order: 1,
    tags: [],
    ...over,
  };
}

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MenuView />
    </QueryClientProvider>,
  );
}

beforeEach(() => listMenu.mockReset());
afterEach(cleanup);

describe("миниатюры блюд в меню", () => {
  it("у блюда с фото показывает саму картинку", async () => {
    listMenu.mockResolvedValue([
      item({ id: "m-1", name: "Бешбармак", image_url: "https://pub-x.r2.dev/menu/besh.jpg" }),
    ]);

    renderScreen();

    const img = await screen.findByRole<HTMLImageElement>("img", { name: "Бешбармак" });
    expect(img.tagName).toBe("IMG");
    expect(img.src).toBe("https://pub-x.r2.dev/menu/besh.jpg");
    // Оригиналы в бакете неуменьшенные: то, что не видно, не качаем.
    expect(img.getAttribute("loading")).toBe("lazy");
  });

  it("у блюда без фото показывает подписанную плашку на том же месте", async () => {
    listMenu.mockResolvedValue([item({ id: "m-2", name: "Плов", image_url: null })]);

    renderScreen();

    expect(await screen.findByText("Плов")).toBeTruthy();
    const placeholder = screen.getByRole("img", { name: "Нет фото" });
    expect(placeholder.tagName).not.toBe("IMG");
    expect(placeholder.textContent).toBe("Нет фото");
    expect(screen.queryByRole("img", { name: "Плов" })).toBeNull();
  });

  it("пустая строка в image_url — это тоже «фото нет»", async () => {
    listMenu.mockResolvedValue([item({ id: "m-3", name: "Лагман", image_url: "   " })]);

    renderScreen();

    expect(await screen.findByRole("img", { name: "Нет фото" })).toBeTruthy();
  });

  it("битая ссылка даёт ту же плашку, а не дыру и не сломанную картинку", async () => {
    listMenu.mockResolvedValue([
      item({ id: "m-4", name: "Манты", image_url: "https://pub-x.r2.dev/menu/gone.jpg" }),
    ]);

    renderScreen();

    const img = await screen.findByRole("img", { name: "Манты" });
    fireEvent.error(img);

    await waitFor(() => expect(screen.getByRole("img", { name: "Нет фото" })).toBeTruthy());
    expect(screen.queryByRole("img", { name: "Манты" })).toBeNull();
    // Строка осталась целой: название и цена на месте.
    expect(screen.getByText("Манты")).toBeTruthy();
  });

  it("в списке из двух блюд плашка ровно одна — по ней и видно пробел", async () => {
    listMenu.mockResolvedValue([
      item({ id: "m-5", name: "Шубат", image_url: "https://pub-x.r2.dev/menu/shubat.jpg" }),
      item({ id: "m-6", name: "Курт", image_url: null }),
    ]);

    renderScreen();

    expect(await screen.findByText("Курт")).toBeTruthy();
    expect(screen.getAllByRole("img", { name: "Нет фото" })).toHaveLength(1);
    expect(screen.getAllByRole("img", { name: "Шубат" })).toHaveLength(1);
  });
});
