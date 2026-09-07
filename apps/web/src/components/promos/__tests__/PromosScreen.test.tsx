import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

import type { Promo, PromoPage, PromoQuery } from "@bookeat/api/client";

import { pending, promoDetail, renderScreen, repositoryStub } from "@web/test/harness";

/**
 * Страница /promos (листинг «Все акции», построен по образцу афиши): четыре
 * состояния, «Показать ещё» — вторая страница листинга. Без чипов-фильтров:
 * `GET /promos` не отдаёт тегов (в отличие от `GET /events`).
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/promos",
}));

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

const { PromosScreen } = await import("@web/components/promos/PromosScreen");

function page(items: Promo[], pageNo: number, pages: number): PromoPage {
  return { items, total: items.length, page: pageNo, pages, perPage: 6 };
}

beforeEach(() => {
  repository.listActivePromos = vi.fn(async () => page([], 1, 0));
});

describe("PromosScreen", () => {
  it("пока запрос летит — скелет и статус загрузки", () => {
    repository.listActivePromos = vi.fn(() => pending<PromoPage>());
    renderScreen(<PromosScreen />);
    expect(screen.getByRole("heading", { level: 1, name: "Акции" })).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("пустой ответ — текст пустого состояния, а не пустое место", async () => {
    renderScreen(<PromosScreen />);
    expect(await screen.findByText(/Акций пока нет/)).toBeTruthy();
  });

  it("ошибка сети — сообщение и кнопка «Повторить», которая перезапрашивает", async () => {
    repository.listActivePromos = vi.fn(async () => {
      throw new Error("network");
    });
    renderScreen(<PromosScreen />);
    const retry = await screen.findByRole("button", { name: "Повторить" });
    fireEvent.click(retry);
    await waitFor(() => expect(repository.listActivePromos).toHaveBeenCalledTimes(2));
  });

  it("карточки ведут на /promos/[id] и показывают бейдж скидки", async () => {
    repository.listActivePromos = vi.fn(async () =>
      page(
        [
          promoDetail({ id: "promo-1", title: "−30% на завтраки", discountPercent: 30 }),
          promoDetail({ id: "promo-2", title: "Дегустационный сет вечера", discountPercent: null }),
        ],
        1,
        1,
      ),
    );
    renderScreen(<PromosScreen />);

    const link = await screen.findByRole("link", { name: "−30% на завтраки" });
    expect(link.getAttribute("href")).toBe("/promos/promo-1");
    expect(screen.getByText("−30%")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Дегустационный сет вечера" })).toBeTruthy();
    // Показывать ещё нечего — страница одна.
    expect(screen.queryByRole("button", { name: "Показать ещё" })).toBeNull();
  });

  it("«Показать ещё» запрашивает следующую страницу с тем же perPage и дописывает карточки", async () => {
    repository.listActivePromos = vi.fn(async (query?: PromoQuery) =>
      query?.page === 2
        ? page([promoDetail({ id: "promo-2", title: "Джаз и коктейли" })], 2, 2)
        : page([promoDetail({ id: "promo-1", title: "−30% на завтраки" })], 1, 2),
    );
    renderScreen(<PromosScreen />);

    const more = await screen.findByRole("button", { name: "Показать ещё" });
    fireEvent.click(more);
    expect(await screen.findByRole("link", { name: "Джаз и коктейли" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "−30% на завтраки" })).toBeTruthy();
    const calls = (repository.listActivePromos as ReturnType<typeof vi.fn>).mock.calls as PromoQuery[][];
    expect(calls[calls.length - 1][0]).toMatchObject({ page: 2, perPage: 6 });
    expect(screen.queryByRole("button", { name: "Показать ещё" })).toBeNull();
  });
});
