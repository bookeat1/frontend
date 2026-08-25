/**
 * Кто на самом деле получит сообщение о новой брони в WhatsApp.
 *
 * Раньше кабинет показывал зелёное «Подключено» рядом с номером заведения, и
 * это было обещанием, которого канал не выполнял: рассылка шла только по
 * сотрудникам с включённым согласием. Теперь адресатов ДВА вида — номер
 * заведения и личные номера согласившихся сотрудников, — и единственный
 * честный ответ на вопрос «кому придёт бронь» собирается здесь, а не в вёрстке.
 *
 * Правила повторяют отбор бэкенда (`WhatsAppNotifier.recipients`):
 *  - номер короче «+» и 11 цифр непригоден — отправка по нему может кончиться
 *    только постоянным отказом, значит адресатом он не считается;
 *  - совпавшие номера схлопываются: один аппарат получит одно сообщение, и
 *    список в кабинете не должен обещать два.
 */

import { isWhatsAppPhoneShaped, normalizeWhatsAppPhone } from "./manager-whatsapp";
import type { RestaurantManager } from "./types";

export interface WhatsAppRecipientsInput {
  /** `WhatsAppSettings.whatsapp_phone` — номер самого заведения. */
  venuePhone: string;
  /** `WhatsAppSettings.enabled` — рубильник ВСЕГО канала заведения
   * (`WhatsAppNotifier.Notify`: `if !cfg.Enabled` → выходим до сбора
   * адресатов). Выключенный канал молчит и для сотрудников с согласием. */
  venueEnabled: boolean;
  /** Персонал заведения; `null` — список этой роли не виден (403 на GET
   * /restaurants/:id/managers). Это НЕ «сотрудников нет». */
  staff: RestaurantManager[] | null;
}

/** Сотрудник, который получит бронь на личный номер. */
export interface WhatsAppStaffRecipient {
  managerId: string;
  userId: string;
  role: string;
  /** Приведённый к международному виду номер. */
  phone: string;
}

export interface WhatsAppRecipients {
  /** Номер заведения, если он реально адресат; иначе null. */
  venuePhone: string | null;
  /** Согласившиеся сотрудники с пригодным номером, без совпадений по номеру. */
  staff: WhatsAppStaffRecipient[];
  /** Виден ли список персонала. Когда false, «получателей нет» означает лишь
   * «нам их не видно», и говорить «никому» нельзя. */
  staffVisible: boolean;
  /** Точно известно, что брони не придут никому. */
  nobody: boolean;
  /** Канал заведения выключен целиком: адресатов нет по определению. */
  channelOff: boolean;
}

export function resolveWhatsAppRecipients(input: WhatsAppRecipientsInput): WhatsAppRecipients {
  const staffVisibleFlag = input.staff !== null;

  // Рубильник канала бьёт по всем адресатам сразу, а не только по номеру
  // заведения: бэкенд выходит из Notify до того, как соберёт список.
  if (!input.venueEnabled) {
    return {
      venuePhone: null,
      staff: [],
      staffVisible: staffVisibleFlag,
      nobody: true,
      channelOff: true,
    };
  }

  const seen = new Set<string>();

  const venueNormalized = normalizeWhatsAppPhone(input.venuePhone.trim());
  const venueUsable = isWhatsAppPhoneShaped(venueNormalized);
  const venuePhone = venueUsable ? venueNormalized : null;
  if (venuePhone) seen.add(venuePhone);

  const staff: WhatsAppStaffRecipient[] = [];
  for (const manager of input.staff ?? []) {
    if (!manager.whatsapp_opt_in) continue;
    const phone = normalizeWhatsAppPhone((manager.whatsapp_phone ?? "").trim());
    if (!isWhatsAppPhoneShaped(phone)) continue;
    if (seen.has(phone)) continue;
    seen.add(phone);
    staff.push({
      managerId: manager.id,
      userId: manager.user_id,
      role: manager.role,
      phone,
    });
  }

  return {
    venuePhone,
    staff,
    staffVisible: staffVisibleFlag,
    nobody: staffVisibleFlag && venuePhone === null && staff.length === 0,
    channelOff: false,
  };
}
