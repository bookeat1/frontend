import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import { RepositoryError } from "@bookeat/api/client";

import { promoDetail, renderScreen, repositoryStub, venueDetail } from "@web/test/harness";

/**
 * Карточка акции /promos/[id] — T1b (критерий 13, решение владельца
 * 2026-09-06): те же компоненты секций и правой карточки, что у события,
 * бейдж «−N%», секция «Условия», блок заведения скрывается целиком при
 * отказе/отсутствии заведения (в отличие от события — там остаётся имя).
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/promos/promo-1",
}));

const repository = repositoryStub();

vi.mock("@web/lib/api", () => ({
  get repository() {
    return repository;
  },
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
}));

const { PromoScreen } = await import("@web/components/promos/PromoScreen");

beforeEach(() => {
  repository.getPromo = vi.fn(async () => promoDetail());
  repository.getRestaurant = vi.fn(async () => venueDetail());
});

describe("PromoScreen", () => {
  it("акция с заведением: бейдж скидки, заголовок, заведение, кнопка «Забронировать столик»", async () => {
    renderScreen(<PromoScreen id="promo-1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "−20% на сет для двоих" })).toBeTruthy();
    expect(screen.getByText("−20%")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Забронировать столик" }).getAttribute("href")).toContain(
      "/venues/r-1/book",
    );
    expect(await screen.findAllByRole("link", { name: /Открыть страницу заведения/ })).not.toHaveLength(0);
  });

  it("непустые terms — секция «Условия»; пустые — секции нет", async () => {
    repository.getPromo = vi.fn(async () => promoDetail({ terms: "Только по будням." }));
    renderScreen(<PromoScreen id="promo-1" />);
    expect(await screen.findByText("Условия")).toBeTruthy();
    expect(screen.getByText("Только по будням.")).toBeTruthy();
  });

  it("пустые terms — секции «Условия» нет", async () => {
    repository.getPromo = vi.fn(async () => promoDetail({ terms: "" }));
    renderScreen(<PromoScreen id="promo-1" />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("Условия")).toBeNull();
  });

  it("без заведения (акция платформы) — блока заведения нет вовсе", async () => {
    repository.getPromo = vi.fn(async () => promoDetail({ restaurantId: null, restaurant: null }));
    renderScreen(<PromoScreen id="promo-1" />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("Место проведения")).toBeNull();
    expect(screen.queryByText("Контакты и как добраться")).toBeNull();
    expect(screen.queryByRole("link", { name: "Забронировать столик" })).toBeNull();
  });

  it("заведение указано, но не найдено у нас — блок скрывается целиком, без заглушки", async () => {
    repository.getRestaurant = vi.fn(async () => {
      throw new RepositoryError("not found", undefined, 404);
    });
    renderScreen(<PromoScreen id="promo-1" />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("Место проведения")).toBeNull();
    expect(screen.queryByText("INZHU Terrace")).toBeNull();
  });

  it("404 акции — «Акция не найдена»", async () => {
    repository.getPromo = vi.fn(async () => {
      throw new RepositoryError("not found", undefined, 404);
    });
    renderScreen(<PromoScreen id="missing" />);
    expect(await screen.findByText("Акция не найдена")).toBeTruthy();
  });
});
