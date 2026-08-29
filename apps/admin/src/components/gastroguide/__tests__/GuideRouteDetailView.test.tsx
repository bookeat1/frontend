import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { GuideRouteDetail, GuideRoutePoint } from "@bookeat/api/admin";
import { RepositoryError } from "@bookeat/api";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GuideRouteDetailView,
  type GuideRouteDetailClient,
} from "../GuideRouteDetailView";

/**
 * ЭКРАН ГАСТРОПРОГУЛКИ — что он обязан делать правильно.
 *
 * Проверяется не вёрстка, а четыре вещи, каждая из которых стоит редактору
 * рабочего времени, если сломается:
 *
 *  1. Публикация ходит в СВОЮ ручку. Правка текста не должна выводить маршрут
 *     в приложение, и наоборот — сервер держит это врозь, экран обязан тоже.
 *
 *  2. Отказ `guide_route_empty` показывается человеческими словами. На проводе
 *     это тот же generic "validation failed", что и десяток других отказов;
 *     без разбора кода редактор читает «Не удалось сохранить» и не узнаёт, что
 *     нужно просто добавить остановку.
 *
 *  3. Новая остановка уходит с правильным `kind`, и «место» уходит БЕЗ
 *     заведения. `place` с `restaurant_id` сервер отвергает — форма, которая
 *     его подставит, сделает добавление места невозможным.
 *
 *  4. Перестановка отправляет id остановок целиком (см. GuideRoutePointList) и
 *     после успеха экран перечитывается.
 */

afterEach(cleanup);

function point(over: Partial<GuideRoutePoint> = {}): GuideRoutePoint {
  return {
    id: "p-1",
    position: 1,
    kind: "restaurant",
    restaurant_id: "r-1",
    title: "Завтрак",
    description: "",
    photo_url: null,
    address: "ул. Достык, 1",
    latitude: null,
    longitude: null,
    venue: {
      id: "r-1",
      name: "Дареджани",
      address: "ул. Достык, 1",
      cuisine_type: "Грузинская",
      city: "Алматы",
      price_category: "medium",
      primary_image_url: null,
      is_active: true,
    },
    ...over,
  };
}

function detail(over: Partial<GuideRouteDetail> = {}): GuideRouteDetail {
  return {
    id: "route-1",
    slug: "classic-almaty",
    title: "Классический тур по Алматы",
    description: "",
    cover_image_url: null,
    duration_label: "3–4 часа",
    city: "Алматы",
    status: "draft",
    published_at: null,
    position: 0,
    point_count: 1,
    updated_at: "2026-08-01T10:00:00Z",
    points: [point()],
    ...over,
  };
}

function fakeClient(over: Partial<GuideRouteDetailClient> = {}): GuideRouteDetailClient {
  return {
    getGuideRoute: vi.fn(async () => detail()),
    createGuideRoute: vi.fn(),
    updateGuideRoute: vi.fn(),
    publishGuideRoute: vi.fn(async () => detail()),
    unpublishGuideRoute: vi.fn(async () => detail()),
    archiveGuideRoute: vi.fn(async () => detail()),
    addGuideRoutePoint: vi.fn(async () => point()),
    updateGuideRoutePoint: vi.fn(async () => point()),
    deleteGuideRoutePoint: vi.fn(async () => undefined),
    reorderGuideRoutePoints: vi.fn(async () => undefined),
    searchVenues: vi.fn(async () => ({ items: [] })),
    ...over,
  } as GuideRouteDetailClient;
}

async function renderDetail(client: GuideRouteDetailClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <GuideRouteDetailView routeId="route-1" client={client} />
    </QueryClientProvider>,
  );
  // Заголовок, а не просто текст: название стоит и в шапке, и в
  // предпросмотре «как увидит гость».
  await screen.findByRole("heading", { name: "Классический тур по Алматы" });
}

