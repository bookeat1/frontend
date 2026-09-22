import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_ATTRIBUTION_KEY,
  CAMPAIGN_ATTRIBUTION_TTL_MS,
  attributionActive,
  extractCampaignId,
  extractSource,
  isValidSource,
  parseAttribution,
  parseKnownCampaignIds,
  readCampaignAttribution,
  writeCampaignAttribution,
  type AttributionStorage,
} from "../campaign-attribution";

/**
 * Правила метки «Марафона Алматы» (и следующих QR/Detour-акций) в изоляции от
 * React/Detour — `detour-link-router.test.tsx` держит интеграцию с самим
 * компонентом, а этот файл держит то, что должно ошибаться В ОДНУ СТОРОНУ:
 *   • мусор в хранилище читается как «метки нет», а не падение;
 *   • UUID, которого нет в списке известных акций, отбрасывается (backend
 *     теперь проверяет существование, не только формат — иначе бронь 422);
 *   • метка не вечна — 30 дней.
 */

const PROMO = "6a3736b9-d4e5-4ec6-9ed2-7233476184fd";
const UNKNOWN = "00000000-0000-4000-8000-000000000000";
const KNOWN_IDS = [PROMO];

/** Хранилище в памяти + переключатель «а теперь оно сломано» — тот же приём,
 * что у `update-snooze.test.ts`. */
function memory(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  let broken = false;
  const storage: AttributionStorage = {
    async getItemAsync(key) {
      if (broken) throw new Error("keychain is locked");
      return map.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      if (broken) throw new Error("keychain is locked");
      map.set(key, value);
    },
  };
  return { storage, map, break: () => (broken = true) };
}

const NOW = Date.parse("2026-09-10T10:00:00Z");

describe("parseKnownCampaignIds", () => {
  const SECOND = "ab6cd665-eb11-4c45-b0ad-999db0c95116";

  it("оба источника не заданы — пустой список", () => {
    expect(parseKnownCampaignIds(undefined, undefined)).toEqual([]);
  });

  it("только новый список через запятую", () => {
    expect(parseKnownCampaignIds(`${PROMO},${SECOND}`, undefined)).toEqual([PROMO, SECOND]);
  });

  it("пробелы вокруг запятых и пустые элементы отбрасываются", () => {
    expect(parseKnownCampaignIds(` ${PROMO} , ,${SECOND} `, undefined)).toEqual([PROMO, SECOND]);
  });

  it("только legacy-переменная — обратная совместимость", () => {
    expect(parseKnownCampaignIds(undefined, PROMO)).toEqual([PROMO]);
  });

  it("оба источника — объединяются без дублей", () => {
    expect(parseKnownCampaignIds(PROMO, PROMO)).toEqual([PROMO]);
    expect(parseKnownCampaignIds(SECOND, PROMO)).toEqual([SECOND, PROMO]);
  });
});

describe("extractCampaignId", () => {
  it("берёт promo из параметров, если он в списке известных акций", () => {
    expect(extractCampaignId({ promo: PROMO }, KNOWN_IDS)).toBe(PROMO);
  });

  it("UUID-формат, но акции нет в списке — null", () => {
    expect(extractCampaignId({ promo: UNKNOWN }, KNOWN_IDS)).toBeNull();
  });

  it("нет узнаваемого параметра — null", () => {
    expect(extractCampaignId({ id: "r-1" }, KNOWN_IDS)).toBeNull();
  });

  it("список известных акций пуст — null для любого параметра", () => {
    expect(extractCampaignId({ promo: PROMO }, [])).toBeNull();
  });

  it.each(["campaignId", "campaign_id"])("падение на запасной параметр %s", (key) => {
    expect(extractCampaignId({ [key]: PROMO }, KNOWN_IDS)).toBe(PROMO);
  });
});

/**
 * Канал-метка `source` (21.09.2026, «Марафон Алматы» ревизия 2,
 * `specs/marathon-qr-attribution-20260921.md`, критерий 5): формат
 * `^[a-z0-9_-]{1,32}$`, невалидное значение — «метки нет», НЕ падение и НЕ
 * повод ронять навигацию.
 */
