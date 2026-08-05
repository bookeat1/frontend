import * as Updates from "expo-updates";
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
 *   1. `expo-updates` `reloadAsync()` — the production-grade restart. It only
 *      works when updates are actually enabled (release builds configured with
 *      EAS Update), which is exactly what `Updates.isEnabled` reports. In the
 *      dev client / Expo Go `isEnabled` is `false` and `reloadAsync()` would
 *      reject, so we skip it and fall through to option 2.
 *   2. `DevSettings.reload()` — works in the dev client / Expo Go, which is
 *      where a developer will actually verify the language switch today.
 *   3. no-op with a console note — a build where updates are disabled cannot
 *      restart itself from JS. The language still changes for every screen
 *      that reads `useLocale()`; the module-scope screens update on the next
 *      natural cold start. This is a known limitation, called out here rather
 *      than hidden.
 *
 * Returns `true` if a reload was actually triggered, `false` if it no-op'd, so
 * the caller can decide whether to also fall back to an in-place state switch.
 */
export function reloadApp(): boolean {
  // 1. expo-updates. Only usable when updates are enabled (release builds with
  //    EAS Update); `isEnabled` is false in dev / Expo Go, where reloadAsync()
  //    would reject — so we gate on it and fall through instead.
  try {
    if (Updates.isEnabled) {
      void Updates.reloadAsync();
      return true;
    }
  } catch {
    // Defensive: reading isEnabled / calling reloadAsync should not throw, but
    // a reload helper must never crash the caller — fall through.
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
      "[reloadApp] no reload mechanism available (expo-updates disabled, " +
        "DevSettings unavailable). Screens using useLocale() updated in place; " +
        "module-scope screens will pick up the new language on next cold start.",
    );
  }
  return false;
}
