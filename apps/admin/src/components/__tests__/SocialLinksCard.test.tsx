import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminApiError, type SocialLink } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SocialLinksCard, type SocialLinksClient } from "../SocialLinksCard";

/**
 * Набор ссылок сервер ЗАМЕЩАЕТ целиком (ReplaceSocialLinks удаляет строки и
 * вставляет присланные заново). Отсюда два свойства, которые тут и проверяются:
 * сохранять можно только после того, как текущий набор прочитан, и уходить
 * должен ВЕСЬ список, а не изменённая строка.
 */

const RESTAURANT_ID = "r-1";

function link(type: string, url: string, id = `${type}-1`): SocialLink {
  return { id, type, url };
}

function renderCard(client: SocialLinksClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SocialLinksCard restaurantId={RESTAURANT_ID} client={client} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("SocialLinksCard", () => {
  it("добавляет строку и сохраняет её вместе с уже существующими", async () => {
    const client: SocialLinksClient = {
      getRestaurantSocialLinks: vi
        .fn()
        .mockResolvedValue([link("instagram", "https://instagram.com/yurta.almaty")]),
      setRestaurantSocialLinks: vi.fn().mockResolvedValue([]),
    };
    renderCard(client);

    await screen.findByLabelText(/ссылка 1/i);
    fireEvent.click(screen.getByRole("button", { name: /добавить ссылку/i }));

    const second = await screen.findByLabelText<HTMLInputElement>(/ссылка 2/i);
    // Новая строка занимает первый свободный вид, а не повторяет занятый.
    expect(screen.getByLabelText<HTMLSelectElement>(/вид 2/i).value).toBe("whatsapp");
    fireEvent.change(second, { target: { value: "+7 707 000 00 00" } });
    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    await waitFor(() =>
      expect(client.setRestaurantSocialLinks).toHaveBeenCalledWith(RESTAURANT_ID, [
        { type: "instagram", url: "https://instagram.com/yurta.almaty" },
        { type: "whatsapp", url: "https://wa.me/77070000000" },
      ]),
    );
  });

  it("удаляет строку — и на сервер уходит набор БЕЗ неё", async () => {
    const client: SocialLinksClient = {
      getRestaurantSocialLinks: vi
        .fn()
        .mockResolvedValue([
          link("instagram", "https://instagram.com/yurta.almaty"),
          link("website", "https://yurta.kz"),
        ]),
      setRestaurantSocialLinks: vi.fn().mockResolvedValue([]),
    };
    renderCard(client);

    await screen.findByLabelText(/ссылка 2/i);
    fireEvent.click(screen.getByRole("button", { name: /удалить ссылку 1/i }));

    await waitFor(() => expect(screen.queryByLabelText(/ссылка 2/i)).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    await waitFor(() =>
      expect(client.setRestaurantSocialLinks).toHaveBeenCalledWith(RESTAURANT_ID, [
        { type: "website", url: "https://yurta.kz" },
      ]),
    );
  });

  it("удаление последней строки сохраняется как пустой набор, а не как «нечего менять»", async () => {
    const client: SocialLinksClient = {
      getRestaurantSocialLinks: vi.fn().mockResolvedValue([link("website", "https://yurta.kz")]),
      setRestaurantSocialLinks: vi.fn().mockResolvedValue([]),
    };
    renderCard(client);

    await screen.findByLabelText(/ссылка 1/i);
    fireEvent.click(screen.getByRole("button", { name: /удалить ссылку 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    await waitFor(() =>
      expect(client.setRestaurantSocialLinks).toHaveBeenCalledWith(RESTAURANT_ID, []),
    );
  });

  it("не тратит запрос на то, из чего не собрать ссылку, и говорит, что не так", async () => {
    const client: SocialLinksClient = {
      getRestaurantSocialLinks: vi.fn().mockResolvedValue([link("website", "https://yurta.kz")]),
      setRestaurantSocialLinks: vi.fn(),
    };
    renderCard(client);

    const input = await screen.findByLabelText<HTMLInputElement>(/ссылка 1/i);
    fireEvent.change(input, { target: { value: "наш сайт" } });
    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("не похоже на ссылку");
    expect(client.setRestaurantSocialLinks).not.toHaveBeenCalled();
    // Набранное остаётся в поле: чинить нужно его, а не набирать заново.
    expect(input.value).toBe("наш сайт");
  });

  it("пустая строка не отправляется — её просто выбрасывают", async () => {
    const client: SocialLinksClient = {
      getRestaurantSocialLinks: vi.fn().mockResolvedValue([link("website", "https://yurta.kz")]),
      setRestaurantSocialLinks: vi.fn().mockResolvedValue([]),
    };
    renderCard(client);

    await screen.findByLabelText(/ссылка 1/i);
    fireEvent.click(screen.getByRole("button", { name: /добавить ссылку/i }));
    await screen.findByLabelText(/ссылка 2/i);
    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    await waitFor(() =>
      expect(client.setRestaurantSocialLinks).toHaveBeenCalledWith(RESTAURANT_ID, [
        { type: "website", url: "https://yurta.kz" },
      ]),
    );
  });

  it("не даёт сохранить, пока текущий набор не прочитан", async () => {
    const client: SocialLinksClient = {
      getRestaurantSocialLinks: vi.fn().mockRejectedValue(new Error("нет сети")),
      setRestaurantSocialLinks: vi.fn(),
    };
    renderCard(client);

    expect(await screen.findByText(/ссылки не загрузились/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^сохранить$/i })).toBeNull();
    expect(client.setRestaurantSocialLinks).not.toHaveBeenCalled();
  });

  it("404 на заведении объясняет ПРИЧИНУ и не предлагает бессмысленный повтор", async () => {
    // Заведение читается кабинетной ручкой, которая видит и выключенные, —
    // значит 404 здесь означает «такого заведения тут нет» (id с другого
    // сервера) или «вас убрали из команды». «Проверьте соединение» на это
    // отправляет чинить сеть, которая исправна, а кнопка «Повторить» повторяет
    // запрос, который может только упасть снова.
    const client: SocialLinksClient = {
      getRestaurantSocialLinks: vi.fn().mockRejectedValue(new AdminApiError("not found", 404)),
      setRestaurantSocialLinks: vi.fn(),
    };
    renderCard(client);

    expect(await screen.findByText("Заведение недоступно")).toBeTruthy();
    expect(screen.queryByText(/ссылки не загрузились/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /повторить/i })).toBeNull();
  });

  it("сбой связи остаётся сбоем связи — с повтором", async () => {
    const client: SocialLinksClient = {
      getRestaurantSocialLinks: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      setRestaurantSocialLinks: vi.fn(),
    };
    renderCard(client);

    expect(await screen.findByText(/ссылки не загрузились/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /повторить/i })).toBeTruthy();
    expect(screen.queryByText("Заведение недоступно")).toBeNull();
  });

  it("показывает чужой вид из старых данных, а не подменяет его молча", async () => {
    const client: SocialLinksClient = {
      getRestaurantSocialLinks: vi
        .fn()
        .mockResolvedValue([link("facebook", "https://facebook.com/yurta")]),
      setRestaurantSocialLinks: vi.fn().mockResolvedValue([]),
    };
    renderCard(client);

    const select = await screen.findByLabelText<HTMLSelectElement>(/вид 1/i);
    expect(select.value).toBe("facebook");
    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    await waitFor(() =>
      expect(client.setRestaurantSocialLinks).toHaveBeenCalledWith(RESTAURANT_ID, [
        { type: "facebook", url: "https://facebook.com/yurta" },
      ]),
    );
  });
});
