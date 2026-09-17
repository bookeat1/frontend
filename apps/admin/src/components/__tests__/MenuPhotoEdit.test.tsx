import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AdminMenuItem } from "@bookeat/api/admin";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Правка фото блюда прямо из «Меню» — до этой задачи такой кнопки не было
 * вовсе (не баг, никогда не реализованная функция).
 *
 * Закрепляем: кнопка «Изменить» у каждого блюда открывает форму с текущим
 * фото (или пустую, если фото нет); сохранение зовёт apiClient.updateMenuItem
 * ровно с {image_url}, закрывает форму и перечитывает список; отказ сервера
 * держит форму открытой с тем, что человек уже ввёл (см. правило «keep input
 * on failure»).
 */

const listMenu = vi.fn();
const updateMenuItem = vi.fn();
const uploadImage = vi.fn();

vi.mock("@/lib/api", () => ({
  apiClient: {
    listMenu: (...args: unknown[]) => listMenu(...args),
    listMenuTopPicks: vi.fn().mockResolvedValue([]),
    setMenuItemAvailability: vi.fn(),
    setStopList: vi.fn(),
    updateMenuItem: (...args: unknown[]) => updateMenuItem(...args),
    uploadImage: (...args: unknown[]) => uploadImage(...args),
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

beforeEach(() => {
  listMenu.mockReset();
  updateMenuItem.mockReset();
  uploadImage.mockReset();
});
afterEach(cleanup);

describe("правка фото блюда", () => {
  it("кнопка «Изменить» есть у каждого блюда и открывает форму с текущим фото", async () => {
    listMenu.mockResolvedValue([
      item({ id: "m-1", name: "Бешбармак", image_url: "https://pub-x.r2.dev/menu/besh.jpg" }),
    ]);

    renderScreen();

    const editButton = await screen.findByRole("button", { name: "Изменить фото: Бешбармак" });
    fireEvent.click(editButton);

    expect(await screen.findByRole("heading", { name: 'Фото блюда «Бешбармак»' })).toBeTruthy();
    const urlInput = screen.getByLabelText("Или вставьте ссылку") as HTMLInputElement;
    expect(urlInput.value).toBe("https://pub-x.r2.dev/menu/besh.jpg");
  });

  it("у блюда без фото форма открывается пустой", async () => {
    listMenu.mockResolvedValue([item({ id: "m-2", name: "Плов", image_url: null })]);

    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Изменить фото: Плов" }));

    const urlInput = (await screen.findByLabelText(
      "Или вставьте ссылку",
    )) as HTMLInputElement;
    expect(urlInput.value).toBe("");
  });

  it("сохранение шлёт updateMenuItem ровно с image_url, закрывает форму и обновляет список", async () => {
    listMenu.mockResolvedValueOnce([item({ id: "m-3", name: "Манты", image_url: null })]);
    listMenu.mockResolvedValueOnce([
      item({ id: "m-3", name: "Манты", image_url: "https://pub-x.r2.dev/menu/manty.jpg" }),
    ]);
    updateMenuItem.mockResolvedValue(
      item({ id: "m-3", name: "Манты", image_url: "https://pub-x.r2.dev/menu/manty.jpg" }),
    );

    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Изменить фото: Манты" }));
    const urlInput = await screen.findByLabelText("Или вставьте ссылку");
    fireEvent.change(urlInput, { target: { value: "https://pub-x.r2.dev/menu/manty.jpg" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() =>
      expect(updateMenuItem).toHaveBeenCalledWith("r-1", "m-3", {
        image_url: "https://pub-x.r2.dev/menu/manty.jpg",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: 'Фото блюда «Манты»' })).toBeNull(),
    );
    expect(listMenu).toHaveBeenCalledTimes(2);
  });

  it("отказ сервера держит форму открытой с уже введённым URL", async () => {
    listMenu.mockResolvedValue([item({ id: "m-4", name: "Лагман", image_url: null })]);
    updateMenuItem.mockRejectedValue(new Error("boom"));

    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Изменить фото: Лагман" }));
    const urlInput = await screen.findByLabelText("Или вставьте ссылку");
    fireEvent.change(urlInput, { target: { value: "https://pub-x.r2.dev/menu/lagman.jpg" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Не удалось сохранить фото — попробуйте ещё раз");
    // Форма осталась открытой, ввод не потерян.
    expect(screen.getByRole("heading", { name: 'Фото блюда «Лагман»' })).toBeTruthy();
    expect((screen.getByLabelText("Или вставьте ссылку") as HTMLInputElement).value).toBe(
      "https://pub-x.r2.dev/menu/lagman.jpg",
    );
  });

  it("«Отмена» закрывает форму без вызова updateMenuItem", async () => {
    listMenu.mockResolvedValue([item({ id: "m-5", name: "Куырдак", image_url: null })]);

    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Изменить фото: Куырдак" }));
    fireEvent.click(await screen.findByRole("button", { name: "Отмена" }));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: 'Фото блюда «Куырдак»' })).toBeNull(),
    );
    expect(updateMenuItem).not.toHaveBeenCalled();
  });
});
