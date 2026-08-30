import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const here = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
const require = createRequire(import.meta.url);
/** The workspace root's copy of a package, as a directory. */
const rootCopyOf = (name: string) => dirname(require.resolve(`${name}/package.json`));

/**
 * One test runner for the whole monorepo.
 *
 * WHY VITEST AND NOT jest-expo: this repo has three consumers of the same
 * TypeScript — an Expo app, a Next.js admin panel and four shared packages —
 * and jest-expo only covers the first of them, so it would have meant two
 * runners and two transform pipelines. Vitest transforms TS/TSX with esbuild
 * (no babel config, no ts-jest), and React Native components are rendered the
 * way this app already renders them on the web: `react-native` is aliased to
 * `react-native-web`, which is not a testing shim but a production dependency
 * of `apps/mobile` (`expo start --web` uses it). The cost is that RN-only
 * modules must be stubbed explicitly — that is the price of a single runner,
 * and it is visible in `test/stubs/` rather than hidden inside a preset.
 *
 * Deterministic by construction: no watch (`vitest run`), a fixed timezone,
 * and any test that reaches the network fails instead of hanging — see
 * `vitest.setup.ts`.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // pnpm gives each dependency its own resolution root, so `@tanstack/
    // react-query` resolves React through its own `.pnpm` directory while the
    // app resolves it through the workspace root — two live copies of React,
    // which surfaces as "Invalid hook call", not as a missing package.
    // `dedupe` alone does not fix it here; the aliases below do.
    dedupe: ["react", "react-dom", "react-native-web"],
    // `.web.js` ПЕРЕД `.js`: платформенные расширения умеет Metro, но не Vite,
    // а web-сборка react-native-svg собрана именно так (`elements.web.js`).
    // Остальной список — дефолт Vite, он обязан остаться прежним.
    extensions: [".web.js", ".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"],
    alias: [
      { find: /^react$/, replacement: rootCopyOf("react") },
      { find: /^react-dom$/, replacement: rootCopyOf("react-dom") },
      { find: /^react\//, replacement: `${rootCopyOf("react")}/` },
      { find: /^react-dom\//, replacement: `${rootCopyOf("react-dom")}/` },
      // Expo native modules have no implementation loadable in a plain jsdom
      // process. Each stub is a deliberate, readable file.
      { find: /^expo-secure-store$/, replacement: here("./test/stubs/expo-secure-store.ts") },
      { find: /^expo-updates$/, replacement: here("./test/stubs/expo-updates.ts") },
      { find: /^expo-image$/, replacement: here("./test/stubs/expo-image.tsx") },
      { find: /^phosphor-react-native$/, replacement: here("./test/stubs/phosphor-react-native.tsx") },
      // The Amplitude RN SDK's default entry is untranspiled TS that links a
      // native module — unloadable in jsdom. analytics.ts is a guarded no-op
      // without a successful init, so a no-op stub matches test behaviour.
      { find: /^@amplitude\/analytics-react-native$/, replacement: here("./test/stubs/amplitude-analytics-react-native.ts") },
      // Exact match only: `react-native-web`, `react-native-svg` and
      // `react-native-safe-area-context` must NOT be rewritten.
      { find: /^react-native$/, replacement: here("./test/stubs/react-native.ts") },
      // react-native-svg отдаёт Node НЕтранспилированный TypeScript (на нём
      // и падал импорт до появления заглушки Phosphor). Web-сборка того же
      // пакета — обычный JS и настоящий <svg>, поэтому иконки в тестах
      // рисуются по-настоящему, а не подменяются заглушкой.
      // `react-native-safe-area-context` объявляет поле `react-native`:
      // `src/index.tsx`, и Vite берёт именно исходный TSX — Node роняет его на
      // `SyntaxError: Unexpected token 'typeof'`, и с ним не импортируется ни
      // одна нижняя шторка. Тот же приём, что и с react-native-svg: указываем
      // на собранный ESM того же пакета.
      {
        find: /^react-native-safe-area-context$/,
        replacement: `${rootCopyOf("react-native-safe-area-context")}/lib/module/index.js`,
      },
      {
        find: /^react-native-svg$/,
        replacement: `${rootCopyOf("react-native-svg")}/lib/module/ReactNativeSVG.web.js`,
      },
      // The admin panel's own path alias, the same one Next.js resolves from
      // apps/admin/tsconfig.json ("@/*" -> "./src/*"). Without it every admin
      // component is unimportable from a test.
      { find: /^@\//, replacement: `${here("./apps/admin/src")}/` },
      // Псевдоним ДЕСКТОПНОГО веба. Он намеренно другой (`@web/`, не `@/`):
      // два приложения в одном прогоне тестов не могут делить один префикс —
      // `@/components/ui/Button` разрешался бы в кабинет независимо от того,
      // кто его импортировал, и тест веба молча проверял бы чужую кнопку.
      { find: /^@web\//, replacement: `${here("./apps/web/src")}/` },
    ],
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: [here("./vitest.setup.ts")],
    include: [
      "apps/**/src/**/*.test.{ts,tsx}",
      "apps/**/app/**/*.test.{ts,tsx}",
      "packages/**/src/**/*.test.{ts,tsx}",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    server: {
      deps: {
        // Externalised packages are loaded by Node, which resolves THEIR
        // `react` through their own pnpm directory — a second live copy, and
        // "Invalid hook call" at render time. Inlining these routes them
        // through the aliases above so there is exactly one React.
        inline: [/@tanstack\/react-query/, /react-native-web/],
      },
    },
    restoreMocks: true,
    clearMocks: true,
  },
});
