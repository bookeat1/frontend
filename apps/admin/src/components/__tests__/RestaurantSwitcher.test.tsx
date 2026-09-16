import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { MyRestaurant } from "@bookeat/api/admin";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RestaurantSwitcher } from "../RestaurantSwitcher";

/**
 * Скрытое/неактивное заведение (`is_active: false`) должно быть явно
 * помечено значком «Скрыто» — и в «Недавних», и в результатах поиска — но
 * остаётся кликабельным: суперадмин им всё ещё управляет. Регрессия на
 * задачу владельца «пометить скрытые заведения в переключателе».
 */

const VENUES: MyRestaurant[] = [
  { id: "v-1", name: "Юрта", role: "owner", is_active: true },
  { id: "v-2", name: "Тбилиси", role: "manager", is_active: false },
];

const selectRestaurant = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    restaurant: { id: "v-1", name: "Юрта" },
    selectRestaurant,
    user: { id: "u-1", role: "manager" },
  }),
}));

vi.mock("@/lib/use-my-restaurants", async () => {
  const actual = await vi.importActual<typeof import("../../lib/use-my-restaurants")>(
    "../../lib/use-my-restaurants",
  );
  return {
    ...actual,
    useMyRestaurants: () => ({ data: VENUES, isLoading: false, isError: false }),
  };
});

afterEach(() => {
  cleanup();
  selectRestaurant.mockClear();
});

describe("RestaurantSwitcher", () => {
  it("помечает скрытое заведение значком «Скрыто» в списке результатов", () => {
    render(<RestaurantSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /Сменить заведение/i }));

    const hiddenRow = screen.getByRole("button", { name: /Тбилиси/i });
    expect(hiddenRow.textContent).toContain("Скрыто");

    const visibleRow = screen.getByRole("button", { name: /^Юрта/i });
    expect(visibleRow.textContent).not.toContain("Скрыто");
  });

  it("скрытое заведение остаётся кликабельным", () => {
    render(<RestaurantSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /Сменить заведение/i }));

    fireEvent.click(screen.getByRole("button", { name: /Тбилиси/i }));
    expect(selectRestaurant).toHaveBeenCalledWith({ id: "v-2", name: "Тбилиси" });
  });

  it("значок «Скрыто» появляется и в результатах поиска", () => {
    render(<RestaurantSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /Сменить заведение/i }));
    fireEvent.change(screen.getByPlaceholderText(/Поиск по названию/i), {
      target: { value: "Тбилиси" },
    });

    const hiddenRow = screen.getByRole("button", { name: /Тбилиси/i });
    expect(hiddenRow.textContent).toContain("Скрыто");
  });
});
