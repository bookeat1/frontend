import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { VenueCard } from "@web/components/ui/VenueCard";

/**
 * У карточки два места, где она может соврать: битая ссылка на фото (дыра
 * вместо картинки) и пустой список свободного времени (гость видит карточку
 * без единого слота и не понимает, сломалось оно или мест правда нет).
 * Оба закреплены здесь.
 */
describe("VenueCard", () => {
  it("показывает название, подпись и свободное время", () => {
    render(
      <VenueCard name="Flour Demi" meta="Европейская · ₸₸₸ · 1,2 км" slots={["18:00", "18:30"]} />,
    );

    expect(screen.getByRole("heading", { name: "Flour Demi" })).toBeTruthy();
    expect(screen.getByText("Европейская · ₸₸₸ · 1,2 км")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("без свободного времени говорит об этом словами, а не пустотой", () => {
    render(<VenueCard name="Flour Demi" meta="Европейская" />);

    expect(screen.getByText("Свободного времени нет")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("отдаёт выбранное время наверх", () => {
    const onSelectSlot = vi.fn();
    render(<VenueCard name="Flour Demi" meta="Европейская" slots={["18:00"]} onSelectSlot={onSelectSlot} />);

    fireEvent.click(screen.getByRole("button", { name: "18:00" }));

    expect(onSelectSlot).toHaveBeenCalledWith("18:00");
  });

  it("кнопка избранного — переключатель с озвученным состоянием", () => {
    const onToggleFavorite = vi.fn();
    render(
      <VenueCard name="Flour Demi" meta="Европейская" favorite onToggleFavorite={onToggleFavorite} />,
    );

    const button = screen.getByRole("button", { name: "Убрать из избранного" });
    expect(button.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(button);
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it("битая ссылка на фото убирает картинку, а не оставляет дыру", () => {
    render(<VenueCard name="Flour Demi" meta="Европейская" imageUrl="https://pub-x.r2.dev/gone.jpg" />);

    const image = screen.getByRole("img", { name: "Flour Demi" });
    fireEvent.error(image);

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("пустая строка вместо адреса фото картинкой не считается", () => {
    render(<VenueCard name="Flour Demi" meta="Европейская" imageUrl="   " />);

    expect(screen.queryByRole("img")).toBeNull();
  });
});
