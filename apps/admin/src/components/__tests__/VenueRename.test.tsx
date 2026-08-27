import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CatalogVenue, CatalogVenueInput } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Переименование заведения из каталога.
 *
 * Сервер отдаёт не колонку `name`, а перевод `name_i18n[язык] ?? name`, и
 * браузер всегда просит ru. Пока панель писала одно плоское `name`, запись
 * уходила в колонку, которую после этого никто не читает: PATCH отвечал 200, а
 * название на экране (и в приложении) оставалось прежним — и следующее
 * сохранение возвращало старый перевод обратно.
 */

// Обычные функции, а не vi.fn(): в этом проекте включён `restoreMocks`, и
// подготовленный через mockResolvedValue ответ до теста не доживает.
vi.mock("@/lib/api", () => ({
  apiClient: {
    getRestaurantSocialLinks: async () => [],
    getRestaurantCuisines: async () => [],
    getRestaurantFeatures: async () => [],
    uploadImage: async () => {
      throw new Error("не должно вызываться");
    },
  },
}));

const { VenueFormModal } = await import("../VenuesView");

const venue = (nameI18n?: Record<string, string>): CatalogVenue => ({
  id: "v-1",
  name: nameI18n?.ru ?? "THE ME’ET",
  name_i18n: nameI18n,
  description: "Барбекю-ресторан",
  cuisine_type: "",
  address: "Алматы, Достык 1",
  city: "Алматы",
  price_category: "₸₸",
  email: "",
  phone: "",
  latitude: null,
  longitude: null,
  is_active: true,
});

function renderForm(v: CatalogVenue, saveVenue: (input: CatalogVenueInput, id: string | null) => Promise<CatalogVenue>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VenueFormModal
        title="Правка"
        venue={v}
        dictionary={[]}
        featureDictionary={[]}
        cityDictionary={[
          { id: "c-1", code: "almaty", name: "Алматы", value: "Алматы", display_order: 1, is_active: true },
        ]}
        saveVenue={saveVenue}
        saveCuisines={vi.fn().mockResolvedValue(undefined)}
        saveFeatures={vi.fn().mockResolvedValue(undefined)}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("Переименование заведения", () => {
  it("переписывает русский перевод вместе с колонкой name", async () => {
    const saved = venue({ ru: "Тбилиси", kk: "Тбилиси" });
    const saveVenue = vi.fn().mockResolvedValue(saved);
    renderForm(venue({ ru: "THE ME’ET", kk: "МИТ" }), saveVenue);

    fireEvent.change(await screen.findByLabelText(/Название/), {
      target: { value: "Тбилиси" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    await waitFor(() => expect(saveVenue).toHaveBeenCalled());
    const [input] = saveVenue.mock.calls[0] as [CatalogVenueInput, string | null];
    expect(input.name).toBe("Тбилиси");
    // Карта замещается целиком, поэтому казахский перевод обязан уехать вместе
    // с русским — иначе переименование стёрло бы его.
    expect(input.name_i18n).toEqual({ ru: "Тбилиси", kk: "МИТ" });
  });

  it("не заводит переводов там, где их не было", async () => {
    const saveVenue = vi.fn().mockResolvedValue(venue());
    renderForm(venue(undefined), saveVenue);

    fireEvent.change(await screen.findByLabelText(/Название/), {
      target: { value: "Тбилиси" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    await waitFor(() => expect(saveVenue).toHaveBeenCalled());
    const [input] = saveVenue.mock.calls[0] as [CatalogVenueInput, string | null];
    expect(input.name).toBe("Тбилиси");
    expect(input.name_i18n).toBeUndefined();
  });
});
