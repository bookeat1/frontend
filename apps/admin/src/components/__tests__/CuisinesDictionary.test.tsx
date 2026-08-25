import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CuisineDictionaryEntry } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CuisinesDictionary, type CuisineDictionaryClient } from "../CuisinesView";

/**
 * Экран справочника кухонь (только платформа).
 *
 * Главное, что тут закреплено: удаления НЕТ — DELETE на сервере снимает флаг
 * активности, а вернуть кухню можно PATCH-ем. Порядок правится через
 * display_order, отдельной ручки «поменять местами» не существует, поэтому
 * перестановка — это несколько правок подряд.
 */

function entry(over: Partial<CuisineDictionaryEntry> = {}): CuisineDictionaryEntry {
  return {
    id: "c-1",
    code: "kazakh",
    name: "Казахская",
    display_order: 1,
    is_active: true,
    ...over,
  };
}

const ITEMS: CuisineDictionaryEntry[] = [
  entry({ id: "c-1", code: "european", name: "Европейская", display_order: 1 }),
  entry({ id: "c-2", code: "seafood", name: "Морская", display_order: 2 }),
  entry({ id: "c-3", code: "vegan", name: "Веган", display_order: 3, is_active: false }),
];

function fakeClient(over: Partial<CuisineDictionaryClient> = {}): CuisineDictionaryClient {
  return {
    listCuisinesForAdmin: vi.fn().mockResolvedValue(ITEMS),
    createCuisine: vi.fn().mockResolvedValue(entry()),
    updateCuisine: vi.fn().mockResolvedValue(entry()),
    hideCuisine: vi.fn().mockResolvedValue(entry({ is_active: false })),
    ...over,
  };
}

function renderScreen(client: CuisineDictionaryClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CuisinesDictionary client={client} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("справочник кухонь", () => {
  it("показывает картинку, название, порядок и видно ли кухню", async () => {
    const client = fakeClient({
      listCuisinesForAdmin: vi
        .fn()
        .mockResolvedValue([
          entry({
            id: "c-1",
            code: "european",
            name: "Европейская",
            image_url: "https://example.test/cuisines/european.png",
          }),
        ]),
    });
    renderScreen(client);

    expect(await screen.findByText("Европейская")).toBeTruthy();
    expect(screen.getByText("european")).toBeTruthy();
    expect(screen.getByRole<HTMLImageElement>("img", { name: "Европейская" }).src).toBe(
      "https://example.test/cuisines/european.png",
    );
    expect(screen.getByText("Показывается")).toBeTruthy();
  });

  it("кухню без картинки не рисует дырой", async () => {
    const client = fakeClient({
      listCuisinesForAdmin: vi.fn().mockResolvedValue([entry({ image_url: null })]),
    });
    renderScreen(client);
    expect(await screen.findByText("Без картинки")).toBeTruthy();
  });

  it("объясняет прямо на экране, почему кнопки «удалить» нет", async () => {
    renderScreen(fakeClient());
    expect(
      await screen.findByText(/Кухню нельзя удалить.*«Скрыть» убирает её из приложения/is),
    ).toBeTruthy();
  });

  it("«Скрыть» уходит в DELETE, «Вернуть» — в PATCH с is_active", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: /Скрыть кухню «Морская»/i }));
    await waitFor(() => expect(client.hideCuisine).toHaveBeenCalledWith("c-2"));

    fireEvent.click(screen.getByRole("button", { name: /Вернуть кухню «Веган»/i }));
    await waitFor(() =>
      expect(client.updateCuisine).toHaveBeenCalledWith("c-3", { is_active: true }),
    );
  });

  it("перестановка вверх переписывает display_order у затронутой пары", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: /Поднять кухню «Морская»/i }));

    await waitFor(() => expect(client.updateCuisine).toHaveBeenCalledTimes(2));
    expect(client.updateCuisine).toHaveBeenNthCalledWith(1, "c-2", { display_order: 1 });
    expect(client.updateCuisine).toHaveBeenNthCalledWith(2, "c-1", { display_order: 2 });
  });

  it("верхнюю кухню поднять нельзя, нижнюю — опустить", async () => {
    renderScreen(fakeClient());
    const up = await screen.findByRole<HTMLButtonElement>("button", {
      name: /Поднять кухню «Европейская»/i,
    });
    expect(up.disabled).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /Опустить кухню «Веган»/i }).disabled,
    ).toBe(true);
  });

  it("не сохранившийся порядок виден человеку, а не тонет молча", async () => {
    const client = fakeClient({ updateCuisine: vi.fn().mockRejectedValue(new Error("500")) });
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: /Поднять кухню «Морская»/i }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Порядок сохранился не полностью",
    );
  });

  it("новая кухня заводится кодом и названием", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: /^Добавить кухню$/i }));
    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "  Греческая  " } });
    fireEvent.change(screen.getByLabelText(/^Код/), { target: { value: "GREEK" } });
    fireEvent.click(screen.getByRole("button", { name: /^Сохранить$/i }));

    await waitFor(() =>
      expect(client.createCuisine).toHaveBeenCalledWith({
        name: "Греческая",
        code: "greek",
        image_url: "",
      }),
    );
  });

  it("кириллический код не тратит запрос — сервер его всё равно отвергнет", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: /^Добавить кухню$/i }));
    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Греческая" } });
    fireEvent.change(screen.getByLabelText(/^Код/), { target: { value: "греческая" } });
    fireEvent.click(screen.getByRole("button", { name: /^Сохранить$/i }));

    expect((await screen.findByRole("alert")).textContent).toContain("только латиницу");
    expect(client.createCuisine).not.toHaveBeenCalled();
  });

  it("переименование правит существующую запись, а не заводит вторую", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: /Изменить кухню «Морская»/i }));
    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Морепродукты" } });
    fireEvent.click(screen.getByRole("button", { name: /^Сохранить$/i }));

    await waitFor(() =>
      expect(client.updateCuisine).toHaveBeenCalledWith("c-2", {
        name: "Морепродукты",
        code: "seafood",
        image_url: "",
      }),
    );
    expect(client.createCuisine).not.toHaveBeenCalled();
  });

  it("пустой справочник и упавшая загрузка — разные экраны", async () => {
    const empty = fakeClient({ listCuisinesForAdmin: vi.fn().mockResolvedValue([]) });
    const { unmount } = renderScreen(empty);
    expect(await screen.findByText("Кухонь пока нет")).toBeTruthy();
    unmount();

    const failing = fakeClient({
      listCuisinesForAdmin: vi.fn().mockRejectedValue(new Error("нет сети")),
    });
    renderScreen(failing);
    expect(await screen.findByText(/Справочник не загрузился/i)).toBeTruthy();
  });
});
