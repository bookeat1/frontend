import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Корень монорепозитория. Нужен `output: "standalone"`: без явного указания
// Next берёт за корень папку приложения и не докладывает в сборку файлы из
// `packages/*` и общий `node_modules` pnpm — сервер падает на первом импорте.
const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Префикс пути, под которым сайт раздаётся. Пусто — сайт живёт в корне домена
// (так работает `pnpm dev` и так будет на боевом домене). На тестовом стенде
// сюда приезжает `/web-preview`, потому что домен уже занят бэкендом и
// кабинетом.
//
// Читается ТОЛЬКО во время сборки: Next зашивает префикс в ссылки на чанки,
// поэтому переменную нельзя подставить при запуске контейнера.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Общие пакеты монорепозитория лежат сырым TypeScript без шага сборки —
  // Next обязан транспилировать их сам. Тот же список, что у apps/admin.
  transpilePackages: ["@bookeat/api", "@bookeat/design-tokens", "@bookeat/i18n"],
  // Самодостаточная сборка: `.next/standalone` содержит `server.js` и ровно те
  // модули, которые нужны в рантайме. Так на стенд уезжает ~50 МБ вместо
  // всего `node_modules`, и на самом сервере не нужен ни pnpm, ни установка
  // зависимостей.
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  images: {
    // Свой загрузчик вместо встроенного оптимизатора: домены фотографий
    // приходят из БД и заранее не известны, а `remotePatterns` требует их
    // перечислить. Подробности и последствия — в src/lib/image-loader.ts.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
};

export default nextConfig;
