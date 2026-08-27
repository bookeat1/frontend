import { AdminApiError, type MyRestaurant } from "@bookeat/api/admin";
import { describe, expect, it } from "vitest";

import { isVenueScopedKey, isVenueUnavailableError, venueAccess } from "../venue-access";

/**
 * Запомненное заведение — это ЗАЯВКА, а не факт: панель хранит выбор в
 * localStorage, и он переживает не только перезагрузку, но и переход с
 * тестового сервера на боевой, где под тем же id лежит другое заведение (или
 * никакого). Здесь проверяется разбор трёх состояний и отделение «заведение
 * недоступно» от «плохая связь».
 */

const venue = (id: string, name: string): MyRestaurant => ({ id, name, role: "owner" });

describe("venueAccess", () => {
  it("ждёт список, пока он не пришёл", () => {
    expect(venueAccess("v-1", undefined)).toBe("checking");
  });

  it("подтверждает заведение, которое есть в списке доступных", () => {
    expect(venueAccess("v-1", [venue("v-1", "Юрта"), venue("v-2", "Тбилиси")])).toBe("granted");
  });

  it("отзывает выбор, когда список пришёл, а заведения в нём нет", () => {
    expect(venueAccess("v-1", [venue("v-2", "Тбилиси")])).toBe("revoked");
  });

  it("пустой список — это тоже ответ: заведение отозвано", () => {
    expect(venueAccess("v-1", [])).toBe("revoked");
  });

  it("нечего проверять, когда заведение не выбрано", () => {
    expect(venueAccess(null, undefined)).toBe("granted");
  });
});

describe("isVenueUnavailableError", () => {
  it("404 и 403 на заведении — это «выберите другое», а не «повторите»", () => {
    expect(isVenueUnavailableError(new AdminApiError("not found", 404))).toBe(true);
    expect(isVenueUnavailableError(new AdminApiError("forbidden", 403))).toBe(true);
  });

  it("сбой сети и ошибка сервера остаются обычной ошибкой с повтором", () => {
    expect(isVenueUnavailableError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isVenueUnavailableError(new AdminApiError("boom", 500))).toBe(false);
    expect(isVenueUnavailableError(undefined)).toBe(false);
  });
});

describe("isVenueScopedKey", () => {
  it("узнаёт ключ запроса про это заведение", () => {
    expect(isVenueScopedKey(["restaurant-social-links", "v-1"], "v-1")).toBe(true);
    expect(isVenueScopedKey(["restaurant-social-links", "v-2"], "v-1")).toBe(false);
    expect(isVenueScopedKey(["cities"], "v-1")).toBe(false);
  });
});
