import type { PushOutcome, PushPermission } from "./push-registration";

/**
 * Что показывает и что делает тумблер «Уведомления» в настройках.
 *
 * ГЛАВНОЕ ПРАВИЛО ЭТОГО ФАЙЛА: положение тумблера — это НЕ сохранённое булево.
 * Это сохранённое булево И системное разрешение вместе. До 01.09.2026 тумблер
 * показывал только булево, поэтому гость с запрещёнными в системе
 * уведомлениями видел «включено» и ничего не получал (жалоба тестировщика,
 * bugs/bookeat-android-push-devicenotregistered).
 *
 * Разрешение принадлежит операционной системе, а не нам:
 *   • спросить его можно ровно один раз (на iOS — за всю жизнь установки);
 *   • после отказа `requestPermissionsAsync` возвращает «нет» БЕЗ диалога,
 *     поэтому единственный выход — системные настройки приложения;
 *   • выключить его снаружи нельзя вообще, так что «выключить» у нас значит
 *     «снять регистрацию токена и больше не регистрировать».
 *
 * Отсюда и три состояния строки: включено, выключено и выключено-системой
 * (`blocked`), у последнего есть кнопка в системные настройки.
 */

/** Всё, из чего складывается положение тумблера. Разделено на факты и вид,
 * чтобы решение проверялось без React, Expo и телефона. */
export interface NotificationsFacts {
  /** Может ли эта сборка вообще получать пуши (web, симулятор, Expo Go). */
  supported: boolean;
  /** Что говорит система ПРЯМО СЕЙЧАС. */
  permission: PushPermission;
  /** Что гость выбрал у нас. */
  pref: boolean;
}

export interface NotificationsView {
  /** Положение переключателя. */
  value: boolean;
  /** Гость хочет уведомления, но система запретила и второй раз не спросит:
   * показываем объяснение и путь в системные настройки. */
  blocked: boolean;
  /** Пуши невозможны в этой среде: строка неактивна, ошибки нет. */
  unsupported: boolean;
}

export function notificationsView(facts: NotificationsFacts): NotificationsView {
  if (!facts.supported) {
    return { value: false, blocked: false, unsupported: true };
  }
  return {
    // Обе половины обязательны. Именно это условие и есть починка вранья.
    value: facts.permission === "granted" && facts.pref,
    // Про «сходите в настройки» говорим только тому, кто просил уведомления.
    // Гостю, который сам их выключил, это шум.
    blocked: facts.permission === "denied" && facts.pref,
    unsupported: false,
  };
}

/** Что делает нажатие. Один переключатель, четыре разных действия — решает
 * система, а не мы. */
export type NotificationsToggleAction =
  /** Разрешение уже есть: сохранить выбор и зарегистрировать токен. */
  | "enable"
  /** Разрешение ещё не спрашивали: системный диалог, потом регистрация. */
  | "prompt"
  /** Система сказала «нет» и больше не спросит: ведём в настройки телефона. */
  | "open-settings"
  /** Выключаем у себя и снимаем регистрацию токена. */
  | "disable"
  /** Пуши в этой среде невозможны — нажатие ничего не значит. */
  | "ignore";

export function notificationsToggleAction(
  next: boolean,
  facts: Pick<NotificationsFacts, "supported" | "permission">,
): NotificationsToggleAction {
  if (!facts.supported) return "ignore";
  if (!next) return "disable";
  if (facts.permission === "granted") return "enable";
  if (facts.permission === "denied") return "open-settings";
  return "prompt";
}

/**
 * Исходы, после которых «включено» было бы неправдой: разрешение, может, и
 * есть, но токен на сервер не ушёл. Такое честнее показать выключенным с
 * возможностью повторить, чем оставить включённым и молчать.
 */
export function registrationFailed(outcome: PushOutcome): boolean {
  return outcome.state === "failed" || outcome.state === "no-token";
}
