import type { DetourLink } from "@swmansion/react-native-detour";
import * as SecureStore from "./secure-store";

/**
 * «Марафон Алматы» и любая следующая QR/Detour-акция: гость сканирует код →
 * Detour резолвит отложенную ссылку ОДИН РАЗ за установку
 * (`linkProcessingMode: "deferred-only"`, см. `detour.ts`) → `DetourLinkRouter`
 * получает `link` и раньше СРАЗУ его терял (`clearLink()` сразу после навигации,
 * нигде не сохраняя). Если бронь оформляется не в ту же секунду, а через день,
 * метка кампании к тому моменту уже пропадала.
 *
 * Этот модуль — то, что должно было сохранить метку: одна запись
 * `{ campaignId, linkId, resolvedAt }` в SecureStore (тот же выбор хранилища,
 * что у `token-store`/`update-snooze` — переживает перезапуск, недоступен
 * обычному JS-чтению).
 *
 * ФОРМАТ `campaignId`. Backend (`internal/transport/rest/bookings/request.go`,
 * `promotion_id`) принимает только валидный UUID или отсутствие поля —
 * невалидная строка это 422 на КАЖДОЙ брони гостя, пришедшего по акции.
 * С 10.09.2026 backend-dev добавил и проверку СУЩЕСТВОВАНИЯ промо (не только
 * формата): случайный, чужой или устаревший UUID тоже роняет бронь. Поэтому
 * `extractCampaignId` не просто проверяет UUID-формат, а сверяет значение со
 * СПИСКОМ ИЗВЕСТНЫХ акций (`KNOWN_CAMPAIGN_IDS`, сейчас — только
 * `EXPO_PUBLIC_MARATHON_PROMO_ID`): параметр ссылки, который выглядит как UUID,
 * но не входит в список, отбрасывается точно так же, как нечитаемый мусор —
 * бронь всё равно проходит, только без атрибуции. Имя параметра (`promo`)
 * СОВПАДАЕТ с тем, что веб читает из `?promo=`
 * (см. `apps/web/src/lib/campaign-attribution.ts`) — единое имя на обеих
 * платформах и на бэкенде. Если реальная ссылка Detour назовёт параметр
 * иначе, поправить список кандидатов ниже.
 *
 * TTL — 30 дней: гость может открыть отсканированное приложение не сразу и
 * забронировать позже, но акция не должна засчитываться месяцами спустя.
 */

export const CAMPAIGN_ATTRIBUTION_KEY = "bookeat.campaignAttribution.v1";

export const CAMPAIGN_ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface CampaignAttribution {
  /** UUID акции — то же значение, что уйдёт в `CreateBookingInput.promotionId`. */
  campaignId: string;
  /**
   * Чем резолвнута метка. Detour не даёт отдельного id ссылки в
   * `DetourContextType.link` — берём саму разрешённую ссылку (обычно
   * короткий godetour.link URL), это самое близкое, что есть, и полезно для
   * разбора багов ("какая именно ссылка это была").
   */
  linkId: string;
  /** Unix-время в миллисекундах, когда Detour отдал эту ссылку. */
  resolvedAt: number;
}

export interface AttributionStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Кандидаты на имя параметра с UUID акции, в порядке приоритета. `promo` —
 * основной (совпадает с веб-схемой `?promo=`); остальные — на случай, если
 * ссылку в Detour дашборде заведут с другим именем параметра.
 */
const CAMPAIGN_PARAM_KEYS = ["promo", "campaignId", "campaign_id"] as const;

/**
 * UUID акций, которые реально существуют на бэкенде — сейчас «Марафон
 * Алматы» (backend-dev, 10.09.2026, миграция 0107). Значение публичное
 * (просто идентификатор промо, не credential) — тот же выбор, что у
 * `EXPO_PUBLIC_DETOUR_APP_ID` в `detour.ts`. Пустая переменная (сборка без
 * `.env`) даёт пустой список: атрибуция тихо выключается, а не падает.
 */
export const KNOWN_CAMPAIGN_IDS: readonly string[] = [process.env.EXPO_PUBLIC_MARATHON_PROMO_ID].filter(
  (id): id is string => Boolean(id),
);

/** `null`, если у ссылки нет параметра с UUID ИЗВЕСТНОЙ акции —
 * UUID-формата недостаточно (backend теперь проверяет и существование, см.
 * комментарий модуля выше), а отправлять то, что бэкенд отклонит, нельзя. */
export function extractCampaignId(
  params: Record<string, string>,
  knownIds: readonly string[] = KNOWN_CAMPAIGN_IDS,
): string | null {
  for (const key of CAMPAIGN_PARAM_KEYS) {
    const candidate = params[key];
    if (candidate && isUuid(candidate) && knownIds.includes(candidate)) return candidate;
  }
  return null;
}

/** Строка из хранилища → запись, или `null`. Мусор — это «метки нет», не
 * падение (тот же принцип, что `parseSnooze`). */
export function parseAttribution(raw: string | null): CampaignAttribution | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const { campaignId, linkId, resolvedAt } = record;
  if (typeof campaignId !== "string" || !isUuid(campaignId)) return null;
  if (typeof linkId !== "string" || linkId === "") return null;
  if (typeof resolvedAt !== "number" || !Number.isFinite(resolvedAt)) return null;
  return { campaignId, linkId, resolvedAt };
}

/** Действует ли метка прямо сейчас — младше `CAMPAIGN_ATTRIBUTION_TTL_MS`. */
export function attributionActive(attribution: CampaignAttribution | null, now: number): boolean {
  if (!attribution) return false;
  return now < attribution.resolvedAt + CAMPAIGN_ATTRIBUTION_TTL_MS;
}

/** Прочитать метку. Протухшая или нечитаемая запись — `null`, как и
 * недоступное хранилище (веб-сборка, запертая связка ключей). */
export async function readCampaignAttribution(
  storage: AttributionStorage = SecureStore,
  now: number = Date.now(),
): Promise<CampaignAttribution | null> {
  try {
    const parsed = parseAttribution(await storage.getItemAsync(CAMPAIGN_ATTRIBUTION_KEY));
    return attributionActive(parsed, now) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Сохранить метку разрешённой Detour-ссылки. Возвращает `null` без записи в
 * хранилище, если у ссылки нет узнаваемого UUID акции (см. `extractCampaignId`)
 * — не UUID и не сохранённая метка это одно и то же: писать в хранилище
 * нечего.
 *
 * Ошибка самой записи (недоступный SecureStore) не мешает вызвавшему коду
 * узнать, что метка БЫЛА найдена — тот же выбор, что у `writeUpdateSnooze`:
 * долговечность записи может подвести, репортинг находки — нет.
 */
export async function writeCampaignAttribution(
  link: Pick<NonNullable<DetourLink>, "url" | "params">,
  now: number = Date.now(),
  storage: AttributionStorage = SecureStore,
  knownIds: readonly string[] = KNOWN_CAMPAIGN_IDS,
): Promise<CampaignAttribution | null> {
  const campaignId = extractCampaignId(link.params, knownIds);
  if (!campaignId) return null;

  const attribution: CampaignAttribution = { campaignId, linkId: String(link.url), resolvedAt: now };
  try {
    await storage.setItemAsync(CAMPAIGN_ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    // Хранилище недоступно — метка просто не переживёт следующий холодный
    // старт. Находка всё равно реальна, поэтому возвращаем её.
  }
  return attribution;
}
