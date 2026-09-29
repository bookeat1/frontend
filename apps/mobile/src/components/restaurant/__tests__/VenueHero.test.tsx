import { __mockRestaurants } from "@bookeat/api";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";
import { describe, expect, it, vi } from "vitest";
import { VenueHero } from "../VenueHero";

/**
 * Кнопка «QR-код лояльности» в шапке (2026-09-29, node 5386:6855): стоит
 * первой в правой группе, перед сердечком, и открывает `LoyaltyQrSheet` —
 * визуальную заглушку без реального бэкенда лояльности (см. её комментарий).
 * Здесь проверяется только сама кнопка шапки — что она есть, с a11y-подписью,
 * и что нажатие зовёт колбэк, а не рисует шторку внутри VenueHero (шторка
 * открывается экраном, а не самим компонентом шапки).
 */

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderHero(overrides: Partial<React.ComponentProps<typeof VenueHero>> = {}) {
  const onOpenLoyaltyQr = vi.fn();
  const utils = render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <VenueHero
        restaurant={__mockRestaurants[0]}
        isFavorite={false}
        onToggleFavorite={vi.fn()}
        onBack={vi.fn()}
        onShare={vi.fn()}
        onOpenLoyaltyQr={onOpenLoyaltyQr}
        {...overrides}
      />
    </SafeAreaProvider>,
  );
  return { ...utils, onOpenLoyaltyQr };
}

describe("VenueHero — кнопка QR-код лояльности", () => {
  it("нажатие зовёт onOpenLoyaltyQr", () => {
    const { onOpenLoyaltyQr } = renderHero();

    fireEvent.click(screen.getByRole("button", { name: "QR-код лояльности" }));

    expect(onOpenLoyaltyQr).toHaveBeenCalledTimes(1);
  });

  it("стоит раньше сердечка и «поделиться» в разметке — порядок макета QR → нравится → поделиться", () => {
    renderHero();

    const buttons = screen.getAllByRole("button");
    const labels = buttons.map((button) => button.getAttribute("aria-label"));
    const qrIndex = labels.indexOf("QR-код лояльности");
    const shareIndex = labels.indexOf("Поделиться");

    expect(qrIndex).toBeGreaterThanOrEqual(0);
    expect(qrIndex).toBeLessThan(shareIndex);
  });
});
