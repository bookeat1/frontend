import { describe, expect, it } from "vitest";
import {
  CUISINE_SELECTION_LIMIT,
  DIET_EXCLUSIVE_ID,
  toggleAllergySelection,
  toggleBudgetSelection,
  toggleCuisineSelection,
  toggleDietSelection,
} from "../foodie-profile-selection";

describe("toggleCuisineSelection", () => {
  it("adds an unselected cuisine below the limit", () => {
    const result = toggleCuisineSelection(["kazakh"], "italian");
    expect(result).toEqual({ next: ["kazakh", "italian"], blockedByLimit: false });
  });

  it("removes an already-selected cuisine regardless of the limit", () => {
    const five = ["a", "b", "c", "d", "e"];
    const result = toggleCuisineSelection(five, "c");
    expect(result).toEqual({ next: ["a", "b", "d", "e"], blockedByLimit: false });
  });

  it("blocks a 6th selection instead of evicting the oldest one", () => {
    const five = ["a", "b", "c", "d", "e"];
    expect(five.length).toBe(CUISINE_SELECTION_LIMIT);
    const result = toggleCuisineSelection(five, "f");
    // The set is untouched — no silent swap of an unrelated tile.
    expect(result).toEqual({ next: five, blockedByLimit: true });
  });
});

describe("toggleDietSelection", () => {
  it("selecting «Без диеты» clears every other selection", () => {
    const result = toggleDietSelection(["vegan", "keto"], DIET_EXCLUSIVE_ID);
    expect(result).toEqual([DIET_EXCLUSIVE_ID]);
  });

  it("tapping «Без диеты» again clears it", () => {
    const result = toggleDietSelection([DIET_EXCLUSIVE_ID], DIET_EXCLUSIVE_ID);
    expect(result).toEqual([]);
  });

  it("picking a regular diet while «Без диеты» is active drops the exclusive pick", () => {
    const result = toggleDietSelection([DIET_EXCLUSIVE_ID], "vegan");
    expect(result).toEqual(["vegan"]);
  });

  it("regular diets multi-select freely between themselves", () => {
    const result = toggleDietSelection(["vegan"], "keto");
    expect(result).toEqual(["vegan", "keto"]);
  });

  it("toggling an already-selected regular diet removes only it", () => {
    const result = toggleDietSelection(["vegan", "keto"], "vegan");
    expect(result).toEqual(["keto"]);
  });
});

describe("toggleAllergySelection", () => {
  it("adds and removes with no limit", () => {
    expect(toggleAllergySelection([], "nuts")).toEqual(["nuts"]);
    expect(toggleAllergySelection(["nuts", "soy"], "nuts")).toEqual(["soy"]);
  });
});

describe("toggleBudgetSelection", () => {
  it("selects a tier from no selection", () => {
    expect(toggleBudgetSelection(null, "mid")).toBe("mid");
  });

  it("tapping the selected tier again clears the (optional) choice", () => {
    expect(toggleBudgetSelection("mid", "mid")).toBeNull();
  });

  it("tapping a different tier replaces the selection", () => {
    expect(toggleBudgetSelection("mid", "premium")).toBe("premium");
  });
});
