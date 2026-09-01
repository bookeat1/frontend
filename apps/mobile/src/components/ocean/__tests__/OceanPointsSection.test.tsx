import type { RestaurantSummary } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import type { UseQueryResult } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { OceanPointsSection } from "../OceanPointsSection";

const t = getDictionary();

/**
 * ЧЕТЫРЕ СОСТОЯНИЯ единственной живой секции фирменной страницы.
 *
 * Секция «Все точки» — единственное место страницы, которое ходит в сеть, и
 * ровно поэтому её состояния нельзя пропустить: остальное лежит в сборке и
 * рисуется всегда. Проверяются все четыре исхода и то, ради чего секция
 * существует, — переход на экран заведения.
 */

function venue(id: string, name: string): RestaurantSummary {
  return {
    id,
    name,
    cuisines: [],
    priceLevel: "₸₸",
    rating: 0,
    reviewsCount: 0,
    address: "ул. Панфилова, 100",
    city: "Алматы",
    description: "",
    schedule: null,
    acceptsOnlineBookings: false,
  };
}

/** Хук подменяется его РЕЗУЛЬТАТОМ: секция принимает запрос пропом именно
 * затем, чтобы состояния проверялись без сети и без провайдера. */
function query(
  state: Partial<UseQueryResult<RestaurantSummary[]>>,
): UseQueryResult<RestaurantSummary[]> {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...state,
  } as UseQueryResult<RestaurantSummary[]>;
}

const VENUES = [
  venue("a", "Ocean Basket Panfilova"),
  venue("b", "Ocean Basket Dostyk Plaza"),
];

describe("секция «Все точки»", () => {
  it("загрузка: показывает заглушку, а не пустой список", () => {
    render(
      <OceanPointsSection
        query={query({ isLoading: true })}
        contentPadding={16}
        onOpenVenue={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(t.oceanBasket.pointsLoading)).toBeTruthy();
  });

  it("отказ: показывает ошибку с повтором и зовёт refetch", () => {
    const refetch = vi.fn();
    render(
      <OceanPointsSection
        query={query({ isError: true, refetch })}
        contentPadding={16}
        onOpenVenue={vi.fn()}
      />,
    );

    expect(screen.getByText(t.oceanBasket.pointsErrorTitle)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(t.common.retry));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("пусто: честное «точек нет», а не бесконечная загрузка", () => {
    render(
      <OceanPointsSection query={query({ data: [] })} contentPadding={16} onOpenVenue={vi.fn()} />,
    );

    expect(screen.getByText(t.oceanBasket.pointsEmptyTitle)).toBeTruthy();
    // Счётчика в заголовке при пустом списке быть не должно: «0 ресторанов»
    // рядом с пустым состоянием — это дважды сказанное одно и то же.
    expect(screen.queryByText(t.articles.venueCount(0))).toBeNull();
  });

  it("список: счётчик считает ПРИШЕДШИЕ точки, имена режутся по бренду", () => {
    render(
      <OceanPointsSection
        query={query({ data: VENUES })}
        contentPadding={16}
        onOpenVenue={vi.fn()}
      />,
    );

    expect(screen.getByText(t.articles.venueCount(2))).toBeTruthy();
    expect(screen.getByText("Panfilova")).toBeTruthy();
    expect(screen.getByText("Dostyk Plaza")).toBeTruthy();
    // Номера точек из макета — «01», «02».
    expect(screen.getByText("01")).toBeTruthy();
    expect(screen.getByText("02")).toBeTruthy();
  });

  it("нажатие на карточку открывает ЭТО заведение", () => {
    const onOpenVenue = vi.fn();
    render(
      <OceanPointsSection
        query={query({ data: VENUES })}
        contentPadding={16}
        onOpenVenue={onOpenVenue}
      />,
    );

    fireEvent.click(screen.getByLabelText(t.articles.openVenue("Ocean Basket Dostyk Plaza")));
    expect(onOpenVenue).toHaveBeenCalledWith("b");
  });
});
