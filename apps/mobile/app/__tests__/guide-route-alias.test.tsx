import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { describe, expect, it, vi } from "vitest";

// Тот же набор моков, что в gastroguide-screen.test.tsx /
// gastroguide-rubric-screen.test.tsx: оба алиасных файла реэкспортируют эти
// экраны, и без моков реальный `react-native-safe-area-context` роняет
// импорт синтаксической ошибкой в jsdom-прогоне (Vite-алиас в
// vitest.config.ts почему-то не перехватывает путь, которым его тянет
// немокнутый `expo-router` — тот тоже приходится мокать).
vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: () => true }),
  usePathname: () => "/gastroguide",
  useLocalSearchParams: () => ({ slug: "kazakh-cuisine-rubric" }),
}));

vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));

vi.mock("../../src/lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({
    getGuideCategories: vi.fn(),
    getGuideCollections: vi.fn(),
    getGuideCollection: vi.fn(),
    getGuideRoutes: vi.fn(),
  }),
}));

import GastroguideScreen from "../gastroguide";
import GuideRubricScreen from "../gastroguide/rubric/[slug]";
import GuideAliasScreen from "../guide";
import GuideRubricAliasScreen from "../guide/rubric/[slug]";

/**
 * `/guide` и `/guide/rubric/:slug` — файлы-алиасы на ADR-046: тот же
 * компонент под вторым адресом, без редиректа (см. комментарий в
 * `app/guide/index.tsx`). Проверяем ссылочное равенство, а не факт рендера:
 * рендер-поведение уже покрыто тестами `gastroguide-screen.test.tsx` и
 * `gastroguide-rubric-screen.test.tsx`, а этот файл — сторож на случай, если
 * алиас однажды разъедется с оригиналом (например, кто-то скопирует экран
 * вместо реэкспорта).
 */
describe("route alias /guide → /gastroguide (ADR-046)", () => {
  it("app/guide/index.tsx рендерит ТОТ ЖЕ компонент, что app/gastroguide/index.tsx", () => {
    expect(GuideAliasScreen).toBe(GastroguideScreen);
  });

  it("app/guide/rubric/[slug].tsx рендерит ТОТ ЖЕ компонент, что app/gastroguide/rubric/[slug].tsx", () => {
    expect(GuideRubricAliasScreen).toBe(GuideRubricScreen);
  });
});
