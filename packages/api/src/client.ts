/**
 * Точка входа для НЕ-React-Native потребителей: десктопный сайт и всё, что
 * собирается webpack'ом или vite.
 *
 * Отличие от `./index.ts` ровно одно и оно важное: здесь НЕТ мок-репозитория.
 * `mock-data.ts` подтягивает `react-native` (ради `Image.resolveAssetSource`
 * для вшитых фотографий), а `node_modules/react-native/index.js` написан на
 * Flow — сборщик веба спотыкается о `import typeof` на первой же строке. Так
 * что дело не только в лишнем весе: обычный `import { ... } from
 * "@bookeat/api"` в Next.js просто не собирается.
 *
 * Кабинет (`apps/admin`) обходит ту же мину через `@bookeat/api/admin`; это —
 * та же дверь для гостевых чтений.
 */
export * from "./types";
export * from "./time-of-day";
export * from "./static-map";
export * from "./repository";
export * from "./http-repository";
export type { TokenProvider, UnauthorizedHandler, LanguageProvider, ApiPage } from "./http-client";
