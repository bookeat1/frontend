/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Общие пакеты монорепозитория лежат сырым TypeScript без шага сборки —
  // Next обязан транспилировать их сам. Тот же список, что у apps/admin.
  transpilePackages: ["@bookeat/api", "@bookeat/design-tokens", "@bookeat/i18n"],
};

export default nextConfig;
