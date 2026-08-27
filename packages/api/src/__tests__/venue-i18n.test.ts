import { describe, expect, it } from "vitest";

import { mergeVenueNameI18n } from "../admin/venue-i18n";

/**
 * Переименование заведения из панели не работало: панель писала колонку `name`,
 * а показывалась (и себе, и приложению) `name_i18n.ru` — сервер отдаёт перевод
 * по языку запроса, а браузер всегда шлёт ru.
 */

describe("mergeVenueNameI18n", () => {
  it("переписывает русский перевод и сохраняет остальные языки", () => {
    expect(mergeVenueNameI18n({ ru: "THE ME’ET", kk: "МИТ", en: "The Meet" }, "Тбилиси")).toEqual({
      ru: "Тбилиси",
      kk: "МИТ",
      en: "The Meet",
    });
  });

  it("не шлёт карту, когда русского перевода у заведения нет: читается колонка", () => {
    expect(mergeVenueNameI18n(undefined, "Тбилиси")).toBeUndefined();
    expect(mergeVenueNameI18n({}, "Тбилиси")).toBeUndefined();
    expect(mergeVenueNameI18n({ en: "The Meet" }, "Тбилиси")).toBeUndefined();
  });

  it("не шлёт карту, когда название не менялось", () => {
    expect(mergeVenueNameI18n({ ru: "Тбилиси" }, "Тбилиси")).toBeUndefined();
  });

  it("пустое русское название — это изменение, а не «нет перевода»", () => {
    expect(mergeVenueNameI18n({ ru: "" }, "Тбилиси")).toEqual({ ru: "Тбилиси" });
  });
});
