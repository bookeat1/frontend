import { describe, expect, it } from "vitest";

import { formatTags, parseTags } from "../tags";

describe("parseTags", () => {
  it("splits on commas and trims each tag", () => {
    expect(parseTags("живая музыка, 18+ , бранч")).toEqual(["живая музыка", "18+", "бранч"]);
  });

  it("drops empty entries from stray or trailing commas", () => {
    expect(parseTags("джаз,,, ,вечеринка,")).toEqual(["джаз", "вечеринка"]);
  });

  it("dedupes case-insensitively, keeping the first spelling", () => {
    expect(parseTags("Джаз, джаз, ДЖАЗ")).toEqual(["Джаз"]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseTags("")).toEqual([]);
    expect(parseTags("   , ,  ")).toEqual([]);
  });
});

describe("formatTags", () => {
  it("joins tags with a comma and space", () => {
    expect(formatTags(["живая музыка", "18+"])).toBe("живая музыка, 18+");
  });

  it("returns an empty string for undefined or empty", () => {
    expect(formatTags(undefined)).toBe("");
    expect(formatTags([])).toBe("");
  });
});
