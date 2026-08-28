import type { GuideCollection } from "@bookeat/api";
import { describe, expect, it } from "vitest";
import { splitGuideCollections } from "../guide-collections";

function collection(slug: string, categorySlugs: string[]): GuideCollection {
  return {
    slug,
    kind: "collection",
    title: slug,
    subtitle: "",
    description: "",
    coverImageUrl: null,
    venueCount: 0,
    categorySlugs,
  };
}

describe("splitGuideCollections", () => {
  it("подборка с рубрикой идёт в сетку, без рубрики — в список под ней", () => {
    const { rubrics, editorPicks } = splitGuideCollections([
      collection("kazakh-cuisine", ["kazakh-cuisine-rubric"]),
      collection("almaty-longread", []),
      collection("coffee-culture", ["coffee-culture-rubric"]),
    ]);

    expect(rubrics.map((c) => c.slug)).toEqual(["kazakh-cuisine", "coffee-culture"]);
    expect(editorPicks.map((c) => c.slug)).toEqual(["almaty-longread"]);
  });

  it("ни одна подборка не попадает в обе группы", () => {
    const source = [collection("a", ["r"]), collection("b", [])];
    const { rubrics, editorPicks } = splitGuideCollections(source);

    expect(rubrics.length + editorPicks.length).toBe(source.length);
    expect(rubrics.some((c) => editorPicks.includes(c))).toBe(false);
  });

  it("рубрик нет ни у кого — сетка пуста, весь гастрогид остаётся списком", () => {
    const { rubrics, editorPicks } = splitGuideCollections([
      collection("a", []),
      collection("b", []),
    ]);

    expect(rubrics).toEqual([]);
    expect(editorPicks.map((c) => c.slug)).toEqual(["a", "b"]);
  });

  it("рубрики есть у всех — списка под сеткой нет", () => {
    const { rubrics, editorPicks } = splitGuideCollections([
      collection("a", ["r1"]),
      collection("b", ["r2"]),
    ]);

    expect(rubrics.map((c) => c.slug)).toEqual(["a", "b"]);
    expect(editorPicks).toEqual([]);
  });

  it("порядок сервера сохраняется внутри обеих групп", () => {
    const { rubrics } = splitGuideCollections([
      collection("second", ["r"]),
      collection("first", ["r"]),
    ]);

    expect(rubrics.map((c) => c.slug)).toEqual(["second", "first"]);
  });

  it("исходный массив не меняется", () => {
    const source = [collection("a", ["r"]), collection("b", [])];
    splitGuideCollections(source);

    expect(source.map((c) => c.slug)).toEqual(["a", "b"]);
  });
});
