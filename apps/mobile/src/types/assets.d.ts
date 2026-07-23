/**
 * Ambient module declaration for static image imports (used by
 * `@bookeat/api`'s mock data fixtures). Metro resolves these at build time
 * regardless; this only satisfies `tsc --noEmit`.
 */
declare module "*.jpg" {
  const value: number;
  export default value;
}