describe("isValidSource / extractSource", () => {
  it.each(["tshirt", "box", "a", "a-b_c", "a".repeat(32), "kz2026"])(
    "%s — валидный формат",
    (value) => {
      expect(isValidSource(value)).toBe(true);
    },
  );

  it.each([
    ["пробел", "t shirt"],
    ["кириллица", "футболка"],
    ["длиннее 32 символов", "a".repeat(33)],
    ["пустая строка", ""],
    ["заглавные буквы", "TShirt"],
    ["спецсимволы", "tshirt!"],
  ])("%s — невалидный формат", (_name, value) => {
    expect(isValidSource(value)).toBe(false);
  });

  it("берёт source из параметров, если формат валиден", () => {
    expect(extractSource({ source: "tshirt" })).toBe("tshirt");
  });

  it("невалидный формат — null, не бросает", () => {
    expect(extractSource({ source: "футболка" })).toBeNull();
  });

  it("нет параметра source — null", () => {
    expect(extractSource({ promo: "x" })).toBeNull();
  });
});

describe("parseAttribution", () => {
  it("читает свою запись", () => {
    expect(
      parseAttribution(JSON.stringify({ campaignId: PROMO, linkId: "https://x", resolvedAt: NOW })),
    ).toEqual({ campaignId: PROMO, linkId: "https://x", resolvedAt: NOW });
  });

  it.each([
    ["пусто", null],
    ["не JSON", "{"],
    ["не UUID в campaignId и невалидный source", JSON.stringify({ campaignId: "slug", linkId: "x", resolvedAt: NOW })],
    ["без linkId", JSON.stringify({ campaignId: PROMO, resolvedAt: NOW })],
    ["resolvedAt не число", JSON.stringify({ campaignId: PROMO, linkId: "x", resolvedAt: "вчера" })],
    ["ни campaignId, ни source", JSON.stringify({ linkId: "x", resolvedAt: NOW })],
  ])("%s — это «метки нет», а не падение", (_name, raw) => {
    expect(parseAttribution(raw)).toBeNull();
  });

  it("читает запись только с source (новый формат канал-метки)", () => {
    expect(
      parseAttribution(JSON.stringify({ source: "tshirt", linkId: "https://x", resolvedAt: NOW })),
    ).toEqual({ source: "tshirt", linkId: "https://x", resolvedAt: NOW });
  });

  it("невалидный source в записи отбрасывается, но campaignId остаётся", () => {
    expect(
      parseAttribution(
        JSON.stringify({ campaignId: PROMO, source: "футболка", linkId: "https://x", resolvedAt: NOW }),
      ),
    ).toEqual({ campaignId: PROMO, linkId: "https://x", resolvedAt: NOW });
  });
});

describe("attributionActive", () => {
  const attribution = { campaignId: PROMO, linkId: "https://x", resolvedAt: NOW };

  it("в пределах 30 дней — активна", () => {
    expect(attributionActive(attribution, NOW + CAMPAIGN_ATTRIBUTION_TTL_MS - 1)).toBe(true);
  });

  it("ровно на границе и позже — протухла", () => {
    expect(attributionActive(attribution, NOW + CAMPAIGN_ATTRIBUTION_TTL_MS)).toBe(false);
  });

  it("метки нет — не активна", () => {
    expect(attributionActive(null, NOW)).toBe(false);
  });
});

