import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Охранные grep'ы спеки geolocation-permission.md (критерии 17, 19, 20). Это
 * не про поведение, а про то, что нельзя «случайно» вернуть: фоновую
 * геолокацию, статический импорт нового нативного модуля (роняет запуск на
 * бинарях без него, см. haptics.ts) и координаты на диске.
 */

const MOBILE_ROOT = join(__dirname, "..", "..", "..", "..");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__" || name === "ios" || name === "android") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(path);
  }
  return out;
}

const files = [
  ...sourceFiles(join(MOBILE_ROOT, "src")),
  ...sourceFiles(join(MOBILE_ROOT, "app")),
].map((path) => ({ path: relative(MOBILE_ROOT, path), text: readFileSync(path, "utf8") }));

/** Текст без комментариев: в комментариях эти имена перечислены как запрещённые. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("геопозиция: охранные проверки", () => {
  it("нет фоновой и непрерывной геолокации (кр. 17)", () => {
    const banned =
      /watchPositionAsync|startLocationUpdatesAsync|startGeofencingAsync|requestBackgroundPermissionsAsync|watchHeadingAsync/;
    const hits = files.filter((f) => banned.test(code(f.text))).map((f) => f.path);
    expect(hits).toEqual([]);
  });

  it("`expo-location` называется только в location-native*.ts, и нигде статически (кр. 20)", () => {
    const mentioning = files.filter((f) => /["']expo-location["']/.test(code(f.text))).map((f) => f.path);
    expect(mentioning).toEqual(["src/lib/geo/location-native.ts"]);
    // В нативном загрузчике пакет — только ленивый `import()` и тип.
    const native = files.find((f) => f.path === "src/lib/geo/location-native.ts");
    expect(native).toBeDefined();
    expect(code(native!.text)).not.toMatch(/^\s*import\s+[^;]*from\s+["']expo-location["']/m);
    expect(code(native!.text)).toMatch(/import\("expo-location"\)/);
  });

  it("на диск пишутся только два флага пре-промпта (кр. 19)", () => {
    const writers = files
      .filter((f) => f.path.startsWith("src/lib/geo/") || /LocationOptInCard|LocationSettingsRow|useLocationPrompt|useSearchNear/.test(f.path))
      .filter((f) => /setItemAsync|AsyncStorage|SecureStore|FileSystem|localStorage/.test(code(f.text)))
      .map((f) => f.path);
    expect(writers).toEqual(["src/lib/geo/geo-prompt.ts"]);

    const prompt = files.find((f) => f.path === "src/lib/geo/geo-prompt.ts")!;
    const keys = [...prompt.text.matchAll(/KEY = "([^"]+)"/g)].map((m) => m[1]);
    expect(keys).toEqual(["bookeat.geo.prompt.answered.v1", "bookeat.geo.prompt.autoShows.v1"]);
    expect(code(prompt.text)).not.toMatch(/\b(lat|lng|latitude|longitude|coords)\b/);
  });

  it("координаты не уходят в аналитику: trackEvent в геокоде без lat/lng (кр. 28)", () => {
    const geoFiles = files.filter((f) =>
      /LocationOptInCard|LocationSettingsRow|useLocationPrompt|useSearch\.ts|useSearchNear/.test(f.path),
    );
    for (const f of geoFiles) {
      for (const call of code(f.text).matchAll(/trackEvent\([^)]*\)/g)) {
        expect(call[0], f.path).not.toMatch(/\b(lat|lng|latitude|longitude|accuracy|coords)\b/);
      }
    }
  });
});
