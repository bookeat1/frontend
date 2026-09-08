/**
 * Native (iOS/Android) implementation: re-exports `expo-glass-effect`
 * unchanged.
 *
 * See the `.web.tsx` sibling — Metro picks it on `expo export --platform
 * web` / `expo start --web`. Only `BottomNavBar.tsx` imports from this file.
 */
export { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
