import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CityDictionaryEntry } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CitiesDictionary, type CityDictionaryClient } from "../CitiesView";

/**
 * Экран справочника городов (только платформа).
 *
 * Что тут закреплено:
 *   • удаления НЕТ — DELETE на сервере снимает флаг активности, вернуть город
 *     можно PATCH-ем, и на экране это сказано словами;
 *   • порядок правится ОДНОЙ ручкой `PUT /admin/cities/order`, принимающей
 *     весь список id (у кухонь такой ручки нет — там пачка PATCH-ей);
 *   • написание-синоним объясняется прямо в окне: без объяснения поле
 *     читается как второе название города.
 */

function entry(over: Partial<CityDictionaryEntry> = {}): CityDictionaryEntry {
  return {
    id: "c-1",
    code: "astana",
    name: "Астана",
    value: "Астана",
    display_order: 1,
    is_active: true,
    ...over,
  };
}

const ITEMS: CityDictionaryEntry[] = [
  entry({ id: "c-1", code: "astana", name: "Астана", value: "Астана", display_order: 1 }),
  entry({ id: "c-2", code: "almaty", name: "Алматы", value: "Алматы", display_order: 2 }),
  entry({
    id: "c-3",
    code: "shymkent",
    name: "Шымкент",
    value: "Шымкент",
    display_order: 3,
    is_active: false,
  }),
];

function fakeClient(over: Partial<CityDictionaryClient> = {}): CityDictionaryClient {
  return {
    listCitiesForAdmin: vi.fn().mockResolvedValue(ITEMS),
    createCity: vi.fn().mockResolvedValue(entry()),
    updateCity: vi.fn().mockResolvedValue(entry()),
    hideCity: vi.fn().mockResolvedValue(entry({ is_active: false })),
    reorderCities: vi.fn().mockResolvedValue(ITEMS),
    addCityAlias: vi.fn().mockResolvedValue(entry()),
    ...over,
  };
}

