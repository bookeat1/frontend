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

/**
 * НЕСКОЛЬКО КУХОНЬ (переезд на справочник, 2026-08-25).
 *
 * До справочника кухня была одной свободной строкой, и карточка рисовала её
 * одним чипом. Теперь у заведения набор до пяти кухонь, порядок значим:
 * нулевая позиция — главная. Одна строка через запятую тут не годится —
 * «Европейская, Грузинская, Казахская» в одном чипе растягивается на всю
 * карточку и читается как ОДНО название кухни.
 */
describe("кухни на карточке", () => {
  const cuisine = (id: string, name: string) => ({ id, name });

  it("рисует кухни отдельными чипами, главная первой", () => {
    render(
      <RestaurantCard
        restaurant={{
          ...BASE,
          cuisines: [cuisine("georgian", "Грузинская"), cuisine("european", "Европейская")],
        }}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByText("Грузинская")).toBeTruthy();
    expect(screen.getByText("Европейская")).toBeTruthy();
    // Именно два чипа, а не один со склейкой.
    expect(screen.queryByText("Грузинская, Европейская")).toBeNull();
  });

  it("остаток набора сворачивается в «+N», а карточка не разъезжается по высоте", () => {
    render(
      <RestaurantCard
        restaurant={{
          ...BASE,
          cuisines: [
            cuisine("european", "Европейская"),
            cuisine("mediterranean", "Средиземноморская"),
            cuisine("georgian", "Грузинская"),
            cuisine("kazakh", "Казахская"),
          ],
        }}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByText("Европейская")).toBeTruthy();
    expect(screen.getByText("Средиземноморская")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.queryByText("Грузинская")).toBeNull();
  });

  it("скринридер слышит набор ЦЕЛИКОМ, включая свёрнутые под «+N»", () => {
    render(
      <RestaurantCard
        restaurant={{
          ...BASE,
          cuisines: [
            cuisine("european", "Европейская"),
            cuisine("mediterranean", "Средиземноморская"),
            cuisine("georgian", "Грузинская"),
          ],
        }}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Грузинская/ })).toBeTruthy();
  });

  it("заведение без кухонь не показывает ни чипа, ни «+0»", () => {
    // На бою такое есть — «Agora wine and deli» (проверено 2026-08-25).
    render(
      <RestaurantCard
        restaurant={{ ...BASE, name: "Agora wine and deli", cuisines: [] }}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByText("Agora wine and deli")).toBeTruthy();
    expect(screen.queryByText("+0")).toBeNull();
    expect(screen.queryByText("Европейская кухня")).toBeNull();
  });
});
