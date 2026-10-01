import { describe, expect, it } from "vitest";
import { en } from "../en";
import { kk } from "../kk";
import { ru } from "../ru";

/** Спека geolocation-permission.md, критерий 30: каждая новая строка геопозиции
 * есть в kk и en, непустая и не равна русской (то есть не молчаливый фолбэк). */
describe("location strings", () => {
  const keys = Object.keys(ru.location) as (keyof typeof ru.location)[];

  it("has the keys the spec lists", () => {
    expect(keys.length).toBe(13);
  });

  for (const key of keys) {
    it(`${key}: kk and en are filled and differ from ru`, () => {
      for (const dict of [kk, en]) {
        const value = dict.location?.[key];
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
        expect(value).not.toBe(ru.location[key]);
      }
    });
  }
});
