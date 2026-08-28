import type { Restaurant } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * ЧТО ЭТОТ ФАЙЛ ДЕРЖИТ: карта СПРЯТАНА, но адрес и переход «открыть в картах»
 * работают (правка владельца 28.08.2026, флаг `MAP_PREVIEW_ENABLED`).
 *
 * Поставщика карт на бэкенде нет — ручка отвечает 503 `map_not_configured`, и
 * вместо карты гость видел серую пунктирную заглушку на 180 pt. Спрятана
 * именно КАРТИНКА: если однажды вместе с ней уедет адрес, экран заведения
 * потеряет единственную строку, по которой до него доезжают, и заметить это
 * глазами трудно — блок «Контакты» останется на месте.
 *
 * Тест намеренно проверяет ПОВЕДЕНИЕ при выключенном флаге, а не сам флаг:
 * включат карту — этот файл честно покажет, что заглушка вернулась, и его
 * придётся переписать вместе с решением.
 */

const t = getDictionary();

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../../lib/repository", () => ({
  useRepository: () => ({ getMapPreviewUrl: () => "https://cdn.example/map.png" }),
}));

const { MAP_PREVIEW_ENABLED } = await import("../../../lib/feature-flags");
const { MapPreview } = await import("../MapPreview");
const { VenueContactsSection } = await import("../../detail/VenueContactsSection");
const { hasAnyContact } = await import("../ContactsCard");

const RESTAURANT = {
  id: "r-1",
  name: "Mongol",
  address: "Абая 10",
  phone: "+77070000000",
  latitude: 43.24,
  longitude: 76.9,
  social: {},
} as unknown as Restaurant;

describe("карта временно спрятана", () => {
  it("MapPreview не рисует ничего — ни карты, ни заглушки", () => {
    const { container } = render(<MapPreview restaurant={RESTAURANT} />);

    expect(container.textContent).toBe("");
    expect(screen.queryByText(t.booking.mapPlaceholderTitle)).toBeNull();
  });

  it("молчит и там, где у заведения нет координат", () => {
    const noCoordinates = { ...RESTAURANT, latitude: undefined, longitude: undefined } as Restaurant;
    const { container } = render(<MapPreview restaurant={noCoordinates} />);

    expect(container.textContent).toBe("");
    expect(screen.queryByText(t.booking.mapNoCoordinates)).toBeNull();
  });

  it("оставляет адрес в блоке контактов афиши", () => {
    render(<VenueContactsSection restaurant={RESTAURANT} />);

    expect(screen.getByText(t.restaurant.contacts)).toBeTruthy();
    expect(screen.getByText(RESTAURANT.address)).toBeTruthy();
    expect(screen.queryByText(t.booking.mapPlaceholderTitle)).toBeNull();
  });

  it("не показывает карточку «Контакты» заведению, у которого есть только точка на карте", () => {
    const onlyCoordinates = {
      ...RESTAURANT,
      address: "",
      phone: "",
      social: {},
    } as unknown as Restaurant;

    // Пока карта пряталась, такое заведение получало карточку с одним
    // заголовком и пустотой под ним.
    expect(hasAnyContact(onlyCoordinates)).toBe(false);
    expect(MAP_PREVIEW_ENABLED).toBe(false);
  });
});
