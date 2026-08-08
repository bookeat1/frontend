/**
 * Stub for `@amplitude/analytics-react-native` under Vitest/jsdom.
 *
 * The real package's default entry (`react-native`/`source` fields) is
 * untranspiled TypeScript that links a native module, so importing it in a
 * plain Node process throws at load time (`src/react-native-client.ts`:
 * "Unexpected token 'typeof'"). The app touches it only through
 * `src/lib/analytics.ts`, whose functions are guarded no-ops when init has not
 * succeeded — so a stub whose `init` does nothing keeps every downstream
 * `track`/`identify`/`reset` call a safe no-op in tests, exactly as it is on a
 * build with no analytics key.
 */

export function init(): void {}

export function track(): void {}

export function setUserId(): void {}

export function identify(): void {}

export function reset(): void {}

/** Matches the SDK's chainable Identify builder closely enough for the no-op
 * path: `new Identify().set(...)` must not throw. */
export class Identify {
  set(): this {
    return this;
  }
}
