import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { GuideCollection, GuideRoute } from "@bookeat/api/client";

import { guideCategory, guideCollection, pending, renderScreen, repositoryStub } from "@web/test/harness";

/**
 * Страница гастрогида (узел 5033:7096) — четыре состояния подборок и правило
 * «секция маршрутов скрыта, пока маршрутов нет». Репозиторий подменяется
 * целиком, как в тестах главной.
 */

const stub = repositoryStub();
vi.mock("@web/lib/api", () => ({
  isApiConfigured: true,
  get repository() {
    return stub;
  },
  setApiLanguage: vi.fn(),
}));
vi.mock("@web/lib/city", async (importOriginal) => {
  const original = await importOriginal<typeof import("@web/lib/city")>();
  return {
    ...original,
    useCity: () => ({
      city: "Алматы",
      setCity: () => {},
      cities: ["Алматы"],
      isLoading: false,
      isError: false,
    }),
  };
});

function guideRoute(overrides: Partial<GuideRoute> = {}): GuideRoute {
  return {
    slug: "classic-almaty",
    title: "Классический Алматы",
    description: "",
    coverImageUrl: null,
    durationLabel: "1 день · 4 точки",
    pointCount: 4,
    ...overrides,
  };
}

async function loadScreen() {
  const { GuideScreen } = await import("@web/components/guide/GuideScreen");
  return renderScreen(<GuideScreen />);
}

describe("страница гастрогида", () => {
  it("делит подборки на рубрики и выбор редакции, рисует прогулки", async () => {
    stub.getGuideCollections = vi.fn(async () => [
      guideCollection({ slug: "kazakh", title: "Казахская кухня", categorySlugs: ["food"] }),
      guideCollection({
        slug: "ocean",
        title: "Ocean Basket",
        subtitle: "Средиземноморье в Алматы",
        description: "Пять ресторанов сети — от бранча до ужина у моря.",
        venueCount: 5,
      }),
    ]);
    stub.getGuideCategories = vi.fn(async () => [guideCategory({ slug: "food", title: "Еда" })]);
    stub.getGuideRoutes = vi.fn(async () => [guideRoute()]);

    await loadScreen();

    // Рубрика: надпись — НАЗВАНИЕ РУБРИКИ из справочника категорий
    // (`GET /gastroguide/categories`), а не слаг подборки заглавными.
    expect(await screen.findByRole("heading", { name: "Казахская кухня" })).toBeTruthy();
    expect(screen.getByText("ЕДА")).toBeTruthy();
    expect(screen.queryByText("FOOD")).toBeNull();

    // «Выбор редакции»: поля НЕ перепутаны — надпись это `title` заглавными,
    // заголовок это `subtitle`, подпись — счётчик заведений, а не `description`.
    expect(screen.getByRole("heading", { name: "Выбор редакции" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Средиземноморье в Алматы" })).toBeTruthy();
    expect(screen.getByText("OCEAN BASKET")).toBeTruthy();
    expect(screen.getByText("5 мест в подборке")).toBeTruthy();
    expect(screen.queryByText(/Пять ресторанов сети/)).toBeNull();

    expect(await screen.findByRole("heading", { name: "Гастропрогулки" })).toBeTruthy();
    expect(screen.getByText("1 день · 4 точки")).toBeTruthy();
    // Страниц рубрик/подборок/маршрутов на сайте нет — карточки без ссылок.
    expect(screen.queryByRole("link", { name: "Казахская кухня" })).toBeNull();
    expect(vi.mocked(stub.getGuideRoutes)).toHaveBeenCalledWith("Алматы");
  });

  it("надпись рубрики скрыта, когда совпадает с названием подборки", async () => {
    stub.getGuideCollections = vi.fn(async () => [
      guideCollection({ slug: "food-picks", title: "Еда", categorySlugs: ["food"] }),
    ]);
    stub.getGuideCategories = vi.fn(async () => [guideCategory({ slug: "food", title: "еда" })]);
    stub.getGuideRoutes = vi.fn(async () => []);

    await loadScreen();

    expect(await screen.findByRole("heading", { name: "Еда" })).toBeTruthy();
    // Совпадение без учёта регистра — надписи над названием нет.
    expect(screen.queryByText("ЕДА")).toBeNull();
  });

  it("«Выбор редакции»: пустой subtitle — заголовок держит title, надписи нет", async () => {
    stub.getGuideCollections = vi.fn(async () => [
      guideCollection({ slug: "no-subtitle", title: "Зимние террасы", subtitle: "", venueCount: 3 }),
    ]);
    stub.getGuideRoutes = vi.fn(async () => []);

    await loadScreen();

    expect(await screen.findByRole("heading", { name: "Зимние террасы" })).toBeTruthy();
    expect(screen.getByText("3 места в подборке")).toBeTruthy();
    expect(screen.queryByText("ЗИМНИЕ ТЕРРАСЫ")).toBeNull();
  });

  it("шапка называет город из шапки сайта", async () => {
    stub.getGuideCollections = vi.fn(async () => []);
    stub.getGuideRoutes = vi.fn(async () => []);
    await loadScreen();
    expect(screen.getByRole("heading", { level: 1, name: "Salém, Алматы." })).toBeTruthy();
    expect(screen.getByText("BOOKEAT GUIDE · АЛМАТЫ")).toBeTruthy();
  });

  it("пусто: сообщение в первой секции, «Выбор редакции» и прогулки не рисуются", async () => {
    stub.getGuideCollections = vi.fn(async () => []);
    stub.getGuideRoutes = vi.fn(async () => []);
    await loadScreen();

    expect(await screen.findByText(/Редакция BookEat готовит подборки/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.queryByRole("heading", { name: "Выбор редакции" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Гастропрогулки" })).toBeNull();
  });

  it("загрузка: скелет с role=status", async () => {
    stub.getGuideCollections = vi.fn(() => pending<GuideCollection[]>());
    stub.getGuideRoutes = vi.fn(() => pending<GuideRoute[]>());
    await loadScreen();
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });

  it("ошибка подборок: сообщение и кнопка «Повторить», отказ маршрутов страницу не рушит", async () => {
    stub.getGuideCollections = vi.fn(async () => {
      throw new Error("boom");
    });
    stub.getGuideRoutes = vi.fn(async () => {
      throw new Error("boom");
    });
    await loadScreen();

    expect(await screen.findByText("Не удалось загрузить")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Рубрики" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Гастропрогулки" })).toBeNull();
  });
});
