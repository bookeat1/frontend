import { colors } from "@bookeat/design-tokens";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { FavoriteButton } from "../FavoriteButton";

/**
 * Сердечко избранного.
 *
 * Правка 2026-09-01 по макету 3z0f6dgev4HMwBAHPjTjPo, node 3053:10169
 * («Избранное»): залитое сердечко у сохранённой карточки — #B33036 (узлы
 * 3593:8608, 3593:8611, 3593:8614). Прежний #FF3838 в макете не встречается
 * нигде: его сняли пипеткой с картинки-референса, и он был ярче фирменного.
 *
 * Проверяем ГРАНИЦУ «сохранено / не сохранено»: цвет и начертание глифа
 * должны различаться, иначе сердечко снова начнёт врать о состоянии.
 */

describe("сердечко избранного", () => {
  it("залитое сердечко красит фирменным бордовым из макета", () => {
    render(<FavoriteButton itemName="Flour Demi" isFavorite onToggle={vi.fn()} />);

    const glyph = screen.getByTestId("icon-Heart");
    expect(glyph.getAttribute("data-color")).toBe(colors.brand.favorite);
    expect(colors.brand.favorite).toBe("#B33036");
    expect(glyph.getAttribute("data-weight")).toBe("fill");
  });

  it("несохранённое сердечко остаётся белым контуром", () => {
    render(<FavoriteButton itemName="Flour Demi" isFavorite={false} onToggle={vi.fn()} />);

    const glyph = screen.getByTestId("icon-Heart");
    expect(glyph.getAttribute("data-color")).toBe(colors.text.onDark);
    expect(glyph.getAttribute("data-weight")).toBe("regular");
  });
});
