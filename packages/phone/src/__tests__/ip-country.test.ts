import { beforeEach, describe, expect, it, vi } from "vitest";
import { COUNTRIES, countriesByName } from "../countries";
import { guessCountryByIp, resetIpCountryGuess } from "../ip-country";

function respond(body: unknown, ok = true) {
  return vi.fn(async () => ({ ok, json: async () => body }) as Response);
}

describe("guessCountryByIp", () => {
  beforeEach(() => resetIpCountryGuess());

  it("maps the service's ISO code to a country from the table", async () => {
    vi.stubGlobal("fetch", respond({ ip: "203.0.113.1", country: "DE" }));
    expect((await guessCountryByIp())?.dial).toBe("49");
  });

  it("asks the network once and shares the answer", async () => {
    const fetchMock = respond({ country: "TR" });
    vi.stubGlobal("fetch", fetchMock);
    await guessCountryByIp();
    await guessCountryByIp();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is null, not an error, when the lookup fails or answers nonsense", async () => {
    // The default test `fetch` throws — exactly an offline guest.
    expect(await guessCountryByIp()).toBeNull();

    for (const body of [{ country: "ZZ" }, { country: 7 }, null, "KZ"]) {
      resetIpCountryGuess();
      vi.stubGlobal("fetch", respond(body));
      expect(await guessCountryByIp()).toBeNull();
    }

    resetIpCountryGuess();
    vi.stubGlobal("fetch", respond({ country: "KZ" }, false));
    expect(await guessCountryByIp()).toBeNull();
  });
});

describe("picker order", () => {
  it("is alphabetical by country name with nothing pinned on top", () => {
    const names = COUNTRIES.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "ru")));
    expect(COUNTRIES[0].iso2).not.toBe("KZ");
  });

  it("re-sorts by the localized name for another language", () => {
    const english = countriesByName("en");
    const names = english.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
    expect(english.find((c) => c.iso2 === "DE")?.name).toBe("Germany");
    expect(english).toHaveLength(COUNTRIES.length);
  });
});
