import { describe, expect, it } from "vitest";
import { en } from "../en";
import { kk } from "../kk";
import { ru } from "../ru";

/**
 * Guard for the two ways a translation rots without anyone noticing.
 *
 * 1. A MISSING key does not break anything: `getDictionary` falls back to the
 *    Russian base, so a Kazakh screen quietly grows a Russian line. That is
 *    exactly the bug this file exists to make loud — a key added to `ru.ts`
 *    fails the build until kk and en have it too.
 * 2. A key that IS translated but drops a substitution — `${count}`, `${name}`
 *    — is worse than a missing one: the sentence still renders, only without
 *    the number. TypeScript cannot catch it, because a function's signature is
 *    checked, not what its template literal actually interpolates.
 *
 * Locales other than kk and en are deliberately NOT checked: they are declared
 * partial (see the header of each file) and the fallback to ru is their
 * intended behaviour, pinned in fallback.test.ts.
 */

type Leaf =
  | { kind: "string"; value: string }
  | { kind: "function"; value: (...args: unknown[]) => unknown }
  | { kind: "array"; value: readonly unknown[] };

/** Flattens a dictionary to `path -> leaf`. Arrays and functions are leaves:
 * `deepMerge` replaces them wholesale, so they are translated wholesale too. */
function flatten(node: unknown, prefix = "", out = new Map<string, Leaf>()): Map<string, Leaf> {
  if (typeof node === "function") {
    out.set(prefix, { kind: "function", value: node as (...args: unknown[]) => unknown });
    return out;
  }
  if (Array.isArray(node)) {
    out.set(prefix, { kind: "array", value: node });
    return out;
  }
  if (typeof node === "object" && node !== null) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.set(prefix, { kind: "string", value: String(node) });
  return out;
}

const base = flatten(ru);
const locales = { kk: flatten(kk), en: flatten(en) } as const;

describe.each(Object.keys(locales) as (keyof typeof locales)[])(
  "%s is a complete translation of ru",
  (locale) => {
    const translated = locales[locale];

    it("has every key that ru has", () => {
      const missing = [...base.keys()].filter((path) => !translated.has(path));
      expect(missing, `${locale}.ts is missing ${missing.length} key(s) present in ru.ts`).toEqual(
        [],
      );
    });

    it("has no key that ru does not have", () => {
      // A stray key is dead weight at best and a typo'd override at worst:
      // `deepMerge` would happily add it, and no screen would ever read it.
      const extra = [...translated.keys()].filter((path) => !base.has(path));
      expect(extra, `${locale}.ts has ${extra.length} key(s) absent from ru.ts`).toEqual([]);
    });

    it("keeps the shape of every leaf (a function stays a function)", () => {
      const wrong = [...base.entries()]
        .filter(([path, leaf]) => translated.get(path)?.kind !== leaf.kind)
        .map(([path, leaf]) => `${path}: expected ${leaf.kind}, got ${translated.get(path)?.kind}`);
      expect(wrong).toEqual([]);
    });

    it("keeps the same number of items in every array-typed leaf", () => {
      const wrong = [...base.entries()]
        .filter(([, leaf]) => leaf.kind === "array")
        .filter(([path, leaf]) => {
          const other = translated.get(path);
          return (
            other?.kind !== "array" ||
            other.value.length !== (leaf as { value: readonly unknown[] }).value.length
          );
        })
        .map(([path]) => path);
      expect(wrong).toEqual([]);
    });
  },
);

/**
 * Sentinel arguments. A dictionary function is compiled JavaScript by the time
 * the test runs, so its parameter TYPES are gone — the only way to learn what
 * a position expects is to call it and see what does not throw.
 *
 * Every candidate is recognisable in the output, which is the whole trick: run
 * ru and the translation with the SAME arguments, and compare which sentinels
 * came back out. A placeholder the translator forgot simply will not be there.
 */
const SENTINELS = {
  string: "⸤PLACEHOLDER⸥",
  number: 970123,
  zero: 0,
  one: 1,
  true: true,
  false: false,
  array: ["⸤PART-A⸥", "⸤PART-B⸥"],
} as const;

const CANDIDATES = Object.values(SENTINELS);

/** Every argument tuple worth trying for a function of `arity` parameters. */
function argumentTuples(arity: number): unknown[][] {
  if (arity === 0) return [[]];
  const shorter = argumentTuples(arity - 1);
  return CANDIDATES.flatMap((candidate) => shorter.map((rest) => [candidate, ...rest]));
}

/** Which sentinels made it into the rendered string. `toUpperCase()` is used by
 * the guide's eyebrow lines, so matching ignores case. */
function sentinelsIn(text: string): string[] {
  const haystack = text.toUpperCase();
  const found: string[] = [];
  if (haystack.includes(SENTINELS.string.toUpperCase())) found.push("string");
  if (haystack.includes(String(SENTINELS.number))) found.push("number");
  for (const part of SENTINELS.array) {
    if (haystack.includes(part.toUpperCase())) found.push(part);
  }
  return found;
}

describe.each(Object.keys(locales) as (keyof typeof locales)[])(
  "%s substitutes the same values as ru",
  (locale) => {
    const translated = locales[locale];

    it("interpolates every argument ru interpolates, and no others", () => {
      const problems: string[] = [];

      for (const [path, leaf] of base) {
        if (leaf.kind !== "function") continue;
        const other = translated.get(path);
        if (other?.kind !== "function") continue; // reported by the shape test

        const baseFn = leaf.value as (...args: unknown[]) => unknown;
        const otherFn = other.value as (...args: unknown[]) => unknown;
        let calledAtLeastOnce = false;

        for (const args of argumentTuples(baseFn.length)) {
          let expected: string;
          try {
            const result = baseFn(...args);
            if (typeof result !== "string") continue;
            expected = result;
          } catch {
            continue; // ru rejects this argument shape; nothing to compare.
          }
          calledAtLeastOnce = true;

          let actual: string;
          try {
            const result = otherFn(...args);
            if (typeof result !== "string") {
              problems.push(`${path}(${args.join(", ")}) returned ${typeof result}, not a string`);
              continue;
            }
            actual = result;
          } catch (error) {
            problems.push(`${path}(${args.join(", ")}) threw: ${String(error)}`);
            continue;
          }

          const wanted = sentinelsIn(expected).sort();
          const got = sentinelsIn(actual).sort();
          if (wanted.join("|") !== got.join("|")) {
            problems.push(
              `${path}(${args.join(", ")}): ru substitutes [${wanted.join(", ")}], ` +
                `${locale} substitutes [${got.join(", ")}]`,
            );
          }
        }

        if (!calledAtLeastOnce) {
          problems.push(`${path}: no argument tuple was accepted by ru — extend SENTINELS`);
        }
      }

      // Only the first few are worth reading; the count carries the rest.
      expect(problems.slice(0, 12), `${problems.length} placeholder mismatch(es)`).toEqual([]);
    });
  },
);
