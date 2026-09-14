import type { AdminBooking } from "@bookeat/api/admin";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * «Гость пришёл» в списке броней кабинета.
 *
 * Часть механики марафона Алматы (27.09.2026): без этой кнопки бронь с меткой
 * промо никогда не покидает `confirmed` иначе как через no-show воркера
 * (30 минут после конца окна брони, терминально) — гость, который реально
 * пришёл, не попадёт в список на подарки. Кнопка общая для всех броней, не
 * только марафонских: хостес отмечает визит, а не участие в акции.
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
    starts_at: "2026-09-27T12:30:00Z",
    ends_at: "2026-09-27T14:00:00Z",
    status: "confirmed",
    source: "app",
    notes: null,
    cancelled_by: null,
    cancellation_reason: null,
    confirmed_at: "2026-09-27T09:00:00Z",
    arrived_at: null,
    created_at: "2026-09-27T09:00:00Z",
    preorder: [],
    ...overrides,
  };
}

describe("«Гость пришёл» в списке броней кабинета", () => {
  it("показывает кнопку для подтверждённой брони и вызывает onAction(id, \"arrive\")", () => {
    const onAction = vi.fn();
    render(
      <BookingsTable
        bookings={[booking({ status: "confirmed" })]}
        pending={undefined}
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByText("Гость пришёл"));
    expect(onAction).toHaveBeenCalledWith("b-1", "arrive");
  });

  it("не показывает кнопку для уже пришедшей или ожидающей брони", () => {
    render(
      <BookingsTable
        bookings={[booking({ status: "arrived" }), booking({ id: "b-2", status: "pending" })]}
        pending={undefined}
        onAction={vi.fn()}
      />,
    );

    expect(screen.queryByText("Гость пришёл")).toBeNull();
  });

  it("для уже пришедшей брони не предлагает «Не пришёл» (бэкенд отклонит переход 422)", () => {
    render(
      <BookingsTable bookings={[booking({ status: "arrived" })]} pending={undefined} onAction={vi.fn()} />,
    );

    expect(screen.queryByText("Не пришёл")).toBeNull();
    expect(screen.getByText("Отменить")).toBeTruthy();
  });

  it("блокирует кнопку, пока запрос по этой же брони в полёте", () => {
    render(
      <BookingsTable
        bookings={[booking({ status: "confirmed" })]}
        pending={{ bookingId: "b-1", kind: "arrive" }}
        onAction={vi.fn()}
      />,
    );

    const button = screen.getByText("Гость пришёл").closest("button");
    expect(button?.disabled).toBe(true);
  });
});
