import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { LoyaltyQrSheet } from "../LoyaltyQrSheet";

/**
 * Шторка «QR-код лояльности» — визуальная заглушка (см. комментарий
 * компонента): проверяется только вёрстка/поведение шторки, не сам QR-код и
 * не число-заглушку под ним (оно случайное на каждое открытие, см.
 * `placeholderLoyaltyCode`).
 */

describe("LoyaltyQrSheet", () => {
  it("visible=false ничего не рисует", () => {
    render(<LoyaltyQrSheet visible={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId("loyalty-qr-sheet")).toBeNull();
  });

  it("visible=true показывает заголовок и инструкцию из макета", () => {
    render(<LoyaltyQrSheet visible onClose={vi.fn()} />);

    expect(screen.getByText("Ваш QR код")).toBeTruthy();
    expect(screen.getByText("Покажите этот QR-код сотруднику")).toBeTruthy();
  });

  it("тап по затемнённому фону закрывает шторку", () => {
    const onClose = vi.fn();
    render(<LoyaltyQrSheet visible onClose={onClose} />);

    const backdrop = screen.getByTestId("loyalty-qr-backdrop");
    // Затемнение — обёртка вокруг Pressable, который и ловит нажатие
    // (та же структура, что у ConfirmSheet/OceanWelcomeDrinkSheet).
    fireEvent.click(backdrop.firstChild as ChildNode);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
