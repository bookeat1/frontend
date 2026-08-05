/**
 * Stub for `expo-updates` under Vitest/jsdom.
 *
 * The real module talks to a native runtime that does not exist in a plain
 * Node process, so importing it would throw at load time. Only `reload-app.ts`
 * touches it, and it needs exactly two symbols: `isEnabled` (false in any
 * non-build environment, which is what a test is) and `reloadAsync`. Modelling
 * a disabled updates runtime keeps `reloadApp()`'s tier-1 branch inert in tests,
 * matching how it behaves in the dev client.
 */

export const isEnabled = false;

export async function reloadAsync(): Promise<void> {
  throw new Error("expo-updates.reloadAsync() is not available in tests");
}
