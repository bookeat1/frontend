import { DevSettings } from "react-native";

/**
 * Restarts the JavaScript bundle so every module-scope `const t =
 * getDictionary()` re-resolves against the newly-chosen locale, and so a
 * pending `I18nManager.forceRTL` flip actually takes effect (React Native
 * cannot re-mirror an already-mounted tree in place).
 *
 * There is no single portable "reload" in React Native, so this tries the
 * cleanest option available in each environment, in order:
 *
 *   1. `expo-updates` `reloadAsync()` — the production-grade restart. It is
 *      NOT currently a dependency of this app (see apps/mobile/package.json),
 *      so we reach it through an optional require rather than a static import:
 *      if the module is added later this starts working with no further wiring,
 *      and until then the require simply throws and we fall through.
 *   2. `DevSettings.reload()` — works in the dev client / Expo Go, which is
 *      where a developer will actually verify the language switch today.
 *   3. no-op with a console note — release builds without expo-updates cannot
 *      restart themselves from JS. The language still changes for every screen
 *      that reads `useLocale()`; the module-scope screens update on the next
 *      natural cold start. This is a known limitation, called out here rather
 *      than hidden.
 *
 * Returns `true` if a reload was actually triggered, `false` if it no-op'd, so
 * the caller can decide whether to also fall back to an in-place state switch.
 */
export function reloadApp(): boolean {
  // 1. expo-updates, if the project ever adds it.
  try {
    // Optional dependency probed at runtime; a static import would fail to
    // bundle because expo-updates is not installed.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const Updates = require("expo-updates") as {
      reloadAsync?: () => Promise<void>;
    };
    if (typeof Updates?.reloadAsync === "function") {
      void Updates.reloadAsync();
      return true;
    }
  } catch {
    // expo-updates is not installed — expected, fall through.
  }

  // 2. Dev client / Expo Go.
  if (typeof DevSettings?.reload === "function") {
    try {
      DevSettings.reload();
      return true;
    } catch {
      // DevSettings is a no-op on web / under the test renderer.
    }
  }

  // 3. Nothing clean available.
  if (typeof __DEV__ === "undefined" || __DEV__) {
    // eslint-disable-next-line no-console -- intentional developer-facing note.
    console.warn(
      "[reloadApp] no reload mechanism available (expo-updates not installed, " +
        "DevSettings unavailable). Screens using useLocale() updated in place; " +
        "module-scope screens will pick up the new language on next cold start.",
    );
  }
  return false;
}
