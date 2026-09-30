import { describe, expect, it } from "vitest";

import { PROFILE_SECTIONS, parseSection, sectionHref } from "@web/components/profile/ProfileNav";

/**
 * `ProfileNav` — маршрутизация раздела. Спека
 * `foodie-profile-web-desktop-20260930.md`, критерии 1-2: «Фуди-профиль»
 * третьим пунктом (после «Избранное», перед «Настройки»), неизвестное
 * значение `?section=` по-прежнему даёт «Мои брони».
 */
describe("parseSection", () => {
  it("«foodie» разбирается в раздел foodie", () => {
    expect(parseSection("foodie")).toBe("foodie");
  });

  it("неизвестное значение — «bookings»", () => {
    expect(parseSection("whatever")).toBe("bookings");
    expect(parseSection(null)).toBe("bookings");
  });

  it("порядок разделов: брони, избранное, фуди-профиль, настройки", () => {
    expect(PROFILE_SECTIONS).toEqual(["bookings", "favorites", "foodie", "settings"]);
  });

  it("адрес раздела — /profile?section=foodie", () => {
    expect(sectionHref("foodie")).toBe("/profile?section=foodie");
  });
});
