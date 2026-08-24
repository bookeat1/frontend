/**
 * Ссылки заведения на соцсети: разбор и приведение к виду, который приложение
 * реально умеет открыть.
 *
 * ЧТО ПОНИМАЕТ СИСТЕМА. В базе `restaurant_social_links.type` — свободная
 * строка (migrations/0002_restaurants.sql), бэкенд её НЕ валидирует
 * (restaurants/request.go: socialInput проходит насквозь). Но потребителей у
 * этого поля ровно два, и оба знают конечный список:
 *   - приложение: `packages/api/src/http-mapping.ts` ищет `s.type === "website"
 *     | "whatsapp" | "instagram"` (строгое сравнение, регистр важен) и рисует
 *     ровно три круглые кнопки (mobile VenueSocialLinks);
 *   - гид: SQL берёт `lower(type) = 'instagram'` для подписи «адрес · @инст».
 * Всё остальное сохранится в базе и не появится нигде — поэтому в панели
 * выбор из этих трёх, а не свободный ввод.
 *
 * ЧТО ДЕЛАЕМ С «@yurta.almaty». Человек почти всегда вставляет ник, а не
 * ссылку. Ругаться на это — заставлять его делать работу, которую программа
 * умеет сделать сама; молча сохранить ник — получить в приложении кнопку,
 * которая ведёт в никуда у любого второго потребителя. Поэтому третий путь:
 * приводим к канонической ссылке (`https://instagram.com/yurta.almaty`) и
 * ПОКАЗЫВАЕМ результат в том же поле, чтобы сохранилось ровно то, что человек
 * видит. Если привести не к чему («почта@example.com», «зайдите в инсту») —
 * внятная ошибка, а не догадка.
 *
 * Логика живёт здесь, а не в компоненте: её проверяют без DOM, и её делят
 * между формой суперадмина и карточкой в «Настройках».
 */

/** Виды ссылок, которые приложение умеет показать. Порядок = порядок кнопок
 * в карточке заведения. Это ЗНАЧЕНИЯ ПРОТОКОЛА (уходят в `type`), не текст. */
export const SOCIAL_LINK_TYPES = ["instagram", "whatsapp", "website"] as const;

export type KnownSocialLinkType = (typeof SOCIAL_LINK_TYPES)[number];

export function isKnownSocialLinkType(type: string): type is KnownSocialLinkType {
  return (SOCIAL_LINK_TYPES as readonly string[]).includes(type);
}

/** Строка тела запроса: `{type, url}` (restaurants/request.go: socialInput). */
export interface SocialLinkInput {
  type: string;
  url: string;
}

/** Ссылка, как её отдаёт сервер (restaurants/response.go: socialResponse). */
export interface SocialLink extends SocialLinkInput {
  id: string;
}

export type SocialLinkError =
  /** Введено не похожее на ссылку и не приводимое к ней. */
  | "not_a_link"
  /** Instagram: ни ник, ни ссылка на instagram.com. */
  | "bad_instagram"
  /** WhatsApp: ни номер, ни ссылка. */
  | "bad_whatsapp"
  /** Такой вид уже добавлен: приложение всё равно покажет только первую. */
  | "duplicate_type";

export type SocialLinkNormalizeResult =
  | { ok: true; url: string }
  | { ok: false; error: SocialLinkError };

const HAS_SCHEME = /^https?:\/\//i;
/** «host.tld» или «host.tld/что-то»: точка есть, пробелов нет. */
const BARE_HOST = /^[^\s/@:]+\.[^\s]+$/;
/** Ник Instagram: буквы/цифры/точка/подчёркивание, до 30 символов. */
const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

/** Разбирает абсолютный URL, `null` — если строка им не является. */
function parseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url;
  } catch {
    return null;
  }
}

/** Ссылка «как есть», но обязательно со схемой: без неё приложение считает
 * значение относительным путём. */
function asWebLink(value: string): SocialLinkNormalizeResult {
  if (HAS_SCHEME.test(value)) {
    return parseUrl(value) ? { ok: true, url: value } : { ok: false, error: "not_a_link" };
  }
  if (BARE_HOST.test(value) && parseUrl(`https://${value}`)) {
    return { ok: true, url: `https://${value}` };
  }
  return { ok: false, error: "not_a_link" };
}

