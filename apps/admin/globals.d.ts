// Allow side-effect imports of global stylesheets under standalone `tsc`
// (Next handles the actual bundling; this only satisfies the type checker).
declare module "*.css";

// `@bookeat/api`'s mock fixtures import photos directly. Locally these resolve
// through `next-env.d.ts`, which Next generates on its first run and which is
// git-ignored — so a clean checkout (CI) type-checks without it and fails.
// Declaring it here keeps the checker honest on any machine.
// The value is typed as `number` to match `packages/api/src/assets.d.ts`:
// Metro hands back an asset id, and the fixtures pass it straight to a
// React Native `ImageSourcePropType`.
declare module "*.jpg" {
  const value: number;
  export default value;
}
