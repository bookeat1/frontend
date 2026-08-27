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

  it("статус заведения слышит скринридер, хотя на снимке его больше нет", () => {
    // В новой карточке (макет 3452:13344) под снимком нет места: там только имя
    // и одна строка «кухня · чек». Статус открытости остался в метке карточки —
    // терять его при смене вёрстки было бы регрессом доступности.
    render(
      <RestaurantCard
        restaurant={{ ...BASE, schedule: { openNow: false, todayHours: null } as never }}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Закрыт/ })).toBeTruthy();
  });

  it("без числового диапазона чипа цены нет вовсе, а не символы ₸₸", () => {
    render(<RestaurantCard restaurant={BASE} onPress={vi.fn()} />);

    expect(screen.queryByText("₸₸")).toBeNull();
    // Кухня при этом на месте: пропадает именно цена, а не вся подпись.
    expect(screen.getByText("Европейская кухня")).toBeTruthy();
  });
});

/**
 * НЕСКОЛЬКО КУХОНЬ (переезд на справочник, 2026-08-25; вёрстка сменилась
 * 2026-08-27).
 *
 * До справочника кухня была одной свободной строкой. Потом у заведения стал
 * набор до пяти кухонь, и карточка рисовала первые две отдельными чипами под
 * снимком, а остаток сворачивала в «+N».
 *
 * В новой карточке (макет 3z0f6dgev4HMwBAHPjTjPo, node 3452:13344) ряда чипов
 * нет вовсе: под именем места одна строка «кухня · чек», и в макете там ровно
 * ОДНО название кухни. Поэтому на снимке видна главная, а весь набор целиком
 * уходит в метку для скринридера — ровно то, что раньше делало «+N».
 */
describe("кухни на карточке", () => {
  const cuisine = (id: string, name: string) => ({ id, name });

  it("в подписи — главная кухня, набора через запятую на снимке нет", () => {
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
    expect(screen.queryByText("Грузинская, Европейская")).toBeNull();
  });

  it("скринридер слышит набор ЦЕЛИКОМ, включая непоказанные кухни", () => {
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

  it("заведение без кухонь не показывает ни подписи кухни, ни «+0»", () => {
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