function normalizeInstagram(value: string): SocialLinkNormalizeResult {
  if (HAS_SCHEME.test(value)) {
    const url = parseUrl(value);
    if (!url) return { ok: false, error: "bad_instagram" };
    if (!/(^|\.)instagram\.com$/i.test(url.hostname)) {
      return { ok: false, error: "bad_instagram" };
    }
    // Из ссылки берём только ник: у скопированной из приложения ссылки хвост
    // из ?igsh=… — это метка того, кто копировал, а не адрес профиля.
    const handle = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return INSTAGRAM_HANDLE.test(handle)
      ? { ok: true, url: `https://instagram.com/${handle}` }
      : { ok: false, error: "bad_instagram" };
  }
  const handle = value
    .replace(/^@/, "")
    .replace(/^(?:www\.)?instagram\.com\//i, "")
    .split(/[/?#]/)[0]
    .trim();
  return INSTAGRAM_HANDLE.test(handle)
    ? { ok: true, url: `https://instagram.com/${handle}` }
    : { ok: false, error: "bad_instagram" };
}

function normalizeWhatsApp(value: string): SocialLinkNormalizeResult {
  if (HAS_SCHEME.test(value)) {
    return parseUrl(value) ? { ok: true, url: value } : { ok: false, error: "bad_whatsapp" };
  }
  // Номер набирают как угодно: «+7 707 000 00 00», «8 (707) 000-00-00».
  // Значащие тут только цифры, а документированная форма — wa.me/<цифры>.
  if (/^\+?[\d\s()\-.]+$/.test(value)) {
    const digits = value.replace(/\D+/g, "");
    if (digits.length >= 8 && digits.length <= 15) {
      return { ok: true, url: `https://wa.me/${digits}` };
    }
    return { ok: false, error: "bad_whatsapp" };
  }
  if (BARE_HOST.test(value)) return asWebLink(value);
  return { ok: false, error: "bad_whatsapp" };
}

/**
 * Приводит введённое к ссылке, которую откроет и приложение, и браузер.
 *
 * @param type вид ссылки (`instagram` | `whatsapp` | `website`; незнакомый вид
 *   из старых данных обрабатывается как обычная ссылка — его не выдумывали в
 *   панели, и портить его не за что)
 * @param raw то, что набрал человек
 */
export function normalizeSocialLink(type: string, raw: string): SocialLinkNormalizeResult {
  const value = raw.trim();
  if (!value) return { ok: false, error: "not_a_link" };
  switch (type) {
    case "instagram":
      return normalizeInstagram(value);
    case "whatsapp":
      return normalizeWhatsApp(value);
    default:
      return asWebLink(value);
  }
}

export type SocialLinkRowsResult =
  | { ok: true; links: SocialLinkInput[] }
  | { ok: false; index: number; error: SocialLinkError };

/**
 * Готовит набор строк формы к отправке.
 *
 * Правила, каждое — из поведения потребителя, а не из вкуса:
 *  - строка с пустым адресом просто выбрасывается: это «строку добавил и
 *    передумал», а не «сохрани пустую кнопку»;
 *  - каждый адрес приводится к канонической ссылке (см. normalizeSocialLink);
 *  - два адреса одного вида запрещены: и приложение (`find`), и гид (`LIMIT 1`)
 *    возьмут только первый, второй молча исчезнет — лучше сказать сразу.
 *
 * @returns `{ok:true, links}` — то, что уходит в `social_links` (может быть
 *   пустым массивом: это «стереть все ссылки», сервер заменяет набор целиком),
 *   либо `{ok:false, index, error}` с НОМЕРОМ СТРОКИ формы, чтобы ошибка
 *   показалась ровно под тем полем, где она есть.
 */
export function parseSocialLinkRows(rows: readonly SocialLinkInput[]): SocialLinkRowsResult {
  const links: SocialLinkInput[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const raw = row.url.trim();
    if (!raw) continue;

    const type = row.type.trim();
    const key = type.toLowerCase();
    if (seen.has(key)) return { ok: false, index, error: "duplicate_type" };

    const normalized = normalizeSocialLink(type, raw);
    if (!normalized.ok) return { ok: false, index, error: normalized.error };

    seen.add(key);
    links.push({ type, url: normalized.url });
  }

  return { ok: true, links };
}

/** Совпадают ли наборы (порядок и вид/адрес построчно) — чтобы не тратить
 * запрос на «ничего не изменилось». */
export function sameSocialLinks(
  a: readonly SocialLinkInput[],
  b: readonly SocialLinkInput[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((link, i) => link.type === b[i].type && link.url === b[i].url);
}
