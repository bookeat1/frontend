import type { RestaurantSummary } from "@bookeat/api";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { RestaurantCard } from "../RestaurantCard";

/**
 * Карточка заведения в списках.
 *
 * Проверяется одно правило, которое ломается тихо: средний чек пишется ТОЛЬКО
 * цифрами (правка владельца 2026-08-20). Раньше заведение без числового
 * диапазона получало символьную ступень (₸₸), и в одном списке цена была
 * написана на двух языках — сравнить карточки глазами становилось нельзя.
 * Теперь у такого заведения чипа цены нет вовсе.
 */

const BASE: RestaurantSummary = {
  id: "r-1",
  name: "Flour Demi",
  cuisines: [{ id: "c-1", name: "Европейская кухня" }],
  priceLevel: "₸₸",
  rating: 4.8,
  reviewsCount: 120,
  address: "проспект Аль-Фараби, 128В",
  description: "",
  schedule: null,
  acceptsOnlineBookings: true,
};

describe("карточка заведения", () => {
  it("показывает средний чек цифрами, когда диапазон есть", () => {
    render(
      <RestaurantCard
        restaurant={{ ...BASE, priceRange: { min: 8000, max: 15000 } }}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByText(/8\s?000/)).toBeTruthy();
    expect(screen.queryByText("₸₸")).toBeNull();
  });

  it("статус заведения — такой же чип, как остальные метки", () => {
    // Раньше «Открыто»/«Закрыто» было подписью старого вида: на одной карточке
    // соседствовали метка-пилюля и обычная строка.
    render(
      <RestaurantCard
        restaurant={{ ...BASE, schedule: { openNow: false, todayHours: null } as never }}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByText(/Закрыт/)).toBeTruthy();
  });

  it("без числового диапазона чипа цены нет вовсе, а не символы ₸₸", () => {
    render(<RestaurantCard restaurant={BASE} onPress={vi.fn()} />);

    expect(screen.queryByText("₸₸")).toBeNull();
    // Кухня при этом на месте: пропадает именно цена, а не весь ряд меток.
    expect(screen.getByText("Европейская кухня")).toBeTruthy();
  });
});