function renderScreen(client: CityDictionaryClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CitiesDictionary client={client} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("справочник городов", () => {
  it("показывает название, код, порядок и видно ли город", async () => {
    renderScreen(fakeClient());

    expect(await screen.findByText("Астана")).toBeTruthy();
    expect(screen.getByText("astana")).toBeTruthy();
    expect(screen.getByText("Шымкент")).toBeTruthy();
    expect(screen.getAllByText("Активный")).toHaveLength(2);
    expect(screen.getByText("Скрыт")).toBeTruthy();
  });

  it("объясняет прямо на экране, почему кнопки «удалить» нет", async () => {
    renderScreen(fakeClient());
    expect(
      await screen.findByText(/Город нельзя удалить.*«Скрыть» убирает его из выбора/is),
    ).toBeTruthy();
  });

  it("новый город заводится названием и кодом", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: /^Добавить город$/i }));
    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "  Шымкент  " } });
    fireEvent.change(screen.getByLabelText(/^Код/), { target: { value: "SHYMKENT" } });
    fireEvent.click(screen.getByRole("button", { name: /^Сохранить$/i }));

    await waitFor(() =>
      expect(client.createCity).toHaveBeenCalledWith({ name: "Шымкент", code: "shymkent" }),
    );
  });

  it("кириллический код не тратит запрос — сервер его всё равно отвергнет", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: /^Добавить город$/i }));
    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Шымкент" } });
    fireEvent.change(screen.getByLabelText(/^Код/), { target: { value: "шымкент" } });
    fireEvent.click(screen.getByRole("button", { name: /^Сохранить$/i }));

    expect((await screen.findByRole("alert")).textContent).toContain("только латиницу");
    expect(client.createCity).not.toHaveBeenCalled();
  });

  it("переименование правит запись и берёт базовое название, а не перевод", async () => {
    const client = fakeClient({
      listCitiesForAdmin: vi
        .fn()
        .mockResolvedValue([entry({ id: "c-1", name: "Астана қаласы", value: "Астана" })]),
    });
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: /Изменить город «Астана қаласы»/i }));
    // В поле подставлено базовое название, а не то, что показано в списке.
    expect(screen.getByLabelText<HTMLInputElement>(/^Название/).value).toBe("Астана");

    fireEvent.change(screen.getByLabelText(/^Название/), { target: { value: "Нур-Султан" } });
    fireEvent.click(screen.getByRole("button", { name: /^Сохранить$/i }));

    await waitFor(() =>
      expect(client.updateCity).toHaveBeenCalledWith("c-1", {
        name: "Нур-Султан",
        code: "astana",
      }),
    );
    expect(client.createCity).not.toHaveBeenCalled();
  });

  it("«Скрыть» уходит в DELETE, «Вернуть» — в PATCH с is_active", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: /Скрыть город «Алматы»/i }));
    await waitFor(() => expect(client.hideCity).toHaveBeenCalledWith("c-2"));

    fireEvent.click(screen.getByRole("button", { name: /Вернуть город «Шымкент»/i }));
    await waitFor(() => expect(client.updateCity).toHaveBeenCalledWith("c-3", { is_active: true }));
  });

  it("перестановка — один запрос с ПОЛНЫМ порядком", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: /Поднять город «Алматы»/i }));

    await waitFor(() => expect(client.reorderCities).toHaveBeenCalledTimes(1));
    expect(client.reorderCities).toHaveBeenCalledWith(["c-2", "c-1", "c-3"]);
    expect(client.updateCity).not.toHaveBeenCalled();
  });

  it("верхний город поднять нельзя, нижний — опустить", async () => {
    renderScreen(fakeClient());
    expect(
      (await screen.findByRole<HTMLButtonElement>("button", { name: /Поднять город «Астана»/i }))
        .disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /Опустить город «Шымкент»/i })
        .disabled,
    ).toBe(true);
  });

  it("не сохранившийся порядок виден человеку, а не тонет молча", async () => {
    const client = fakeClient({ reorderCities: vi.fn().mockRejectedValue(new Error("500")) });
    renderScreen(client);

    fireEvent.click(await screen.findByRole("button", { name: /Поднять город «Алматы»/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("Порядок не сохранился");
  });

  it("написание-синоним отправляется и объясняется словами", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(
      await screen.findByRole("button", { name: /Добавить написание города «Астана»/i }),
    );
    expect(screen.getByText(/само привяжется к этому городу при следующем сохранении/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^Написание/), { target: { value: " Нур-Султан " } });
    fireEvent.click(screen.getByRole("button", { name: /^Добавить написание$/i }));

    await waitFor(() => expect(client.addCityAlias).toHaveBeenCalledWith("c-1", "Нур-Султан"));
    // Окно остаётся открытым: написаний у города обычно несколько.
    expect((await screen.findByRole("status")).textContent).toContain("Написание добавлено");
    expect(screen.getByLabelText<HTMLInputElement>(/^Написание/).value).toBe("");
  });

  it("собственное название города синонимом не заводится", async () => {
    const client = fakeClient();
    renderScreen(client);

    fireEvent.click(
      await screen.findByRole("button", { name: /Добавить написание города «Астана»/i }),
    );
    fireEvent.change(screen.getByLabelText(/^Написание/), { target: { value: "астана" } });
    fireEvent.click(screen.getByRole("button", { name: /^Добавить написание$/i }));

    expect((await screen.findByRole("alert")).textContent).toContain("Это и есть название города");
    expect(client.addCityAlias).not.toHaveBeenCalled();
  });

  it("занятое написание показывается ошибкой, а не молча теряется", async () => {
    const client = fakeClient({ addCityAlias: vi.fn().mockRejectedValue(new Error("409")) });
    renderScreen(client);

    fireEvent.click(
      await screen.findByRole("button", { name: /Добавить написание города «Астана»/i }),
    );
    fireEvent.change(screen.getByLabelText(/^Написание/), { target: { value: "Алма-Ата" } });
    fireEvent.click(screen.getByRole("button", { name: /^Добавить написание$/i }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Не удалось добавить написание",
    );
  });

  it("пустой справочник и упавшая загрузка — разные экраны", async () => {
    const empty = fakeClient({ listCitiesForAdmin: vi.fn().mockResolvedValue([]) });
    const { unmount } = renderScreen(empty);
    expect(await screen.findByText("Городов пока нет")).toBeTruthy();
    unmount();

    const failing = fakeClient({
      listCitiesForAdmin: vi.fn().mockRejectedValue(new Error("нет сети")),
    });
    renderScreen(failing);
    expect(await screen.findByText(/Справочник не загрузился/i)).toBeTruthy();
  });
});
