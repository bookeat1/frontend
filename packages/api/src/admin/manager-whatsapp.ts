/**
 * Согласие сотрудника получать брони в WhatsApp: разбор набранного, кто кому
 * может это менять и что означает отказ сервера.
 *
 * Почему логика тут, а не в компоненте: правило «включено, но некуда слать» —
 * это контракт с бэкендом (usecase/restaurants.normalizeWhatsApp), и он должен
 * проверяться без DOM. Прецеденты — `parsePriceRangeInput`,
 * `classifyCapacitySwitchFailure`.
 */

import { AdminApiError } from "./client";
import type { RestaurantManager, SetManagerWhatsAppInput } from "./types";

/**
 * Приводит набранный номер к тому виду, который запишет сервер.
 *
 * Точная копия `internal/auth/phone.Normalize` (тот же рынок, тот же
 * умолчательный код +7): «8 707 …», «+7 707 …» и «7071234567» — один и тот же
 * номер, и панель обязана отправить ту же строку, что сервер сохранит, иначе
 * поле после сохранения перерисуется чужим значением.
 *
 * Пустая строка означает «номера нет» — это НЕ ошибка сама по себе (номер
 * можно очистить), ошибкой её делает включённое согласие.
 */
export function normalizeWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return "";
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  if (digits.length === 10) return `+7${digits}`;
  return `+${digits}`;
}

/**
 * Проверка ФОРМЫ номера, не существования: 11 цифр плюс «+» — самый короткий
 * номер этого рынка, и ровно этот порог стоит на бэкенде
 * (`normalizeWhatsAppPhone`, len < 12 → 422). Есть ли номер в WhatsApp,
 * покажет только первая отправка.
 */
export function isWhatsAppPhoneShaped(normalized: string): boolean {
  return normalized.startsWith("+") && normalized.length >= 12;
}

/** Роли сотрудника заведения в порядке прав (domain.StaffRole.rank).
 * Незнакомая роль — 0: она никого не старше. */
export function staffRoleRank(role: string): number {
  switch (role) {
    case "hostess":
      return 1;
    case "manager":
      return 2;
    case "owner":
      return 3;
    default:
      return 0;
  }
}

/** Кто сейчас в панели, с точки зрения прав на чужие строки персонала. */
export interface StaffActor {
  /** users/me.id — им же опознаётся собственная строка. */
  userId: string;
  /** Глобальная роль (`admin` = суперадмин, обходит всё). */
  isPlatformAdmin: boolean;
  /** Роль этого же человека В ЭТОМ заведении, если он в персонале.
   * null — суперадмин без строки персонала. */
  staffRole: string | null;
}

/**
 * Повторяет `authorizeWhatsApp` бэкенда: суперадмин, ИЛИ владелец самой
 * строки (согласие на сообщения на личный номер — дело личное), ИЛИ держатель
 * `staff.manage` (среди ролей заведения это только `owner`), СТРОГО старше
 * цели.
 *
 * Строгость важна: владелец не может переключить согласие другого владельца —
 * иначе чужие оповещения уводятся на свой телефон. Значит, у второго владельца
 * в списке контрол показывать нельзя: он вернёт 403 по нажатию.
 */
export function canEditManagerWhatsApp(actor: StaffActor, target: RestaurantManager): boolean {
  if (actor.isPlatformAdmin) return true;
  if (actor.userId === target.user_id) return true;
  if (actor.staffRole !== "owner") return false;
  return staffRoleRank(actor.staffRole) > staffRoleRank(target.role);
}

/** Что человек набрал в строке сотрудника. */
export interface ManagerWhatsAppDraft {
  optIn: boolean;
  /** Как набрано, без приведения — приводим при разборе. */
  phone: string;
}

export type ManagerWhatsAppDraftError =
  /** Согласие включено, а слать некуда. Именно это состояние сервер отвергает
   * 422, и именно ради него вся фича существует. */
  | "phone_required"
  /** Номер набран, но это не номер. */
  | "phone_invalid"
  /** Ничего не изменилось относительно сохранённого — пустой PATCH сервер тоже
   * отвергает 422 («nothing to change»). */
  | "nothing_to_change";

export type ManagerWhatsAppDraftResult =
  | { ok: true; body: SetManagerWhatsAppInput }
  | { ok: false; error: ManagerWhatsAppDraftError };

/**
 * Собирает тело PATCH из набранного и СОХРАНЁННОГО состояния строки.
 *
 * Отсутствующее поле для сервера означает «не трогать», поэтому шлём только
 * то, что реально поменялось; пустая строка в `whatsapp_phone` — это «стереть
 * номер», и она отправляется осознанно.
 */
export function parseManagerWhatsAppDraft(
  draft: ManagerWhatsAppDraft,
  saved: Pick<RestaurantManager, "whatsapp_opt_in" | "whatsapp_phone">,
): ManagerWhatsAppDraftResult {
  const typed = draft.phone.trim();
  const normalized = normalizeWhatsAppPhone(typed);

  if (typed !== "" && !isWhatsAppPhoneShaped(normalized)) {
    return { ok: false, error: "phone_invalid" };
  }
  // ГЛАВНАЯ ЗАЩИТА. «Включено и молчит» выглядит в кабинете как работающее
  // оповещение и не доставляет ничего; сервер за это отвечает 422, а человек
  // не должен узнавать о правиле из ошибки.
  if (draft.optIn && normalized === "") {
    return { ok: false, error: "phone_required" };
  }

  const savedPhone = saved.whatsapp_phone ?? "";
  const body: SetManagerWhatsAppInput = {};
  if (draft.optIn !== saved.whatsapp_opt_in) body.whatsapp_opt_in = draft.optIn;
  if (normalized !== savedPhone) body.whatsapp_phone = normalized;

  if (body.whatsapp_opt_in === undefined && body.whatsapp_phone === undefined) {
    return { ok: false, error: "nothing_to_change" };
  }
  return { ok: true, body };
}

/** Чем закончился отказ сервера на PATCH строки персонала. */
export type ManagerWhatsAppFailureKind =
  /** 403 — эта строка не в нашей власти (равный или старший по роли). */
  | "forbidden"
  /** 422 — сервер отверг пару «согласие + номер» или сам номер. */
  | "refused"
  /** 401 — сессия кончилась. */
  | "unauthorized"
  /** 404 — строки уже нет (сотрудника удалили из другой вкладки). */
  | "not_found"
  /** Сеть, таймаут, 5xx — НЕ знаем, записалось ли. */
  | "unknown";

/** Классифицирует отказ. Принимает `unknown`, потому что стоит в `catch`. */
export function classifyManagerWhatsAppFailure(error: unknown): ManagerWhatsAppFailureKind {
  const status = error instanceof AdminApiError ? error.status : undefined;
  switch (status) {
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 422:
      return "refused";
    default:
      return "unknown";
  }
}