describe("read/writeCampaignAttribution", () => {
  it("записывает и читает известную акцию", async () => {
    const { storage } = memory();
    const written = await writeCampaignAttribution(
      { url: "https://bookeat.godetour.link/marathon", params: { promo: PROMO } },
      NOW,
      storage,
      KNOWN_IDS,
    );

    expect(written).toEqual({ campaignId: PROMO, linkId: "https://bookeat.godetour.link/marathon", resolvedAt: NOW });
    await expect(readCampaignAttribution(storage, NOW)).resolves.toEqual(written);
  });

  it("неизвестная акция — ничего не пишет", async () => {
    const { storage, map } = memory();
    const written = await writeCampaignAttribution(
      { url: "https://bookeat.godetour.link/x", params: { promo: UNKNOWN } },
      NOW,
      storage,
      KNOWN_IDS,
    );

    expect(written).toBeNull();
    expect(map.has(CAMPAIGN_ATTRIBUTION_KEY)).toBe(false);
  });

  it("протухшая метка читается как отсутствующая", async () => {
    const { storage } = memory();
    await writeCampaignAttribution(
      { url: "https://bookeat.godetour.link/marathon", params: { promo: PROMO } },
      NOW,
      storage,
      KNOWN_IDS,
    );

    await expect(
      readCampaignAttribution(storage, NOW + CAMPAIGN_ATTRIBUTION_TTL_MS + 1),
    ).resolves.toBeNull();
  });

  it("запертая связка ключей не мешает узнать о находке, но и не переживает запись", async () => {
    const store = memory();
    store.break();
    const written = await writeCampaignAttribution(
      { url: "https://bookeat.godetour.link/marathon", params: { promo: PROMO } },
      NOW,
      store.storage,
      KNOWN_IDS,
    );
    expect(written).toEqual({ campaignId: PROMO, linkId: "https://bookeat.godetour.link/marathon", resolvedAt: NOW });
    await expect(readCampaignAttribution(store.storage, NOW)).resolves.toBeNull();
  });

  /**
   * Канал-метка `source` (критерии 1-5, 20 спеки `marathon-qr-attribution-
   * 20260921.md`). Одна и та же запись/хранилище, что у `campaignId` —
   * только имя поля и параметра другое.
   */
  describe("source", () => {
    it("записывает и читает известный формат source", async () => {
      const { storage } = memory();
      const written = await writeCampaignAttribution(
        { url: "https://bookeat.godetour.link/lQ9BPpUvJc00tshirt", params: { source: "tshirt" } },
        NOW,
        storage,
      );

      expect(written).toEqual({
        source: "tshirt",
        linkId: "https://bookeat.godetour.link/lQ9BPpUvJc00tshirt",
        resolvedAt: NOW,
      });
      await expect(readCampaignAttribution(storage, NOW)).resolves.toEqual(written);
    });

    it("невалидный формат source — ничего не пишет (критерий 5)", async () => {
      const { storage, map } = memory();
      const written = await writeCampaignAttribution(
        { url: "https://bookeat.godetour.link/x", params: { source: "футболка мусор 40 символов ровно" } },
        NOW,
        storage,
      );

      expect(written).toBeNull();
      expect(map.has(CAMPAIGN_ATTRIBUTION_KEY)).toBe(false);
    });

    it("ни source, ни promo — ничего не пишет, без ошибок (критерий 4)", async () => {
      const { storage, map } = memory();
      const written = await writeCampaignAttribution(
        { url: "https://bookeat.godetour.link/generic", params: {} },
        NOW,
        storage,
      );

      expect(written).toBeNull();
      expect(map.has(CAMPAIGN_ATTRIBUTION_KEY)).toBe(false);
    });

    it("протухшая метка source читается как отсутствующая (TTL 30 дней, критерий 20)", async () => {
      const { storage } = memory();
      await writeCampaignAttribution(
        { url: "https://bookeat.godetour.link/lQ9BPpUvJc00box", params: { source: "box" } },
        NOW,
        storage,
      );

      await expect(
        readCampaignAttribution(storage, NOW + CAMPAIGN_ATTRIBUTION_TTL_MS + 1),
      ).resolves.toBeNull();
    });

    it("старый формат campaignId побеждает, если ссылка почему-то несёт оба поля", async () => {
      const { storage } = memory();
      const written = await writeCampaignAttribution(
        { url: "https://bookeat.godetour.link/both", params: { promo: PROMO, source: "tshirt" } },
        NOW,
        storage,
        KNOWN_IDS,
      );

      expect(written).toEqual({ campaignId: PROMO, linkId: "https://bookeat.godetour.link/both", resolvedAt: NOW });
    });
  });
});
