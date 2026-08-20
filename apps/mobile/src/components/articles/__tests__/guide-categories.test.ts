import type { GuideCategory, GuideCollection } from "@bookeat/api";
import { describe, expect, it } from "vitest";
import {
  categoriesWithCollections,
  filterCollectionsByCategory,
  toGridRows,
} from "../guide-categories";

/**
 * Правила сетки рубрик гастрогида. Проверяем поведение, а не пиксели: какие
 * плитки гость увидит и что покажет отбор.
 */

function collection(slug: string, categorySlugs: string[]): GuideCollection {
  return {
    slug,
    title: `Подборка ${slug}`,
    subtitle: "",
    description: "",
    coverImageUrl: null,
    venueCount: 0,
    categorySlugs,
  };
}

function category(slug: string, position: number): GuideCategory {
  return { slug, title: `Рубрика ${slug}`, position };
}

describe("categoriesWithCollections", () => {
  const collections = [collection("a", ["etno"]), collection("b", ["etno", "coffee"])];

  it("оставляет рубрику, за которой стоит хотя бы одна подборка", () => {
    const visible = categoriesWithCollections([category("etno", 1)], collections);
    expect(visible.map((c) => c.slug)).toEqual(["etno"]);
  });

  it("выбрасывает рубрику, которой не помечена ни одна подборка: плитка вела бы в пустоту", () => {
    const visible = categoriesWithCollections(
      [category("etno", 1), category("wine", 2)],
      collections,
    );
    expect(visible.map((c) => c.slug)).toEqual(["etno"]);
  });

  it("сохраняет порядок редакции, а не порядок подборок", () => {
    const visible = categoriesWithCollections(
      [category("coffee", 1), category("etno", 2)],
      collections,
    );
    expect(visible.map((c) => c.slug)).toEqual(["coffee", "etno"]);
  });

  it("без подборок не показывает ни одной рубрики", () => {
    expect(categoriesWithCollections([category("etno", 1)], [])).toEqual([]);
  });
});

describe("filterCollectionsByCategory", () => {
  const collections = [collection("a", ["etno"]), collection("b", []), collection("c", ["coffee"])];

  it("без выбранной рубрики отдаёт весь список в исходном порядке", () => {
    expect(filterCollectionsByCategory(collections, null).map((c) => c.slug)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("оставляет только подборки выбранной рубрики", () => {
    expect(filterCollectionsByCategory(collections, "coffee").map((c) => c.slug)).toEqual(["c"]);
  });

  it("подборка без рубрик не попадает ни в один отбор", () => {
    expect(filterCollectionsByCategory(collections, "etno").map((c) => c.slug)).toEqual(["a"]);
  });

  it("не мутирует исходный список", () => {
    const source = [...collections];
    filterCollectionsByCategory(source, "etno");
    expect(source.map((c) => c.slug)).toEqual(["a", "b", "c"]);
  });
});

describe("toGridRows", () => {
  it("режет по две плитки в ряд", () => {
    expect(toGridRows([1, 2, 3, 4])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("нечётный хвост остаётся отдельным рядом из одной плитки (её добьёт пустышка)", () => {
    expect(toGridRows([1, 2, 3])).toEqual([[1, 2], [3]]);
  });

  it("пустой список рядов не даёт", () => {
    expect(toGridRows([])).toEqual([]);
  });
});
