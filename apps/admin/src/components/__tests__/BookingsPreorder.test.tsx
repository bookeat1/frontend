import type { AdminBooking } from "@bookeat/api/admin";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * Состав предзаказа в списке броней кабинета.
 *
 * 24.08.2026 владелец сделал первый живой предзаказ и не нашёл его в кабинете:
 * блюда доходили до сервера, но заведение видело только время и имя гостя, а
 * повар не знал, что готовить. Здесь закреплено, что состав виден в самой
 * строке брони и не появляется пустым заголовком там, где заказа нет.
 */

vi.mock("@/lib/api", () => ({ apiClient: {} }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ restaurant: { id: "r-1" } }) }));

const { BookingsTable } = await import("../BookingsView");

function booking(overrides: Partial<AdminBooking>): AdminBooking {
  return {
    id: "b-1",
    restaurant_id: "r-1",
    user_id: null,
    name: "Дамир",
    phone: "+77078692233",
    email: "",
    guests: 2,
    starts_at: "2026-08-24T12:30:00Z",
    ends_at: "2026-08-24T14:00:00Z",
    status: "pending",
    source: "app",
    notes: null,
    cancelled_by: null,
    cancellation_reason: null,
    confirmed_at: null,
    created_at: "2026-08-24T09:00:00Z",
    preorder: [],
    ...overrides,
  };
}

describe("предзаказ в списке броней кабинета", () => {
  it("показывает блюда с количеством и итогом", () => {
    render(
      <BookingsTable
        bookings={[
          booking({
            preorder: [
              { name: "Кымыз 1л", quantity: 1, price_minor: 430000, total_minor: 430000 },
              { name: "Айран 200мл", quantity: 2, price_minor: 110000, total_minor: 220000 },
            ],
          }),
        ]}
        pending={undefined}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByText("1 × Кымыз 1л")).toBeTruthy();
    expect(screen.getByText("2 × Айран 200мл")).toBeTruthy();
    // Итог считается по строкам, а не берётся из первой попавшейся.
    expect(screen.getByText(/6\s?500/)).toBeTruthy();
  });

  it("у брони без предзаказа блока нет вовсе", () => {
    render(<BookingsTable bookings={[booking({})]} pending={undefined} onAction={vi.fn()} />);

    expect(screen.queryByText("Предзаказ")).toBeNull();
  });
});
