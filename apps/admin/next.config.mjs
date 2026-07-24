/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The shared workspace packages ship raw TypeScript source (no build step),
  // so Next must transpile them itself.
  transpilePackages: ["@bookeat/api", "@bookeat/design-tokens", "@bookeat/i18n"],
};

export default nextConfig;
