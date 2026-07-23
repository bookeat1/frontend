/**
 * Ambient module declaration so static image imports type-check outside the
 * Expo app (which normally gets this from `expo/types` via its generated
 * `expo-env.d.ts`). Metro's bundler resolves these at build time regardless;
 * this only satisfies `tsc --noEmit`.
 */
declare module "*.jpg" {
  const value: number;
  export default value;
}
