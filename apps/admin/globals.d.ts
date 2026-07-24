// Allow side-effect imports of global stylesheets under standalone `tsc`
// (Next handles the actual bundling; this only satisfies the type checker).
declare module "*.css";
