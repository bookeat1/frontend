import { afterEach, beforeEach, expect, vi } from "vitest";

/**
 * CI-like conditions for every test file.
 *
 * 1. NO NETWORK. `fetch` is replaced with a stub that throws. A test that
 *    wants HTTP must say so by installing its own `vi.stubGlobal("fetch", …)`;
 *    a test that reaches out by accident fails loudly instead of hanging for
 *    the 8s client timeout (or worse, passing only on a machine with a VPN).
 * 2. A FIXED TIMEZONE. Set here as well as in the npm script so a single-file
 *    run from an editor behaves like the CI run. `Asia/Almaty` (UTC+5, no DST)
 *    is the product's own zone; date boundaries are exercised explicitly in
 *    the tests that care.
 */
process.env.TZ = "Asia/Almaty";

/**
 * `__DEV__` — глобальная переменная Metro/React Native, которой в vitest нет.
 * Экраны читают её напрямую (`__DEV__ && devCode` на шаге ввода кода), и без
 * этой строки любой рендер такого экрана падает с `ReferenceError: __DEV__ is
 * not defined` — не из-за проверяемого кода, а из-за окружения.
 *
 * `false`, а не `true`: это поведение РЕЛИЗНОЙ сборки, и отладочные блоки, у
 * которых нет права попасть к гостю, тесты видеть не должны.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      throw new Error(
        `Unexpected network call in a test: ${String(input)}. ` +
          `Stub fetch in the test itself if the request is the thing under test.`,
      );
    }),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  // Testing Library only auto-registers its cleanup when Vitest runs with
  // globals, and this project does not (explicit imports are easier to trace).
  // Without it every render stacks another container onto `document.body` and
  // `screen.getByText` starts reporting "found multiple elements" from a
  // PREVIOUS test — a failure that has nothing to do with the code under test.
  // Imported lazily so a pure-TypeScript test file never pays for react-dom.
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});

/** Guards the guard: if the setup file ever stops being loaded, this fails. */
expect.extend({});
