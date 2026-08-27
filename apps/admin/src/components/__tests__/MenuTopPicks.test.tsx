import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { RepositoryError } from "@bookeat/api";
import type { AdminMenuItem, AdminMenuTopPick } from "@bookeat/api/admin";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * «Лучшие позиции» в меню панели.
 *
 * Заведение отмечает до восьми блюд, и порядок отметок — это места 1..8, а не
 * флажок. Закрепляем то, что иначе тихо разъедется:
 *
 *  1. отметка уходит на СВОЮ ручку (PATCH .../top-pick), а не на наличие;
 *  2. заполненная полка отвечает 422 с кодом `menu_top_picks_limit`, и
 *     управляющий читает «снимите одно блюдо», а не «сервер не принял
 *     изменение» — по коду, а не по статусу;
 *  3. перестановка шлёт ВЕСЬ итоговый порядок одним запросом;
 *  4. отмеченное блюдо в стоп-листе остаётся на полке и говорит об этом вслух.
 */

const listMenu = vi.fn();
const listMenuTopPicks = vi.fn();
const setMenuItemTopPick = vi.fn();
const replaceMenuTopPicks = vi.fn();
const setMenuItemAvailability = vi.fn();

vi.mock("@/lib/api", () => ({
  apiClient: {
    listMenu: (...args: unknown[]) => listMenu(...args),
    listMenuTopPicks: (...args: unknown[]) => listMenuTopPicks(...args),
    setMenuItemTopPick: (...args: unknown[]) => setMenuItemTopPick(...args),
    replaceMenuTopPicks: (...args: unknown[]) => replaceMenuTopPicks(...args),
    setMenuItemAvailability: (...args: unknown[]) => setMenuItemAvailability(...args),
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

function pick(over: Partial<AdminMenuTopPick> = {}): AdminMenuTopPick {
  return {
    id: "m-1",
    restaurant_id: "r-1",
    name: "Бешбармак",
    price: "4500",
    image_url: null,
    is_available: true,
    is_top_pick: true,
    top_pick_position: 1,
    category: "Горячее",
    ...over,
  };
}

/** Восемь занятых мест — полка заполнена. */
function fullShelf(): AdminMenuTopPick[] {
  return Array.from({ length: 8 }, (_, i) =>
    pick({ id: `p-${i + 1}`, name: `Блюдо ${i + 1}`, top_pick_position: i + 1 }),
  );
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
  listMenuTopPicks.mockReset().mockResolvedValue([]);
  setMenuItemTopPick.mockReset().mockResolvedValue(undefined);
  replaceMenuTopPicks.mockReset().mockResolvedValue(undefined);
  setMenuItemAvailability.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("отметка блюда", () => {
  it("уходит на ручку «лучших позиций», а не на наличие", async () => {
    listMenu.mockResolvedValue([item({ id: "m-7", name: "Лагман" })]);

    renderScreen();

    const box = await screen.findByRole("checkbox", { name: "В лучшие позиции: Лагман" });
    expect((box as HTMLInputElement).checked).toBe(false);
    fireEvent.click(box);

    await waitFor(() => expect(setMenuItemTopPick).toHaveBeenCalledTimes(1));
    expect(setMenuItemTopPick).toHaveBeenCalledWith("r-1", "m-7", true);
    // Наличие блюда — другая кнопка и другая ручка; отметка её не трогает.
    expect(setMenuItemAvailability).not.toHaveBeenCalled();
  });

  it("у уже отмеченного блюда флажок стоит, и снятие шлёт is_top_pick=false", async () => {
    listMenu.mockResolvedValue([item({ id: "m-1", name: "Бешбармак" })]);
    listMenuTopPicks.mockResolvedValue([pick({ id: "m-1", name: "Бешбармак" })]);

    renderScreen();

    const box = await screen.findByRole<HTMLInputElement>("checkbox", {
      name: "В лучшие позиции: Бешбармак",
    });
    await waitFor(() => expect(box.checked).toBe(true));

    fireEvent.click(box);
    await waitFor(() => expect(setMenuItemTopPick).toHaveBeenCalledWith("r-1", "m-1", false));
  });
});

describe("предел в восемь мест", () => {
  it("виден счётчиком до того, как в него упрутся", async () => {
    listMenu.mockResolvedValue([item({ id: "m-9", name: "Плов" })]);
    listMenuTopPicks.mockResolvedValue([pick({ id: "m-1" }), pick({ id: "m-2", name: "Манты" })]);

    renderScreen();

    expect(await screen.findByText("Занято 2 из 8")).toBeTruthy();
  });

  it("когда мест нет, флажок неотмеченного блюда заперт и объясняет причину", async () => {
    listMenu.mockResolvedValue([item({ id: "m-99", name: "Кеспе" })]);
    listMenuTopPicks.mockResolvedValue(fullShelf());

    renderScreen();

    const box = await screen.findByRole<HTMLInputElement>("checkbox", {
      name: "В лучшие позиции: Кеспе",
    });
    await waitFor(() => expect(box.disabled).toBe(true));
    expect(screen.getAllByText("Свободных мест нет — снимите одно блюдо").length).toBeGreaterThan(0);
    expect(await screen.findByText("Занято 8 из 8")).toBeTruthy();
  });

  it("отказ 422 menu_top_picks_limit показывает СВОЁ сообщение, а не общее", async () => {
    // Полка на экране ещё не выглядит полной (другая вкладка успела занять
    // последнее место), поэтому запрос уходит и сервер отвечает отказом.
    listMenu.mockResolvedValue([item({ id: "m-42", name: "Куырдак" })]);
    listMenuTopPicks.mockResolvedValue([pick({ id: "m-1" })]);
    setMenuItemTopPick.mockRejectedValue(
      new RepositoryError("validation failed", undefined, 422, undefined, "menu_top_picks_limit"),
    );

    renderScreen();

    fireEvent.click(
      await screen.findByRole("checkbox", { name: "В лучшие позиции: Куырдак" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Свободных мест нет — снимите одно блюдо");
    // Ровно этого текста тут быть не должно: он ничего не объясняет.
    expect(screen.queryByText("Сервер не принял изменение")).toBeNull();
  });

  it("а обычный 422 без кода остаётся обычным отказом", async () => {
    listMenu.mockResolvedValue([item({ id: "m-43", name: "Шубат" })]);
    setMenuItemTopPick.mockRejectedValue(
      new RepositoryError("validation failed", undefined, 422),
    );

    renderScreen();

    fireEvent.click(await screen.findByRole("checkbox", { name: "В лучшие позиции: Шубат" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Сервер не принял изменение");
  });
});

describe("порядок мест", () => {
  it("«Ниже» отправляет весь итоговый порядок одним запросом", async () => {
    listMenu.mockResolvedValue([item({ id: "m-1" })]);
    listMenuTopPicks.mockResolvedValue([
      pick({ id: "p-1", name: "Первое", top_pick_position: 1 }),
      pick({ id: "p-2", name: "Второе", top_pick_position: 2 }),
      pick({ id: "p-3", name: "Третье", top_pick_position: 3 }),
    ]);

    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Ниже: Первое" }));

    await waitFor(() => expect(replaceMenuTopPicks).toHaveBeenCalledTimes(1));
    expect(replaceMenuTopPicks).toHaveBeenCalledWith("r-1", ["p-2", "p-1", "p-3"]);
  });

  it("«Выше» у первого места нажать нельзя — двигать некуда", async () => {
    listMenu.mockResolvedValue([item({ id: "m-1" })]);
    listMenuTopPicks.mockResolvedValue([
      pick({ id: "p-1", name: "Первое", top_pick_position: 1 }),
      pick({ id: "p-2", name: "Второе", top_pick_position: 2 }),
    ]);

    renderScreen();

    const up = await screen.findByRole<HTMLButtonElement>("button", { name: "Выше: Первое" });
    expect(up.disabled).toBe(true);
    fireEvent.click(up);
    expect(replaceMenuTopPicks).not.toHaveBeenCalled();
  });
});

describe("блюдо в стоп-листе", () => {
  it("остаётся на полке и говорит, что гостю его не показывают", async () => {
    listMenu.mockResolvedValue([item({ id: "m-1", name: "Бешбармак", is_available: false })]);
    listMenuTopPicks.mockResolvedValue([
      pick({ id: "m-1", name: "Бешбармак", is_available: false, top_pick_position: 1 }),
    ]);

    renderScreen();

    const shelf = await screen.findByRole("list", { name: "Лучшие позиции" });
    const row = within(shelf).getByText("Бешбармак").closest("li");
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain("В стоп-листе");
    expect(row?.textContent).toContain("Место занято, но гостю блюдо сейчас не показывают");
    // Место всё ещё занято — счётчик это подтверждает.
    expect(screen.getByText("Занято 1 из 8")).toBeTruthy();
  });
});

describe("состояния загрузки полки", () => {
  it("пока полка грузится, показан её собственный загрузчик", async () => {
    listMenu.mockResolvedValue([item()]);
    listMenuTopPicks.mockReturnValue(new Promise(() => {}));

    renderScreen();

    expect(await screen.findByText("Загружаем лучшие позиции…")).toBeTruthy();
  });

  it("упавший запрос полки не ломает меню и предлагает повтор", async () => {
    listMenu.mockResolvedValue([item({ name: "Бешбармак" })]);
    listMenuTopPicks.mockRejectedValue(new Error("boom"));

    renderScreen();

    expect(await screen.findByText("Не удалось загрузить лучшие позиции")).toBeTruthy();
    // Список меню на месте: одна упавшая полка не уносит весь экран.
    expect(screen.getAllByText("Бешбармак").length).toBeGreaterThan(0);
  });

  it("пустая полка объясняет, что делать", async () => {
    listMenu.mockResolvedValue([item()]);
    listMenuTopPicks.mockResolvedValue([]);

    renderScreen();

    expect(
      await screen.findByText(
        "Отметьте блюда в списке ниже. Пока полка пуста, приложение соберёт её само",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Занято 0 из 8")).toBeTruthy();
  });
});
