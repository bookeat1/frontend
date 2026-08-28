import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CityDictionaryEntry, HomePickVenue } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomePicks, type HomePicksClient } from "../HomePicksView";

/**
 * «ВЫБРАЛИ ДЛЯ ВАС» — РУЧНОЙ СОСТАВ БЛОКА ГЛАВНОЙ.
 *
 * Что здесь закреплено, и каждое ломается молча:
 *
 *   1. Сохранение уходит ОДНИМ `PUT` со ВСЕМ списком — и составом, и
 *      порядком. Пошаговые правки на сервере применились бы наполовину, и
 *      получилась бы подборка, которую никто не собирал.
 *   2. Порядок правится не только перетаскиванием: с клавиатуры до drag-and-drop
 *      не добраться, поэтому кнопки «Выше»/«Ниже» обязаны давать тот же
 *      результат.
 *   3. ПУСТОЙ список — законное состояние, а не поломка: он возвращает блок к
 *      автоматической сборке. Это должно быть и написано на экране, и
 *      сохраняемо (пустой массив в теле запроса).
 *   4. Выключенное заведение помечено. Админская ручка отдаёт его специально,
 *      и редактор обязан видеть, почему в приложении заведений меньше.
 */

afterEach(cleanup);

function venue(id: string, name: string, isActive = true): HomePickVenue {
  return {
    id,
    name,
    address: "ул. Достык, 1",
    cuisine_type: "Европейская",
    city: "Алматы",
    price_category: "средний",
    is_active: isActive,
  };
}

const CITIES: CityDictionaryEntry[] = [
  { id: "c-1", code: "almaty", name: "Алматы", value: "Алматы", display_order: 1, is_active: true },
  { id: "c-2", code: "astana", name: "Астана", value: "Астана", display_order: 2, is_active: true },
];

const PICKS = [venue("a", "Первый"), venue("b", "Второй"), venue("c", "Третий")];

function fakeClient(over: Partial<HomePicksClient> = {}): HomePicksClient {
  return {
    listHomePicks: vi.fn().mockResolvedValue({
      items: PICKS,
      total: PICKS.length,
      page: 1,
      per_page: 20,
    }),
    replaceHomePicks: vi.fn().mockResolvedValue(undefined),
    searchVenues: vi.fn().mockResolvedValue({ items: [venue("d", "Новое")] }),
    ...over,
  };
}

function renderScreen(client: HomePicksClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HomePicks client={client} cities={CITIES} />
    </QueryClientProvider>,
  );
}

describe("подборка «Выбрали для вас»", () => {
  it("показывает список города и помечает выключенное заведение", async () => {
    const client = fakeClient({
      listHomePicks: vi.fn().mockResolvedValue({
        items: [venue("a", "Первый"), venue("b", "Закрытый", false)],
        total: 2,
        page: 1,
        per_page: 20,
      }),
    });
    renderScreen(client);

    expect(await screen.findByText("Первый")).toBeTruthy();
    expect(screen.getByText("Закрытый")).toBeTruthy();
    expect(screen.getByText("Отключено — гость его не увидит")).toBeTruthy();
  });

  it("объясняет автоматический режим и сохраняет ПУСТОЙ список", async () => {
    const client = fakeClient({
      listHomePicks: vi
        .fn()
        .mockResolvedValue({ items: [venue("a", "Первый")], total: 1, page: 1, per_page: 20 }),
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderScreen(client);

    // Подсказка видна ВСЕГДА, а не только когда список уже опустел.
    expect(
      await screen.findByText(
        "Если список пуст, блок собирается автоматически: популярные заведения в порядке каталога",
      ),
    ).toBeTruthy();

    fireEvent.click(await screen.findByLabelText("Убрать: Первый"));

    // Пустое состояние говорит владельцу, что произойдёт, а не «ничего нет».
    expect(screen.getByText("Ручного списка нет — блок собирается автоматически")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Сохранить подборку" }));

    await waitFor(() => expect(client.replaceHomePicks).toHaveBeenCalledWith("", []));
    // Очистка — необратимое для витрины действие, поэтому его подтверждают.
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("добавляет заведение из каталога и отправляет его в конце списка", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: "Добавить заведение" }));
    // Подпись и подсказка лежат в одном <label> (см. FormControls.Field),
    // поэтому доступное имя поля начинается с подписи, а не равно ей.
    fireEvent.change(screen.getByLabelText(/^Название заведения/), {
      target: { value: "Нов" },
    });

    const add = await screen.findByRole("button", { name: "Создать" }, { timeout: 3000 });
    fireEvent.click(add);

    fireEvent.click(screen.getByRole("button", { name: "Сохранить подборку" }));

    await waitFor(() =>
      expect(client.replaceHomePicks).toHaveBeenCalledWith("", ["a", "b", "c", "d"]),
    );
  });

  it("кнопка «Ниже» меняет порядок, и сохраняется ВЕСЬ порядок одним запросом", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(await screen.findByLabelText("Ниже: Первый"));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить подборку" }));

    await waitFor(() => expect(client.replaceHomePicks).toHaveBeenCalledTimes(1));
    expect(client.replaceHomePicks).toHaveBeenCalledWith("", ["b", "a", "c"]);
  });

  it("до правок сохранять нечего, а после сохранения кнопка снова гаснет", async () => {
    const client = fakeClient();
    renderScreen(client);

    const save = (await screen.findByRole("button", {
      name: "Сохранить подборку",
    })) as HTMLButtonElement;
    // jest-dom здесь не подключён (см. TESTING.md) — свойство читается напрямую.
    expect(save.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("Ниже: Первый"));
    expect(screen.getByText("Изменения ещё не сохранены")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Сохранить подборку" }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    fireEvent.click(screen.getByRole("button", { name: "Сохранить подборку" }));

    await waitFor(() => expect(screen.getByText("Подборка сохранена")).toBeTruthy());
    expect(
      (screen.getByRole("button", { name: "Сохранить подборку" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    // Один запрос на одно сохранение: повтор описывал бы тот же результат, но
    // «Сохранить» не должно быть нажимаемо вхолостую.
    expect(client.replaceHomePicks).toHaveBeenCalledTimes(1);
  });

  it("город — ключ списка: смена города перечитывает ДРУГОЙ список", async () => {
    const client = fakeClient();
    renderScreen(client);

    await screen.findByText("Первый");
    fireEvent.change(screen.getByLabelText(/^Город подборки/), {
      target: { value: "Астана" },
    });

    await waitFor(() => expect(client.listHomePicks).toHaveBeenLastCalledWith("Астана"));
  });

  it("отказ сервера виден текстом, а список остаётся правленым", async () => {
    const client = fakeClient({
      replaceHomePicks: vi.fn().mockRejectedValue(new Error("boom")),
    });
    renderScreen(client);

    fireEvent.click(await screen.findByLabelText("Ниже: Первый"));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить подборку" }));

    expect(
      await screen.findByText(
        "Не удалось сохранить подборку. Проверьте соединение и попробуйте ещё раз",
      ),
    ).toBeTruthy();
    // Правки не потеряны — сохранять снова есть что.
    expect(
      (screen.getByRole("button", { name: "Сохранить подборку" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
