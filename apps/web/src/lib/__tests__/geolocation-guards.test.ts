import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildSearchQuery, parseCatalogParams, serializeCatalogParams } from "@web/lib/catalog-params";

/**
 * Геопозиция в вебе (спека geolocation-permission.md, критерий 27): `near`
 * принадлежит ТОЛЬКО листингу /venues. Серверный рендер, sitemap и главная
 * координат не передают никогда.
 */

const WEB_ROOT = join(__dirname, "..", "..", "..");

function source(relative: string): string {
  return readFileSync(join(WEB_ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("near только в листинге", () => {
  it.each([
    "src/lib/seo/server-repository.ts",
    "app/sitemap.ts",
    "src/components/home/HomeScreen.tsx",
    "app/page.tsx",
  ])("%s не знает про near и геопозицию", (file) => {
    expect(source(file)).not.toMatch(/\bnear\b|useBrowserGeolocation|geolocation/);
  });

  it("getCurrentPosition зовётся только из src/lib/geolocation.ts", () => {
    expect(source("src/lib/geolocation.ts")).toMatch(/getCurrentPosition/);
    expect(source("src/components/catalog/CatalogScreen.tsx")).not.toMatch(/getCurrentPosition/);
  });
});

describe("buildSearchQuery с near", () => {
  const state = parseCatalogParams(new URLSearchParams("sort=nearest"));

  it("sort=nearest читается из адреса и пишется обратно, координат в адресе нет", () => {
    expect(state.sort).toBe("nearest");
    expect(serializeCatalogParams(state)).toBe("sort=nearest");
  });

  it("кладёт округлённый near при пустом тексте", () => {
    const query = buildSearchQuery(state, "Алматы", { lat: 43.238123, lng: 76.945678 });
    expect(query.near).toEqual({ lat: 43.238, lng: 76.946 });
  });

  it("с текстом запроса near не кладёт", () => {
    const withText = parseCatalogParams(new URLSearchParams("sort=nearest&q=суши"));
    expect(buildSearchQuery(withText, "Алматы", { lat: 43.2, lng: 76.9 }).near).toBeUndefined();
  });

  it("без near ключа в запросе нет вовсе (ключ кэша прежний)", () => {
    expect("near" in buildSearchQuery(state, "Алматы")).toBe(false);
  });
});
