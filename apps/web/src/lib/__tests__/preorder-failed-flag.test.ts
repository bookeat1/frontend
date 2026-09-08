import { beforeEach, describe, expect, it } from "vitest";

import { consumePreorderFailedFlag, markPreorderFailed } from "@web/lib/preorder-failed-flag";

/**
 * Флаг «бронь создана, а предзаказ не прикрепился» — расширен ПРИЧИНОЙ
 * (D-WEB-1, ТЗ `web-preorder-menu-20260908`, D5). Читается ровно один раз
 * (сам ключ стирается) и принимает старый формат `"1"` как `"other"`.
 */

const BOOKING = "booking-1";
const KEY = `bookeat.web.preorder-failed.${BOOKING}`;

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("markPreorderFailed / consumePreorderFailedFlag", () => {
  it("флага не было — null, и он остаётся не тронут", () => {
    expect(consumePreorderFailedFlag(BOOKING)).toBeNull();
  });

  it("без причины — по умолчанию \"other\"", () => {
    markPreorderFailed(BOOKING);
    expect(consumePreorderFailedFlag(BOOKING)).toBe("other");
  });

  it.each(["below_minimum", "item_unavailable", "locked", "other"] as const)(
    "причина %s сохраняется и читается один раз",
    (reason) => {
      markPreorderFailed(BOOKING, reason);
      expect(consumePreorderFailedFlag(BOOKING)).toBe(reason);
      // Второй вызов — ключ уже стёрт первым чтением (A14).
      expect(consumePreorderFailedFlag(BOOKING)).toBeNull();
    },
  );

  it("старый формат \"1\" читается как \"other\" — билет, открытый посреди раскатки, не теряет уведомление", () => {
    window.sessionStorage.setItem(KEY, "1");
    expect(consumePreorderFailedFlag(BOOKING)).toBe("other");
  });

  it("испорченное значение в хранилище — тоже \"other\", а не потеря уведомления", () => {
    window.sessionStorage.setItem(KEY, "{not json");
    expect(consumePreorderFailedFlag(BOOKING)).toBe("other");
  });

  it("незнакомая причина в JSON — тоже \"other\"", () => {
    window.sessionStorage.setItem(KEY, JSON.stringify({ reason: "made_up" }));
    expect(consumePreorderFailedFlag(BOOKING)).toBe("other");
  });

  it("флаг привязан к bookingId — чужой ключ не трогает", () => {
    markPreorderFailed(BOOKING, "locked");
    expect(consumePreorderFailedFlag("booking-2")).toBeNull();
    expect(consumePreorderFailedFlag(BOOKING)).toBe("locked");
  });
});
