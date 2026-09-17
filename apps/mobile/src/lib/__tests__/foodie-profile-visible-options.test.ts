import type { FoodieOption } from "@bookeat/api";
import { describe, expect, it } from "vitest";
import { withHiddenSelected } from "../foodie-profile-visible-options";

function option(code: string, name: string): FoodieOption {
  return { id: code, code, name, displayOrder: 0 };
}

describe("withHiddenSelected", () => {
  it("returns the active options unchanged when nothing selected is hidden", () => {
    const options = [option("kazakh", "Казахская"), option("asian", "Азиатская")];
    expect(withHiddenSelected(options, ["kazakh"])).toBe(options);
  });

  it("appends a synthetic tile for a selected code missing from the active options", () => {
    const options = [option("kazakh", "Казахская")];
    const result = withHiddenSelected(options, ["kazakh", "spicy"]);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ id: "spicy", code: "spicy", name: "spicy" });
  });

  it("appends one synthetic tile per orphan code, in the order they appear in selected", () => {
    const result = withHiddenSelected([] as FoodieOption[], ["a", "b"]);
    expect(result.map((o) => o.code)).toEqual(["a", "b"]);
  });

  it("does not resurrect an orphan code that is not currently selected", () => {
    const options = [option("kazakh", "Казахская")];
    // "spicy" was hidden AND the guest never had it selected — must not appear.
    expect(withHiddenSelected(options, [])).toEqual(options);
  });
});
