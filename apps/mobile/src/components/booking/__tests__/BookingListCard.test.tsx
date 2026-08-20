import type { Booking, RestaurantSummary } from "@bookeat/api";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Строка «Мои брони» (Figma dVjT37j984ErvOmzxlx29p, node 3004:6807).
 *
 * Ответ `GET /bookings` не несёт ни названия, ни адреса, ни фотографии —
 * только `restaurant_id`. Всё это приходит запросом-сводкой, поэтому здесь
 * проверяется именно стык: сводка пришла — есть адрес, сводка не пришла —
 * строки адреса нет и выдуманного адреса нет тоже.
 */

const summaryState: { data?: RestaurantSummary; isError: boolean } = { isError: false };

vi.mock("../../../hooks/useRestaurant", () => ({
  useRestaurantSummary: () => summaryState,
}));

const { BookingListCard } = await import("../BookingListCard");

const VENUE: RestaurantSummary = {
  id: "r-1",
  name: "Flour Demi",
  cuisines: [],
  priceLevel: "₸₸",
  rating: 4.8,
  reviewsCount: 120,
  address: "проспект Аль-Фараби, 128В",
  description: "",
  schedule: null,
  acceptsOnlineBookings: true,
};

const BOOKING: Booking = {
  id: "b-1",
  restaurantId: "r-1",
  name: "Дамир",
  phone: "+77010000000",
  guests: 2,
  startsAt: "2026-07-29T15:30:00Z",
  endsAt: "2026-07-29T17:30:00Z",
  status: "pending",
  notes: null,
  freeCancelDeadline: null,
};

beforeEach(() => {
  summaryState.data = VENUE;
  summaryState.isError = false;
});

describe("BookingListCard", () => {
  it("показывает статус, число гостей и адрес заведения", () => {
    render(<BookingListCard booking={BOOKING} onPress={vi.fn()} />);

    expect(screen.getByText("Flour Demi")).toBeDefined();
    expect(screen.getByText("Ждёт подтверждения")).toBeDefined();
    expect(screen.getByText("2 гостя")).toBeDefined();
    expect(screen.getByText("проспект Аль-Фараби, 128В")).toBeDefined();
  });

  it("не рисует строку адреса, пока сводка о заведении не пришла", () => {
    summaryState.data = undefined;

    render(<BookingListCard booking={BOOKING} onPress={vi.fn()} />);

    // Гости всё равно известны — они лежат в самой брони.
    expect(screen.getByText("2 гостя")).toBeDefined();
    expect(screen.queryByTestId("icon-MapPin")).toBeNull();
    expect(screen.getByText("Загружаем название…")).toBeDefined();
  });

  it("на упавшей сводке говорит об этом, а не подставляет пустой адрес", () => {
    summaryState.data = undefined;
    summaryState.isError = true;

    render(<BookingListCard booking={BOOKING} onPress={vi.fn()} />);

    expect(screen.getByText("Название ресторана не загрузилось")).toBeDefined();
    expect(screen.queryByTestId("icon-MapPin")).toBeNull();
  });

  it("отменённая бронь показывает свой статус, а не статус ожидания", () => {
    render(<BookingListCard booking={{ ...BOOKING, status: "cancelled" }} onPress={vi.fn()} />);

    expect(screen.getByText("Отменена")).toBeDefined();
  });

  it("открывает бронь по нажатию", () => {
    const onPress = vi.fn();
    render(<BookingListCard booking={BOOKING} onPress={onPress} />);

    screen.getByRole("button").click();

    expect(onPress).toHaveBeenCalledWith("b-1");
  });
});
