/**
 * Native (iOS/Android) implementation: Keychain / Android Keystore, the only
 * storage in this app that isn't plain JS-readable text (see auth.tsx).
 *
 * See the `.web.ts` sibling — Metro picks it on `expo export --platform web`
 * / `expo start --web` automatically, same pattern as
 * `packages/api/src/resolve-asset-source.ts`. Keep the exported names
 * identical so call sites never need to know which one they got.
 */
export { getItemAsync, setItemAsync, deleteItemAsync } from "expo-secure-store";
