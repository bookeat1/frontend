/**
 * Native (iOS/Android) implementation: re-exports `expo-notifications`
 * unchanged.
 *
 * See the `.web.ts` sibling — Metro picks it on `expo export --platform
 * web` / `expo start --web`. Only `push.tsx` imports from this file (not
 * `expo-notifications` directly).
 */
export * from "expo-notifications";
