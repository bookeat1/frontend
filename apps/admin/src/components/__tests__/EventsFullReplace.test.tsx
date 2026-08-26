import type { AdminEvent, ApiPage, EventInput } from "@bookeat/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `PUT /admin/events/:id` — ПОЛНАЯ ЗАМЕНА записи. Поле, которого нет в теле,
 * не «остаётся как было», а очищается.
 *
 * Пока у события были только те поля, что рисует форма кабинета, разницы не
 * было видно. С migration 0070/0085 у него появились галерея, город и кнопка,
 * которых эта форма НЕ редактирует, — и одно нажатие «Опубликовать» стирало их
 * все, молча и без единой ошибки на экране.
 */

const listed: { value: AdminEvent[] } = { value: [] };
const updateEvent = vi.fn(async () => listed.value[0]!);

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ restaurant: { id: "r-1", name: "Тестовый" }, user: { id: "u-1" } }),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/api", () => ({
  apiClient: {
    listEvents: vi.fn(
      async (): Promise<ApiPage<AdminEvent>> => ({
        items: listed.value,
        total: listed.value.length,
        pages: 1,
        page: 1,
        per_page: 100,
      }),
    ),
    listVenueFeed: vi.fn(async () => ({ items: [], total: 0, pages: 1, page: 1, per_page: 100 })),
    updateEvent,
    deleteEvent: vi.fn(),
  },
}));

const { EventsView } = await import("../EventsView");

afterEach(() => {
  listed.value = [];
  cleanup();
});

describe("публикация события из кабинета заведения", () => {
  it("не стирает галерею, город и кнопку, которых нет в форме", async () => {
    listed.value = [
      {
        id: "e-1",
        restaurant_id: "r-1",
        title: "Вечер джаза",
        description: "",
        starts_at: "2026-09-01T18:00:00+05:00",
        ends_at: "2026-09-01T23:00:00+05:00",
        status: "draft",
        ticketed: false,
        images: ["https://cdn/1.jpg", "https://cdn/2.jpg"],
        city: "Алматы",
        action: { label: "Купить билет", target: "external", url: "https://ticketon.kz/e/1" },
        created_at: "2026-08-01T10:00:00+05:00",
        updated_at: "2026-08-01T10:00:00+05:00",
      },
    ];

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <EventsView />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Опубликовать" }));

    await waitFor(() => expect(updateEvent).toHaveBeenCalledTimes(1));
    const [, input] = updateEvent.mock.calls[0] as unknown as [string, EventInput];
    expect(input.status).toBe("published");
    expect(input.images).toEqual(["https://cdn/1.jpg", "https://cdn/2.jpg"]);
    expect(input.city).toBe("Алматы");
    expect(input.action).toEqual({ label: "Купить билет", url: "https://ticketon.kz/e/1" });
  });
});
