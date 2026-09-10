import { render } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __store as secureStoreMemory } from "../../../../../test/stubs/expo-secure-store";

/**
 * До этой правки `DetourLinkRouter` читал `link.params`/`link.type` РОВНО ОДИН
 * РАЗ — подставлял их в параметры навигации — и тут же звал `clearLink()`,
 * никуда ничего не сохраняя. Гость «Марафона Алматы», который бронирует не в
 * ту же секунду, а на следующий день, приходил бы на экран подтверждения без
 * единого следа акции. Тест держит ровно это: метка должна пережить ЭТОТ ЖЕ
 * переход, а не потеряться вместе с `clearLink()`.
 */

let isLinkProcessed = false;
let link: {
  url: string;
  route: string;
  pathname: string;
  params: Record<string, string>;
  type: "deferred" | "verified" | "scheme";
} | null = null;
const clearLink = vi.fn();

vi.mock("@swmansion/react-native-detour", () => ({
  useDetourContext: () => ({ isLinkProcessed, link, clearLink }),
}));

const replace = vi.fn();
vi.mock("expo-router", () => ({
  useRouter: () => ({ replace }),
}));

const trackEvent = vi.fn();
vi.mock("../analytics", () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

/** Настоящий UUID «Марафона Алматы» (backend-dev, 10.09.2026). Стаблена ДО
 * ЛЮБОГО импорта `campaign-attribution.ts` (даже транзитивного, через
 * `detour-link-router.tsx`): `KNOWN_CAMPAIGN_IDS` там — top-level `const`,
 * читающий `process.env.EXPO_PUBLIC_MARATHON_PROMO_ID` ровно один раз, при
 * загрузке модуля. Статический `import` в начале файла выполнился бы раньше
 * этой строки (спецификация ES-модулей: `import` — до тела модуля), поэтому
 * оба импорта ниже — динамические, ПОСЛЕ `vi.stubEnv`. */
const PROMO_UUID = "6a3736b9-d4e5-4ec6-9ed2-7233476184fd";
vi.stubEnv("EXPO_PUBLIC_MARATHON_PROMO_ID", PROMO_UUID);

/** Валидный UUID, которого НЕТ в списке известных акций — та самая ситуация,
 * которую backend теперь отклоняет (проверка существования, не только
 * формата). */
const UNKNOWN_PROMO_UUID = "00000000-0000-4000-8000-000000000000";

const { DetourLinkRouter } = await import("../detour-link-router");
const { CAMPAIGN_ATTRIBUTION_KEY } = await import("../campaign-attribution");

beforeEach(() => {
  isLinkProcessed = false;
  link = null;
  clearLink.mockClear();
  replace.mockClear();
  trackEvent.mockClear();
  secureStoreMemory.clear();
});

/** Ждёт микротаски эффекта — сам эффект внутри асинхронный (`await
 * writeCampaignAttribution`), synchronous `render` его не дожидается. */
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("DetourLinkRouter: атрибуция кампании", () => {
  it("сохраняет метку акции ДО clearLink(), а не теряет её", async () => {
    isLinkProcessed = true;
    link = {
      url: `https://bookeat.godetour.link/marathon?promo=${PROMO_UUID}`,
      route: "promo",
      pathname: "/promotions",
      params: { promo: PROMO_UUID },
      type: "deferred",
    };

    render(<DetourLinkRouter />);
    await flush();

    const stored = secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toMatchObject({ campaignId: PROMO_UUID });

    // Навигация и очистка Detour-состояния по-прежнему происходят — метка
    // сохраняется В ДОПОЛНЕНИЕ, а не вместо них.
    expect(replace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/promotions" }),
    );
    expect(clearLink).toHaveBeenCalledTimes(1);
  });

  it("шлёт deep_link_attributed один раз, при первом обнаружении метки", async () => {
    isLinkProcessed = true;
    link = {
      url: `https://bookeat.godetour.link/marathon?promo=${PROMO_UUID}`,
      route: "promo",
      pathname: "/promotions",
      params: { promo: PROMO_UUID },
      type: "deferred",
    };

    render(<DetourLinkRouter />);
    await flush();

    expect(trackEvent).toHaveBeenCalledWith("deep_link_attributed", {
      campaign_id: PROMO_UUID,
      link_type: "deferred",
    });
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it("ссылка без узнаваемого параметра акции — навигация идёт, но метка не пишется", async () => {
    isLinkProcessed = true;
    link = {
      url: "https://bookeat.godetour.link/generic",
      route: "restaurant",
      pathname: "/restaurant/[id]",
      params: { id: "r-1" },
      type: "deferred",
    };

    render(<DetourLinkRouter />);
    await flush();

    expect(secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY)).toBeUndefined();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/restaurant/[id]" }));
    expect(clearLink).toHaveBeenCalledTimes(1);
  });

  it("валидный UUID, но НЕ из списка известных акций — тоже не пишется (бэкенд теперь проверяет существование)", async () => {
    isLinkProcessed = true;
    link = {
      url: `https://bookeat.godetour.link/somewhere?promo=${UNKNOWN_PROMO_UUID}`,
      route: "promo",
      pathname: "/promotions",
      params: { promo: UNKNOWN_PROMO_UUID },
      type: "deferred",
    };

    render(<DetourLinkRouter />);
    await flush();

    expect(secureStoreMemory.get(CAMPAIGN_ATTRIBUTION_KEY)).toBeUndefined();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(clearLink).toHaveBeenCalledTimes(1);
  });

  it("без разрешённой ссылки ничего не делает", () => {
    isLinkProcessed = false;
    link = null;

    render(<DetourLinkRouter />);

    expect(replace).not.toHaveBeenCalled();
    expect(clearLink).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
