/**
 * The prefix the panel is served under: "" in dev, "/admin-preview" on the test
 * deploy. It used to be edited into this file by hand at deploy time and never
 * committed, so the app's own code had no reliable way to know it — and the
 * 401 bounce sent people to a bare "/login", which is not the panel at all.
 *
 * Now there is exactly one input, `NEXT_PUBLIC_BASE_PATH`, read here and by
 * src/lib/base-path.ts (and src/lib/push.ts for the service-worker scope).
 */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The panel is a pure client app served by Caddy as static files out of
  // `out/` — there is no Node process behind it. Declaring that here (instead
  // of passing it in at deploy time, which is how it used to work) means a
  // change that needs a server fails in CI rather than on the test box.
  output: "export",
  // Emits `login/index.html` rather than `login.html`, which is the layout the
  // test deploy is already serving (Caddy's file_server resolves a directory to
  // its index; it has no `try_files {path}.html` rule). Every URL the panel
  // hands the browser therefore ends in a slash — see src/lib/base-path.ts.
  trailingSlash: true,
  // Next rejects an empty string here, so only set it when there is a prefix.
  ...(basePath ? { basePath } : {}),
  // The shared workspace packages ship raw TypeScript source (no build step),
  // so Next must transpile them itself.
  transpilePackages: ["@bookeat/api", "@bookeat/design-tokens", "@bookeat/i18n"],
};

export default nextConfig;