describe("экран гастропрогулки", () => {
  it("показывает маршрут: слаг, город, число остановок, длительность", async () => {
    await renderDetail(fakeClient());

    expect(screen.getByText(/classic-almaty/)).toBeTruthy();
    expect(screen.getByText(/Остановок: 1/)).toBeTruthy();
    // Длительность стоит и в подзаголовке, и в предпросмотре — обе.
    expect(screen.getAllByText(/3–4 часа/).length).toBeGreaterThan(0);
    expect(screen.getByText("Черновик")).toBeTruthy();
  });

  it("«Опубликовать» ходит в ручку публикации, а не в сохранение текста", async () => {
    const client = fakeClient();
    await renderDetail(client);

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));

    await waitFor(() => expect(client.publishGuideRoute).toHaveBeenCalledWith("route-1"));
    expect(client.updateGuideRoute).not.toHaveBeenCalled();
  });

  it("маршрут без остановок: отказ guide_route_empty объясняется словами", async () => {
    const client = fakeClient({
      getGuideRoute: vi.fn(async () => detail({ points: [], point_count: 0 })),
      publishGuideRoute: vi.fn(async () => {
        throw new RepositoryError("validation failed", undefined, 422, undefined, "guide_route_empty");
      }),
    });
    await renderDetail(client);

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("нет ни одной остановки");
    // Отказ до записи — перечитывать экран незачем, кнопки «Обновить» нет.
    expect(screen.queryByRole("button", { name: "Обновить страницу" })).toBeNull();
  });

  it("остановка-«место» добавляется БЕЗ заведения", async () => {
    const client = fakeClient();
    await renderDetail(client);

    fireEvent.click(screen.getByRole("button", { name: "Остановка — место" }));
    // `selector` обязателен: у поля с переводами доступное имя есть и у ввода,
    // и у полосы вкладок языка («Язык поля «Заголовок остановки»»).
    fireEvent.change(screen.getByLabelText(/Заголовок остановки/, { selector: "input" }), {
      target: { value: "Парк Первого Президента" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(client.addGuideRoutePoint).toHaveBeenCalled());
    const [routeId, input] = vi.mocked(client.addGuideRoutePoint).mock.calls[0]!;
    expect(routeId).toBe("route-1");
    expect(input.kind).toBe("place");
    expect(input.restaurant_id).toBeUndefined();
    expect(input.title).toBe("Парк Первого Президента");
    // Пустые поля координат — «точки нет», а не 0,0.
    expect(input.latitude).toBeNull();
    expect(input.longitude).toBeNull();
  });

  it("остановка-заведение без выбранного заведения не отправляется", async () => {
    const client = fakeClient();
    await renderDetail(client);

    fireEvent.click(screen.getByRole("button", { name: "Остановка — заведение" }));
    // `selector` обязателен: у поля с переводами доступное имя есть и у ввода,
    // и у полосы вкладок языка («Язык поля «Заголовок остановки»»).
    fireEvent.change(screen.getByLabelText(/Заголовок остановки/, { selector: "input" }), {
      target: { value: "Ужин" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Выберите заведение");
    expect(client.addGuideRoutePoint).not.toHaveBeenCalled();
  });

  it("перестановка отправляет id остановок целиком", async () => {
    const client = fakeClient({
      getGuideRoute: vi.fn(async () =>
        detail({
          point_count: 2,
          points: [
            point({ id: "p-1", title: "Завтрак", position: 1 }),
            point({ id: "p-2", title: "Ужин", position: 2 }),
          ],
        }),
      ),
    });
    await renderDetail(client);

    fireEvent.click(screen.getByRole("button", { name: "Ниже: Завтрак" }));

    await waitFor(() =>
      expect(client.reorderGuideRoutePoints).toHaveBeenCalledWith("route-1", ["p-2", "p-1"]),
    );
  });

  it("устаревший порядок: экран предлагает перечитать себя, а не переслать заново", async () => {
    const client = fakeClient({
      reorderGuideRoutePoints: vi.fn(async () => {
        throw new RepositoryError(
          "validation failed",
          undefined,
          422,
          undefined,
          "guide_order_mismatch",
        );
      }),
      getGuideRoute: vi.fn(async () =>
        detail({
          point_count: 2,
          points: [
            point({ id: "p-1", title: "Завтрак", position: 1 }),
            point({ id: "p-2", title: "Ужин", position: 2 }),
          ],
        }),
      ),
    });
    await renderDetail(client);

    fireEvent.click(screen.getByRole("button", { name: "Ниже: Завтрак" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Порядок не сохранён");
    expect(screen.getByRole("button", { name: "Обновить страницу" })).toBeTruthy();
  });

  it("удаление остановки спрашивает подтверждение и без него ничего не шлёт", async () => {
    const client = fakeClient();
    await renderDetail(client);

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Убрать: Завтрак" }));
    expect(client.deleteGuideRoutePoint).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Убрать: Завтрак" }));
    await waitFor(() =>
      expect(client.deleteGuideRoutePoint).toHaveBeenCalledWith("route-1", "p-1"),
    );
    confirm.mockRestore();
  });

  it("неопубликованный маршрут прямо сказан в предпросмотре", async () => {
    await renderDetail(fakeClient());

    expect(screen.getByText(/Прогулка не опубликована/)).toBeTruthy();
  });
});
