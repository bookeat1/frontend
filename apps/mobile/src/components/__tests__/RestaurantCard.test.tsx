import type { RestaurantSummary } from "@bookeat/api";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { RestaurantCard } from "../RestaurantCard";

/**
 * Карточка заведения в списках.
 *
 * Проверяется одно правило, которое ломается тихо: цена пишется символьной
 * ступенью ₸/₸₸/₸₸₸ (правка владельца 2026-08-24, откат числового диапазона от
 * 2026-08-20). Ступень приходит с сервера у каждого заведения, поэтому чип
 * цены есть ВСЕГДА — и он не зависит от того, заполнил ли маркетолог средний
 * чек в тенге.
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
  it("показывает ценовую ступень символами, а не суммой в тенге", () => {
    render(
      <RestaurantCard
        restaurant={{ ...BASE, priceRange: { min: 8000, max: 15000 } }}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByText("₸₸")).toBeTruthy();
    // Числовой диапазон не рисуется, даже когда сервер его прислал.
    expect(screen.queryByText(/8\s?000/)).toBeNull();
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

  it("ступень показывается и без числового диапазона от сервера", () => {
    render(<RestaurantCard restaurant={BASE} onPress={vi.fn()} />);

    expect(screen.getByText("₸₸")).toBeTruthy();
    // Кухня при этом на месте: цена не съела ряд меток.
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
