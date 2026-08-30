/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Общие пакеты монорепозитория лежат сырым TypeScript без шага сборки —
  // Next обязан транспилировать их сам. Тот же список, что у apps/admin.
  transpilePackages: ["@bookeat/api", "@bookeat/design-tokens", "@bookeat/i18n"],
  images: {
    // Свой загрузчик вместо встроенного оптимизатора: домены фотографий
    // приходят из БД и заранее не известны, а `remotePatterns` требует их
    // перечислить. Подробности и последствия — в src/lib/image-loader.ts.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
};

export default nextConfig;
