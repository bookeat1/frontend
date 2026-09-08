/**
 * Публичный адрес сайта и флаг индексации. Оба значения читаются ТОЛЬКО во
 * время сборки (`NEXT_PUBLIC_*` зашиваются в бандл), поэтому задаются в
 * workflow выката рядом с `NEXT_PUBLIC_API_URL`, а не на сервере.
 *
 * - `NEXT_PUBLIC_SITE_URL` — origin (и basePath, если он есть), под которым
 *   сайт виден снаружи: `https://book-eat.com` на бою,
 *   `https://test.backend.book-eat.com/web-preview` на стенде. Из него
 *   собираются абсолютные ссылки в sitemap.xml, `Sitemap:` в robots.txt и
 *   `metadataBase` для canonical/OG.
 * - `NEXT_PUBLIC_ROBOTS_INDEX=true` — разрешить индексацию. Всё, что не
 *   ровно `true` (в том числе отсутствие переменной), даёт `Disallow: /`:
 *   стенд и локальная сборка по умолчанию закрыты от роботов, и открыть бой
 *   можно только осознанно, одной строкой в deploy-web-prod.yml. Шаг
 *   проверки после выката убеждается, что на бою флаг действительно доехал.
 */

const DEFAULT_SITE_URL = "http://localhost:3100";

function normalizeSiteUrl(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_SITE_URL;
  try {
    // Бросит на мусоре вроде "book-eat.com" без схемы — лучше упасть на
    // сборке, чем отдать роботам sitemap с относительными адресами.
    return new URL(trimmed).toString().replace(/\/+$/, "");
  } catch {
    throw new Error(`NEXT_PUBLIC_SITE_URL must be an absolute URL, got "${trimmed}"`);
  }
}

/** Абсолютный адрес сайта без завершающего слэша. */
export const siteUrl: string = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

/** true — сборка объявлена индексируемой (только боевой домен). */
export const isIndexable: boolean = (process.env.NEXT_PUBLIC_ROBOTS_INDEX ?? "").trim() === "true";

/** `absoluteUrl("/venues")` → `https://book-eat.com/venues`. Путь обязан начинаться со слэша. */
export function absoluteUrl(path: string, base: string = siteUrl): string {
  if (!path.startsWith("/")) {
    throw new Error(`absoluteUrl expects a path starting with "/", got "${path}"`);
  }
  return path === "/" ? `${base}/` : `${base}${path}`;
}
