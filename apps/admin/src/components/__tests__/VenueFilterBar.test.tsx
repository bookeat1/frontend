import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { VenueFilterBar } from "../VenueFilterBar";
import { EMPTY_VENUE_FILTERS, type VenueFilters } from "@/lib/venue-filters";

/**
 * Панель фильтров проверяется как её видит человек: выбранное должно быть
 * видно и сниматься. Спрятанный фильтр — самая дорогая ошибка такого экрана:
 * список «неправильный», а почему — не написано нигде.
 */

const CITY_OPTIONS = [
  { value: "Алматы", label: "Алматы" },
  { value: "Астана", label: "Астана" },
];
const CUISINE_OPTIONS = [
  { value: "казахская", label: "Казахская" },
  { value: "кафе, европейская", label: "Кафе, европейская" },
];

/** Обёртка с настоящим состоянием: панель управляемая, и проверять её в
 * отрыве от владельца состояния значит проверять не то. */
function Harness({ onState }: { onState: (f: VenueFilters) => void }) {
  const [filters, setFilters] = useState<VenueFilters>(EMPTY_VENUE_FILTERS);
  onState(filters);
  return (
    <VenueFilterBar
      filters={filters}
      onChange={setFilters}
      cityOptions={CITY_OPTIONS}
      cuisineOptions={CUISINE_OPTIONS}
      shown={2}
      total={4}
    />
  );
}

function renderBar() {
  let latest: VenueFilters = EMPTY_VENUE_FILTERS;
  render(<Harness onState={(f) => (latest = f)} />);
  return { filters: () => latest };
}

afterEach(cleanup);

describe("VenueFilterBar", () => {
  it("выбранные фильтры видны отдельными пилюлями и снимаются по одной", () => {
    const { filters } = renderBar();

    fireEvent.change(screen.getByLabelText(/^город$/i), { target: { value: "Алматы" } });
    fireEvent.change(screen.getByLabelText(/^кухня$/i), { target: { value: "казахская" } });
    expect(filters()).toMatchObject({ city: "Алматы", cuisine: "казахская" });

    // Оба видны глазами, а не только в полях.
    expect(screen.getByRole("button", { name: /убрать фильтр: Алматы/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /убрать фильтр: Казахская/i })).toBeTruthy();

    // Снимается ровно один — второй остаётся.
    fireEvent.click(screen.getByRole("button", { name: /убрать фильтр: Алматы/i }));
    expect(filters()).toMatchObject({ city: "", cuisine: "казахская" });
    expect(screen.queryByRole("button", { name: /убрать фильтр: Алматы/i })).toBeNull();
  });

  it("статус «Скрытые» — такой же снимаемый фильтр, как и остальные", () => {
    const { filters } = renderBar();
    fireEvent.change(screen.getByLabelText(/^статус$/i), { target: { value: "hidden" } });
    expect(filters().status).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: /убрать фильтр: скрытые/i }));
    expect(filters().status).toBe("all");
  });

  it("одна кнопка сбрасывает все фильтры разом", () => {
    const { filters } = renderBar();

    fireEvent.change(screen.getByLabelText(/поиск по названию/i), { target: { value: "юрта" } });
    fireEvent.change(screen.getByLabelText(/^город$/i), { target: { value: "Астана" } });
    fireEvent.change(screen.getByLabelText(/^кухня$/i), { target: { value: "кафе, европейская" } });
    fireEvent.change(screen.getByLabelText(/^статус$/i), { target: { value: "active" } });

    fireEvent.click(screen.getByRole("button", { name: /сбросить фильтры/i }));

    expect(filters()).toEqual(EMPTY_VENUE_FILTERS);
    expect(screen.queryByRole("button", { name: /сбросить фильтры/i })).toBeNull();
  });

  it("кнопки сброса нет, пока сбрасывать нечего", () => {
    renderBar();
    expect(screen.queryByRole("button", { name: /сбросить фильтры/i })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Показано 2 из 4");
  });
});
