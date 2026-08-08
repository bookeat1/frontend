import { describe, expect, it } from "vitest";

import { moveItem } from "../reorder";

describe("moveItem", () => {
  const ids = ["a", "b", "c", "d"];

  it("moves an item down, swapping with its next neighbour", () => {
    expect(moveItem(ids, 1, 1)).toEqual(["a", "c", "b", "d"]);
  });

  it("moves an item up, swapping with its previous neighbour", () => {
    expect(moveItem(ids, 2, -1)).toEqual(["a", "c", "b", "d"]);
  });

  it("is a no-op moving the first item up", () => {
    expect(moveItem(ids, 0, -1)).toEqual(ids);
  });

  it("is a no-op moving the last item down", () => {
    expect(moveItem(ids, ids.length - 1, 1)).toEqual(ids);
  });

  it("returns a fresh array, never mutating the input", () => {
    const input = ["x", "y"];
    const out = moveItem(input, 0, 1);
    expect(out).not.toBe(input);
    expect(input).toEqual(["x", "y"]);
    expect(out).toEqual(["y", "x"]);
  });

  it("ignores an out-of-range index", () => {
    expect(moveItem(ids, 9, -1)).toEqual(ids);
    expect(moveItem(ids, -3, 1)).toEqual(ids);
  });
});
