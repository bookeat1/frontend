/**
 * Native (iOS/Android) implementation: re-exports `expo-updates` unchanged.
 *
 * See the `.web.ts` sibling — Metro picks it on `expo export --platform web`
 * / `expo start --web`. Only `reload-app.ts` and `useAppUpdate.ts` import
 * from this file (not `expo-updates` directly), so the sibling only has to
 * cover `isEnabled`, `reloadAsync` and `useUpdates`, the three names they use.
 */
export * from "expo-updates";
