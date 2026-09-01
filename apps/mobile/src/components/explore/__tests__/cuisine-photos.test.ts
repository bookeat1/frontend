import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * У КАЖДОЙ КУХНИ СПРАВОЧНИКА ЕСТЬ КАРТИНКА В СБОРКЕ.
 *
 * Правка владельца 2026-09-01: «у части кухонь вместо фото рисуется буква,
 * это как минимум Индийская и Грузинская». Причина не в отрисовке: справочник
 * `GET /cuisines` не отдаёт `image_url` НИ У ОДНОЙ из пятнадцати записей
 * (проверено на тесте 2026-09-01), а вшитые снимки были только у десяти. Пять
 * оставшихся — `indian`, `georgian`, `japanese`, `pan_asian`, `authors` — не
 * имели картинки нигде, и `CuisineSection` либо показывала заглушку, либо
 * прятала кухню целиком.
 *
 * ПОЧЕМУ ТЕСТ ЧИТАЕТ ИСХОДНИК, А НЕ ИМПОРТИРУЕТ МОДУЛЬ. `cuisine-photos.ts`
 * подключает файлы через `require("…png")` — это API Metro, и в vitest его
 * нет: любой импорт этого модуля падает ещё на разборе (поэтому тест
 * `CuisineChip` его подменяет). Разбор исходника проверяет ровно то, что
 * ломается: есть ли ключ и лежит ли на диске файл, на который он показывает.
 *
 * ЧЕГО ЭТОТ ТЕСТ НЕ ДОКАЗЫВАЕТ: что снимок подходит кухне по смыслу и что он
 * не мутный. Это смотрят глазами.
 */

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, "../cuisine-photos.ts"), "utf8");
const assetsDir = resolve(here, "../../../../assets/cuisines");

/**
 * Коды живого справочника, `GET https://test.backend.book-eat.com/api/v1/cuisines`,
 * снято 2026-09-01 (пятнадцать записей, `is_active: true`).
 *
 * Список записан сюда, а не запрашивается: тест, ходящий в сеть, падает от
 * чужого простоя. Обновлять его руками, когда редакция заводит кухню, — и
 * есть смысл этого теста: новая кухня без картинки должна ронять сборку, а не
 * появляться на главной серым кругом.
 */
const LIVE_CUISINE_CODES = [
  "european",
  "mediterranean",
  "seafood",
  "kazakh",
  "pan_asian",
  "italian",
  "french",
  "georgian",
  "turkish",
  "greek",
  "oriental",
  "vegan",
  "authors",
  "japanese",
  "indian",
];

/** Ключ → путь файла, как он записан в модуле. */
function bundledPhotos(): Map<string, string> {
  const out = new Map<string, string>();
  const entry = /^\s*([A-Za-zА-Яа-я_][\wЀ-ӿ]*)\s*:\s*require\("([^"]+)"\)/gmu;
  for (const match of source.matchAll(entry)) out.set(match[1], match[2]);
  return out;
}

describe("вшитые снимки кухонь", () => {
  it("покрывают ВСЕ пятнадцать кухонь живого справочника", () => {
    const photos = bundledPhotos();
    const missing = LIVE_CUISINE_CODES.filter((code) => !photos.has(code));

    expect(missing).toEqual([]);
  });

  it("каждая ссылка показывает на файл, который действительно лежит в сборке", () => {
    const broken: string[] = [];
    for (const [key, path] of bundledPhotos()) {
      const file = path.replace(/^.*assets\/cuisines\//, "");
      if (!existsSync(resolve(assetsDir, file))) broken.push(`${key} → ${path}`);
    }

    expect(broken).toEqual([]);
  });

  it("пять добавленных снимков — квадраты 288×288, как у соседних", () => {
    // 3x от круга 96 (exploreLayout.cuisineChip). Меньше — круг мылит на
    // трёхкратном экране; больше — лишние байты в бинарнике.
    for (const name of ["indian", "georgian", "japanese", "pan-asian", "authors"]) {
      const png = readFileSync(resolve(assetsDir, `${name}.png`));
      // Размеры лежат в IHDR: сигнатура 8 байт, длина 4, тип 4, дальше два
      // 32-битных числа.
      expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([288, 288]);
    }
  });
});
