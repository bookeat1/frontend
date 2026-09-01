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
  city: "Алматы",
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

    // Подпись новой карточки — одна строка «кухня · чек» (макет 3452:13344),
    // поэтому ищем ступень ПОДСТРОКОЙ, а не точным совпадением узла.
    expect(screen.getByText(/₸₸/)).toBeTruthy();
    // Числовой диапазон не рисуется, даже когда сервер его прислал.
    expect(screen.queryByText(/8\s?000/)).toBeNull();
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

  it("ступень показывается и без числового диапазона от сервера", () => {
    render(<RestaurantCard restaurant={BASE} onPress={vi.fn()} />);

    expect(screen.getByText(/₸₸/)).toBeTruthy();
    // Кухня при этом на месте: цена не съела подпись.
    expect(screen.getByText(/Европейская кухня/)).toBeTruthy();
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

    expect(screen.getByText(/Грузинская/)).toBeTruthy();
    expect(screen.queryByText(/Грузинская, Европейская/)).toBeNull();
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
    expect(screen.queryByText(/\+0/)).toBeNull();
    expect(screen.queryByText(/Европейская кухня/)).toBeNull();
  });

  it("под названием пишет блюдо, по которому заведение нашлось", () => {
    render(
      <RestaurantCard
        restaurant={{ ...BASE, matchedDish: { id: "d-1", name: "Паста Алио и олио" } }}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByText("В меню: Паста Алио и олио")).toBeTruthy();
    // Блюдо слышит и скринридер: иначе он прочитает карточку заведения, слова
    // из запроса в названии которого нет, и объяснения не получит.
    expect(screen.getByRole("button", { name: /Паста Алио и олио/ })).toBeTruthy();
  });

  it("без совпадения по меню никакой лишней строки не появляется", () => {
    // Так карточка выглядит в избранном и при поиске по названию заведения:
    // сервер `matched_dish` не присылает вовсе.
    render(<RestaurantCard restaurant={BASE} onPress={vi.fn()} />);

    expect(screen.queryByText(/В меню/)).toBeNull();
  });
});
