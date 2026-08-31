/**
 * Адрес файла, лежащего в `apps/web/public`, с учётом префикса раздачи.
 *
 * ЗАЧЕМ ОТДЕЛЬНАЯ ФУНКЦИЯ. У веба свой загрузчик картинок
 * (`images.loader: "custom"`, см. `lib/image-loader.ts`), и Next отдаёт то,
 * что вернул загрузчик, КАК ЕСТЬ — `basePath` он к этому адресу не
 * приписывает. На стенде, который живёт под `/web-preview`, ссылка
 * `/brand/hero.webp` ушла бы в бэкенд и вернула 404. Поэтому префикс
 * подставляется руками, и делать это надо в ОДНОМ месте: раньше эта логика
 * жила только внутри `cuisine-photos.ts`, и следующая картинка неизбежно
 * приехала бы без префикса.
 *
 * Переменная читается во время СБОРКИ и зашивается в бандл — подменить её
 * при старте контейнера нельзя (см. conventions/bookeat-web.md).
 */
const ASSET_PREFIX = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

export function assetUrl(path: string): string {
  return `${ASSET_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
}
