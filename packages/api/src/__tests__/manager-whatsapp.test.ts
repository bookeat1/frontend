import { describe, expect, it } from "vitest";

import {
  canEditManagerWhatsApp,
  classifyManagerWhatsAppFailure,
  normalizeWhatsAppPhone,
  parseManagerWhatsAppDraft,
  type RestaurantManager,
  type StaffActor,
} from "../admin";
import { AdminApiError } from "../admin/client";

/**
 * REGRESSION GUARD — «согласие включено, слать некуда».
 *
 * Ровно ради этого состояния канал и переделывали: строка персонала с
 * `whatsapp_opt_in = true` и пустым номером выглядит в кабинете как включённое
 * оповещение и не доставляет НИЧЕГО. Бэкенд отвечает на такую пару 422
 * (usecase/restaurants.normalizeWhatsApp), а панель обязана не дать её
 * собрать: человек не должен узнавать правило из ошибки сервера.
 *
 * Что ломается у живого человека, если защита исчезнет: владелец ставит
 * галочку, видит «Сохранено» (или непонятный отказ), уходит — и брони так же
 * никуда не приходят, только теперь он уверен, что всё включено.
 */

const MANAGER: RestaurantManager = {
  id: "m-1",
  restaurant_id: "r-1",
  user_id: "u-1",
  role: "owner",
  whatsapp_opt_in: false,
  whatsapp_phone: null,
};

function manager(patch: Partial<RestaurantManager> = {}): RestaurantManager {
  return { ...MANAGER, ...patch };
}

describe("parseManagerWhatsAppDraft", () => {
  it("отказывает во включении согласия без номера — ни при каком написании пустоты", () => {
    for (const phone of ["", "   ", "\t"]) {
      const result = parseManagerWhatsAppDraft({ optIn: true, phone }, manager());
      expect(result).toEqual({ ok: false, error: "phone_required" });
    }
  });

  it("отказывает и тогда, когда номер стирают, оставляя согласие включённым", () => {
    // Самый коварный случай: номер УЖЕ сохранён, галочка стоит, человек
    // очищает поле. Отправить «пустой номер» одному, а «согласие» оставить —
    // это и есть молчащая строка.
    const saved = manager({ whatsapp_opt_in: true, whatsapp_phone: "+77070000001" });
    expect(parseManagerWhatsAppDraft({ optIn: true, phone: "" }, saved)).toEqual({
      ok: false,
      error: "phone_required",
    });
  });

  it("пропускает согласие вместе с набранным номером и приводит его к виду сервера", () => {
    expect(parseManagerWhatsAppDraft({ optIn: true, phone: "8 707 000 00 01" }, manager())).toEqual({
      ok: true,
      body: { whatsapp_opt_in: true, whatsapp_phone: "+77070000001" },
    });
  });

  it("разрешает снять согласие и стереть номер — молчание по своей воле законно", () => {
    const saved = manager({ whatsapp_opt_in: true, whatsapp_phone: "+77070000001" });
    expect(parseManagerWhatsAppDraft({ optIn: false, phone: "" }, saved)).toEqual({
      ok: true,
      body: { whatsapp_opt_in: false, whatsapp_phone: "" },
    });
  });

  it("шлёт только изменившееся поле: отсутствие поля для сервера — «не трогать»", () => {
    const saved = manager({ whatsapp_opt_in: false, whatsapp_phone: "+77070000001" });
    expect(parseManagerWhatsAppDraft({ optIn: true, phone: "+7 707 000 00 01" }, saved)).toEqual({
      ok: true,
      body: { whatsapp_opt_in: true },
    });
  });

  it("считает набранное иначе, но тот же номер, отсутствием изменений", () => {
    const saved = manager({ whatsapp_opt_in: true, whatsapp_phone: "+77070000001" });
    expect(parseManagerWhatsAppDraft({ optIn: true, phone: "8 (707) 000-00-01" }, saved)).toEqual({
      ok: false,
      error: "nothing_to_change",
    });
  });

  it("отвергает то, что не похоже на номер, ещё до отправки", () => {
    expect(parseManagerWhatsAppDraft({ optIn: true, phone: "707000" }, manager())).toEqual({
      ok: false,
      error: "phone_invalid",
    });
  });
});

describe("normalizeWhatsAppPhone", () => {
  // Те же случаи, что в internal/auth/phone/phone_test.go: панель обязана
  // отправлять ровно ту строку, которую сервер сохранит.
  it.each([
    ["8 707 123 4567", "+77071234567"],
    ["+7 707 123 4567", "+77071234567"],
    ["77071234567", "+77071234567"],
    ["7071234567", "+77071234567"],
    ["+1 202 555 0100", "+12025550100"],
    ["", ""],
  ])("%s → %s", (raw, want) => {
    expect(normalizeWhatsAppPhone(raw)).toBe(want);
  });
});

describe("canEditManagerWhatsApp", () => {
  const owner: StaffActor = { userId: "u-1", isPlatformAdmin: false, staffRole: "owner" };

  it("владелец правит СВОЮ строку — согласие на личный номер личное", () => {
    // Ровно этот случай раньше не работал вовсе: единственный владелец не
    // проходил проверку «строго старше цели» на собственной строке.
    expect(canEditManagerWhatsApp(owner, manager({ user_id: "u-1", role: "owner" }))).toBe(true);
  });

  it("владелец правит менеджера и хостес", () => {
    expect(canEditManagerWhatsApp(owner, manager({ user_id: "u-2", role: "manager" }))).toBe(true);
    expect(canEditManagerWhatsApp(owner, manager({ user_id: "u-3", role: "hostess" }))).toBe(true);
  });

  it("владелец НЕ правит второго владельца — иначе чужие брони уводятся на свой телефон", () => {
    expect(canEditManagerWhatsApp(owner, manager({ user_id: "u-2", role: "owner" }))).toBe(false);
  });

  it("менеджер не правит чужие строки, но правит свою", () => {
    const mgr: StaffActor = { userId: "u-2", isPlatformAdmin: false, staffRole: "manager" };
    expect(canEditManagerWhatsApp(mgr, manager({ user_id: "u-3", role: "hostess" }))).toBe(false);
    expect(canEditManagerWhatsApp(mgr, manager({ user_id: "u-2", role: "manager" }))).toBe(true);
  });

  it("суперадмин правит любую строку, даже не будучи персоналом заведения", () => {
    const admin: StaffActor = { userId: "u-9", isPlatformAdmin: true, staffRole: null };
    expect(canEditManagerWhatsApp(admin, manager({ user_id: "u-1", role: "owner" }))).toBe(true);
  });
});

describe("classifyManagerWhatsAppFailure", () => {
  it("различает 403, 422 и неизвестный исход", () => {
    expect(classifyManagerWhatsAppFailure(new AdminApiError("forbidden", 403))).toBe("forbidden");
    expect(classifyManagerWhatsAppFailure(new AdminApiError("validation", 422))).toBe("refused");
    expect(classifyManagerWhatsAppFailure(new AdminApiError("boom", 500))).toBe("unknown");
    expect(classifyManagerWhatsAppFailure(new Error("network"))).toBe("unknown");
  });
});
