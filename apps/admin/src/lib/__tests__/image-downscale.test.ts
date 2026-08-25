import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CIRCLE_MAX_EDGE,
  downscaleImage,
  needsProcessing,
  targetSize,
  UPLOAD_MAX_EDGE,
  webpFileName,
} from "../image-downscale";

/**
 * Уменьшение картинки перед загрузкой.
 *
 * Пиксели тут проверить нечем (в jsdom нет ни настоящего канваса, ни кодека
 * WebP), да и не нужно: ломается не качество, а РЕШЕНИЯ вокруг него —
 * какой размер считать целевым, когда файл трогать не надо, и главное, что
 * любой сбой обязан вернуть исходный файл, а не уронить загрузку. Их и
 * проверяем.
 *
 * Числа-основания (замер 2026-08-25, десять картинок справочника кухонь):
 * PNG 384×384 весят 3,23 МБ на все десять; те же в WebP при 256 px — 261 КБ.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("целевой размер", () => {
  it("картинку меньше потолка не трогает", () => {
    expect(targetSize(216, 216, 256)).toBeNull();
    expect(targetSize(256, 256, 256)).toBeNull();
  });

  it("ужимает по НАИБОЛЬШЕЙ стороне, сохраняя пропорции", () => {
    expect(targetSize(1000, 500, 250)).toEqual({ width: 250, height: 125 });
    expect(targetSize(500, 1000, 250)).toEqual({ width: 125, height: 250 });
  });

  it("сторона не становится нулевой на очень узкой картинке", () => {
    // 2000×3 при потолке 256 даёт высоту 0.38 — канвас нулевой высоты это
    // ошибка, а не картинка.
    expect(targetSize(2000, 3, 256)?.height).toBe(1);
  });

  it("мусорные размеры означают «не трогать»", () => {
    expect(targetSize(0, 100, 256)).toBeNull();
    expect(targetSize(Number.NaN, 100, 256)).toBeNull();
    expect(targetSize(-10, 100, 256)).toBeNull();
    expect(targetSize(100, 100, 0)).toBeNull();
  });

  it("потолок кружка меньше обычного: 72 pt на плотности 3,5 — это 252 px", () => {
    expect(CIRCLE_MAX_EDGE).toBeGreaterThanOrEqual(72 * 3.5);
    expect(CIRCLE_MAX_EDGE).toBeLessThan(UPLOAD_MAX_EDGE);
  });
});

describe("нужно ли перекодировать", () => {
  it("PNG перекодируется даже без уменьшения — он в разы тяжелее WebP", () => {
    // Замер: 384×384 PNG 384 КБ → тот же размер в WebP 58 КБ.
    expect(needsProcessing("image/png", null)).toBe(true);
    expect(needsProcessing("image/jpeg", null)).toBe(true);
  });

  it("WebP, который уже помещается, оставляем как есть", () => {
    // Второе перекодирование WebP только теряет качество, не вес.
    expect(needsProcessing("image/webp", null)).toBe(false);
  });

  it("WebP, который НЕ помещается, всё равно ужимаем", () => {
    expect(needsProcessing("image/webp", { width: 256, height: 256 })).toBe(true);
  });
});

describe("имя файла", () => {
  it("меняет расширение на .webp", () => {
    expect(webpFileName("european.png")).toBe("european.webp");
    expect(webpFileName("Снимок экрана.JPEG")).toBe("Снимок экрана.webp");
  });

  it("файл без расширения получает своё имя, а не пустое", () => {
    expect(webpFileName("photo")).toBe("photo.webp");
    expect(webpFileName("")).toBe("image.webp");
  });
});

describe("сбой уменьшения не ломает загрузку", () => {
  const file = new File([new Uint8Array([1, 2, 3])], "cover.png", { type: "image/png" });

  it("браузер без createImageBitmap отдаёт исходный файл", async () => {
    // В jsdom его и нет — это ровно старый браузер оператора.
    expect(await downscaleImage(file, { maxEdge: CIRCLE_MAX_EDGE })).toBe(file);
  });

  it("картинка, которую не удалось раскодировать, тоже отдаётся как была", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("decode failed");
      }),
    );

    expect(await downscaleImage(file, { maxEdge: CIRCLE_MAX_EDGE })).toBe(file);
  });

  it("браузер без кодека WebP отдаёт исходный файл, а не PNG под чужим типом", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 800, height: 800, close })));
    // toBlob старых браузеров молча отдаёт PNG, когда просят WebP.
    const toBlob = vi.fn(
      (cb: (b: Blob | null) => void) => cb(new Blob(["x"], { type: "image/png" })),
    );
    stubCanvas(toBlob);

    expect(await downscaleImage(file, { maxEdge: CIRCLE_MAX_EDGE })).toBe(file);
    expect(close).toHaveBeenCalled();
  });

  it("результат тяжелее исходника — оставляем исходник", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 100, height: 100 })));
    const heavy = new Blob([new Uint8Array(999)], { type: "image/webp" });
    stubCanvas(vi.fn((cb: (b: Blob | null) => void) => cb(heavy)));

    expect(await downscaleImage(file, { maxEdge: CIRCLE_MAX_EDGE })).toBe(file);
  });

  it("удачное уменьшение отдаёт WebP с новым именем", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 800, height: 800 })));
    const light = new Blob([new Uint8Array(1)], { type: "image/webp" });
    stubCanvas(vi.fn((cb: (b: Blob | null) => void) => cb(light)));

    const out = await downscaleImage(file, { maxEdge: CIRCLE_MAX_EDGE });
    expect(out).not.toBe(file);
    expect(out.type).toBe("image/webp");
    expect(out.name).toBe("cover.webp");
  });
});

/** Канвас jsdom не умеет ни рисовать, ни кодировать — подменяем ровно те два
 * метода, которыми пользуется модуль. */
function stubCanvas(toBlob: (cb: (b: Blob | null) => void) => void): void {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      drawImage: vi.fn(),
    }),
    toBlob,
  };
  // Только createElement("canvas") — подмена всего `document` ломает всё
  // остальное, что на него опирается.
  const real = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) =>
    tag === "canvas" ? (canvas as unknown as HTMLElement) : real(tag),
  );
}
