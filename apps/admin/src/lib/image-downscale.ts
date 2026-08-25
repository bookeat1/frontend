/**
 * Уменьшение и перекодирование картинки ПЕРЕД отправкой на сервер.
 *
 * ЗАЧЕМ. Кабинет кладёт в R2 ровно тот файл, который выбрали на диске, а
 * приложение потом скачивает его целиком. Замер 2026-08-25 по десяти картинкам
 * справочника кухонь: PNG 384×384, от 197 до 431 КБ, вместе 3,23 МБ — и всё это
 * ради круга 72 pt (216 пикселей на телефоне). Те же файлы в WebP при 256 px —
 * 261 КБ на все десять, в 13 раз меньше.
 *
 * ПОЧЕМУ ИМЕННО ЗДЕСЬ, А НЕ НА ОТДАЧЕ. Уменьшать «на лету» по адресу негде:
 * картинки отдаёт публичный домен R2 `*.r2.dev`, а он не умеет
 * преобразований — `/cdn-cgi/image/width=216,format=webp/...` отвечает 404
 * (проверено 2026-08-25). Cloudflare Image Resizing живёт только на СВОЕЙ зоне
 * с включённой функцией; `cdn.book-eat.com` пока не резолвится. Значит
 * маленький файл может появиться либо при загрузке, либо разовой переработкой
 * уже загруженного — первое дешевле и делается целиком здесь: бэкенд уже
 * принимает `image/webp` (`extByType` в internal/transport/rest/media).
 *
 * ГЛАВНОЕ ПРАВИЛО ФАЙЛА: это УЛУЧШЕНИЕ, а не условие работы. Любой сбой —
 * старый браузер без `createImageBitmap`, картинка, которую не декодировать,
 * кодек WebP, которого нет, результат тяжелее исходника — возвращает ИСХОДНЫЙ
 * файл. Загрузка не должна падать из-за того, что мы пытались сэкономить
 * килобайты.
 */

/**
 * Потолок стороны для обычной загрузки: обложки акций, событий, историй,
 * заведений. 1600 — это ширина экрана телефона (430 pt) на плотности 3 с
 * запасом; в кабинете такие картинки смотрят и на мониторе.
 */
export const UPLOAD_MAX_EDGE = 1600;

/**
 * Потолок стороны для картинки, которую показывают КРУЖКОМ 72 pt (справочник
 * кухонь). 72 × 3 = 216 пикселей на обычном телефоне, 72 × 3,5 = 252 на самых
 * плотных экранах — 256 покрывает и их. Больше смысла нет: разницы не видно, а
 * вес растёт быстро (замер: 216 → 19 КБ, 256 → 26 КБ, 288 → 33 КБ, 320 → 43 КБ
 * в среднем на картинку).
 */
export const CIRCLE_MAX_EDGE = 256;

/** Качество WebP. 0.85 — то, на чём считались замеры выше; ниже начинают
 * лезть артефакты на еде, выше вес растёт без видимой разницы. */
export const WEBP_QUALITY = 0.85;

export interface DownscaleOptions {
  /** Наибольшая сторона результата в пикселях. */
  maxEdge: number;
  quality?: number;
}

export interface TargetSize {
  width: number;
  height: number;
}

/**
 * Размер, до которого нужно ужать картинку, или `null`, если она уже помещается.
 *
 * Пропорции сохраняются, сторона не может стать нулевой (одна пиксельная
 * полоска после округления — всё ещё картинка, а 0 — это ошибка канваса).
 * Мусорные размеры (0, NaN, отрицательные) означают «не трогать»: мы не знаем,
 * что это, и портить исходник догадкой нельзя.
 */
export function targetSize(width: number, height: number, maxEdge: number): TargetSize | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  if (!Number.isFinite(maxEdge) || maxEdge <= 0) return null;

  const longest = Math.max(width, height);
  if (longest <= maxEdge) return null;

  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Нужно ли вообще трогать файл.
 *
 * Уже WebP и уже помещается — оставляем как есть: перекодирование WebP в WebP
 * второй раз только теряет качество. Во всех остальных случаях есть что
 * выиграть: PNG-фотография тяжелее своего WebP в 6–7 раз даже БЕЗ уменьшения
 * (замер: 384 КБ → 58 КБ при том же размере 384×384).
 */
export function needsProcessing(type: string, size: TargetSize | null): boolean {
  return size !== null || type !== "image/webp";
}

/** Имя файла с расширением .webp — чтобы то, что лежит в бакете, называлось
 * тем, чем является. Ключ объекта сервер всё равно генерирует сам, но имя
 * попадает в multipart и в логи. */
export function webpFileName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "");
  return `${base || "image"}.webp`;
}

/**
 * Уменьшает и перекодирует картинку в WebP. При ЛЮБОМ сомнении возвращает
 * исходный файл — см. правило в шапке.
 */
export async function downscaleImage(file: File, options: DownscaleOptions): Promise<File> {
  try {
    if (typeof createImageBitmap !== "function") return file;
    if (typeof document === "undefined") return file;

    const bitmap = await createImageBitmap(file);
    try {
      const size = targetSize(bitmap.width, bitmap.height, options.maxEdge);
      if (!needsProcessing(file.type, size)) return file;

      const width = size?.width ?? bitmap.width;
      const height = size?.height ?? bitmap.height;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      // Плавное уменьшение: без этого браузер берёт ближайший пиксель, и
      // фотография еды после ужатия выглядит «лесенкой».
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), "image/webp", options.quality ?? WEBP_QUALITY);
      });
      // Браузер без кодека WebP отдаёт либо null, либо PNG под чужим типом —
      // и то и другое означает «не сработало».
      if (!blob || blob.type !== "image/webp") return file;
      // Не делаем ХУЖЕ: маленький логотип в PNG после WebP бывает тяжелее.
      if (blob.size >= file.size) return file;

      return new File([blob], webpFileName(file.name), {
        type: "image/webp",
        lastModified: Date.now(),
      });
    } finally {
      bitmap.close?.();
    }
  } catch {
    return file;
  }
}
