import { describe, expect, it } from "vitest";

import { resolveWhatsAppRecipients } from "../admin/whatsapp-recipients";
import type { RestaurantManager } from "../admin/types";

/**
 * «Кому придёт бронь» — единственный вопрос этой карточки, и ответ на него
 * должен совпадать с отбором бэкенда (`WhatsAppNotifier.recipients`), иначе
 * кабинет снова начнёт обещать доставку, которой нет.
 */

function manager(patch: Partial<RestaurantManager> = {}): RestaurantManager {
  return {
    id: "m-1",
    restaurant_id: "r-1",
    user_id: "u-1",
    role: "owner",
    whatsapp_opt_in: false,
    whatsapp_phone: null,
    ...patch,
  };
}

describe("resolveWhatsAppRecipients", () => {
  it("считает адресатами номер заведения и согласившихся сотрудников", () => {
    const out = resolveWhatsAppRecipients({
      venuePhone: "+77010000001",
      venueEnabled: true,
      staff: [
        manager({ whatsapp_opt_in: true, whatsapp_phone: "+77070000001" }),
        manager({ id: "m-2", user_id: "u-2", role: "hostess" }),
      ],
    });

    expect(out.venuePhone).toBe("+77010000001");
    expect(out.staff.map((r) => r.phone)).toEqual(["+77070000001"]);
    expect(out.nobody).toBe(false);
  });

  it("один аппарат — одно сообщение: совпавший номер не считается дважды", () => {
    const out = resolveWhatsAppRecipients({
      venuePhone: "+77010000001",
      venueEnabled: true,
      staff: [manager({ whatsapp_opt_in: true, whatsapp_phone: "8 701 000 00 01" })],
    });

    expect(out.venuePhone).toBe("+77010000001");
    expect(out.staff).toEqual([]);
  });

  it("недобранный номер адресатом не считается — отправка по нему только откажет", () => {
    const out = resolveWhatsAppRecipients({
      venuePhone: "+7701",
      venueEnabled: true,
      staff: [manager({ whatsapp_opt_in: true, whatsapp_phone: "1234" })],
    });

    expect(out.venuePhone).toBeNull();
    expect(out.staff).toEqual([]);
    expect(out.nobody).toBe(true);
  });

  it("выключенный канал молчит для всех — и для заведения, и для сотрудников", () => {
    const out = resolveWhatsAppRecipients({
      venuePhone: "+77010000001",
      venueEnabled: false,
      // Согласие есть и номер есть, но бэкенд выходит из Notify раньше, чем
      // соберёт получателей: `if !cfg.Enabled`.
      staff: [manager({ whatsapp_opt_in: true, whatsapp_phone: "+77070000001" })],
    });

    expect(out.venuePhone).toBeNull();
    expect(out.staff).toEqual([]);
    expect(out.nobody).toBe(true);
    expect(out.channelOff).toBe(true);
  });

  it("невидимый список персонала — это не «никому»", () => {
    const out = resolveWhatsAppRecipients({ venuePhone: "", venueEnabled: true, staff: null });

    expect(out.staffVisible).toBe(false);
    // Сотрудники могут быть подключены — мы просто их не видим.
    expect(out.nobody).toBe(false);
  });
});
