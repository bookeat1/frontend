import { beforeEach, describe, expect, it } from "vitest";

import {
  captureCampaignFromUrl,
  extractPromoFromSearch,
  readCampaignAttribution,
} from "@web/lib/campaign-attribution";

/**
 * Веб-путь «Марафона Алматы»: гость открывает `book-eat.com/...?promo=<uuid>`,
 * значение оседает в `sessionStorage` и должно пережить переходы по сайту БЕЗ
 * параметра в адресе (в отличие от `preorder-failed-flag`, метка НЕ стирается
 * при чтении — её нужно подставить в каждую бронь этой сессии, а не один раз).
 *
 * `knownIds` передаётся явно во всех вызовах вместо стаба
 * `NEXT_PUBLIC_MARATHON_PROMO_ID`: список известных акций читается один раз,
 * при загрузке модуля (см. `KNOWN_CAMPAIGN_IDS`), так что `vi.stubEnv` в тесте
 * пришёл бы уже поздно — явный параметр то же самое проверяет без гонки со
 * временем импорта.
 */

const PROMO = "5c9c6b6e-6b60-4a9a-8f1e-1a2b3c4d5e6f";
const KNOWN_IDS = [PROMO];

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("extractPromoFromSearch", () => {
  it("читает UUID из ?promo=, если он есть в списке известных акций", () => {
    expect(extractPromoFromSearch(`?promo=${PROMO}`, KNOWN_IDS)).toBe(PROMO);
  });

  it("нет параметра — null", () => {
    expect(extractPromoFromSearch("?city=almaty", KNOWN_IDS)).toBeNull();
  });

  it("параметр есть, но это не UUID — null (сервер отвечает 422 на мусор)", () => {
    expect(extractPromoFromSearch("?promo=almaty-marathon", KNOWN_IDS)).toBeNull();
  });

  it("валидный UUID, но НЕ из списка известных акций — null (бэкенд проверяет существование)", () => {
    const unknown = "00000000-0000-4000-8000-000000000000";
    expect(extractPromoFromSearch(`?promo=${unknown}`, KNOWN_IDS)).toBeNull();
  });

  it("список известных акций пуст (переменная окружения не задана) — null для любого UUID", () => {
    expect(extractPromoFromSearch(`?promo=${PROMO}`, [])).toBeNull();
  });
});

describe("captureCampaignFromUrl / readCampaignAttribution", () => {
  it("метки не было — null", () => {
    expect(readCampaignAttribution()).toBeNull();
  });

  it("сохраняет метку из URL и отдаёт её обратно", () => {
    captureCampaignFromUrl(`?promo=${PROMO}`, KNOWN_IDS);
    expect(readCampaignAttribution()).toBe(PROMO);
  });

  it("заход БЕЗ параметра не стирает уже захваченную метку", () => {
    captureCampaignFromUrl(`?promo=${PROMO}`, KNOWN_IDS);
    captureCampaignFromUrl("", KNOWN_IDS);
    expect(readCampaignAttribution()).toBe(PROMO);
  });

  it("метка переживает повторное чтение — это не одноразовый флаг", () => {
    captureCampaignFromUrl(`?promo=${PROMO}`, KNOWN_IDS);
    expect(readCampaignAttribution()).toBe(PROMO);
    expect(readCampaignAttribution()).toBe(PROMO);
  });

  it("невалидный UUID в адресе не сохраняется", () => {
    captureCampaignFromUrl("?promo=not-a-uuid", KNOWN_IDS);
    expect(readCampaignAttribution()).toBeNull();
  });
});
