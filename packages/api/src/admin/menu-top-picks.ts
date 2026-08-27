import { RepositoryError } from "../repository";

/**
 * «Лучшие позиции» заведения — витринная полка, которую заведение собирает само.
 *
 * Здесь лежит всё, что можно проверить без DOM: предел полки, перестановка
 * внутри порядка и разбор отказа сервера. Компонент отвечает только за разметку
 * и за слова.
 */

/**
 * Сколько блюд заведение может поставить на полку.
 *
 * Ровно `domain.MenuTopPickLimit` (internal/domain/menu_item.go, 2026-08-27).
 * Продублировано на клиенте НЕ как проверка — считает сервер, и он же отвечает
 * 422 `menu_top_picks_limit`, — а чтобы панель могла сказать «занято 8 из 8»
 * ДО того, как управляющий нажмёт и получит отказ. Если предел на сервере
 * изменится, здесь будет неверная подпись, но не неверная запись.
 */
export const MENU_TOP_PICK_LIMIT = 8;

/**
 * Чем на самом деле был отказ на запись «Лучших позиций», после того как
 * прочитан машинный `code` конверта ошибки.
 *
 * Ради ОДНОГО случая: полка заполнена. На проводе это 422, и человеческий
 * текст у него общий английский («validation failed») — его нельзя показывать
 * управляющему, и он не объясняет единственное осмысленное действие: снять
 * другое блюдо. Сервер отделяет этот случай кодом `menu_top_picks_limit`
 * (domain.CodeMenuTopPicksLimit), и ветвиться нужно именно по коду.
 *
 * Слова живут в панели (@bookeat/i18n); этот модуль решает только, ЧТО
 * произошло, потому что это договор с бэкендом и он проверяется без DOM.
 */
export type MenuTopPickFailureKind =
  /** 422 `menu_top_picks_limit` — все 8 мест заняты. Ничего не записано;
   * следующее действие — снять одно из отмеченных блюд. */
  | "limit_reached"
  /** 422 без узкого кода: запрос отклонён (например, одно блюдо названо в
   * порядке дважды). Ничего не записано. */
  | "refused"
  /** 403 — аккаунт больше не управляет этим заведением. */
  | "forbidden"
  /** 401 — сессия закончилась. */
  | "unauthorized"
  /** 404 — блюда нет: удалено, или id принадлежит чужому заведению
   * (репозиторий фильтрует по restaurant_id, и это его защита арендатора). */
  | "not_found"
  /**
   * Всё остальное: 5xx, таймаут, нет сети, статус без ярлыка. Единственный
   * случай, когда мы НЕ знаем, применилась ли запись, — держим его отдельно,
   * чтобы ни один экран не сказал «ничего не изменилось».
   */
  | "unknown";

export interface MenuTopPickFailure {
  kind: MenuTopPickFailureKind;
  /**
   * Применилась ли запись. `false` — только когда так сказал СЕРВЕР;
   * `"unknown"` во всех остальных случаях: запрос, оборвавшийся по таймауту,
   * вполне мог закоммититься.
   */
  applied: false | "unknown";
  /** Правда, когда экран заведомо (или не заведомо НЕ) расходится с сервером,
   * и честный следующий шаг — перечитать список, а не повторить запись. */
  needsReload: boolean;
}

/**
 * Разбирает отказ. Принимает `unknown`, потому что стоит в `catch`.
 *
 * Узкий код важнее статуса: он навешен `domain.WithCode` на сервере и это
 * единственное на проводе, что отличает полную полку от любого другого 422.
 */
export function classifyMenuTopPickFailure(error: unknown): MenuTopPickFailure {
  const code = error instanceof RepositoryError ? error.code : undefined;
  const status = error instanceof RepositoryError ? error.status : undefined;

  if (code === "menu_top_picks_limit") {
    return { kind: "limit_reached", applied: false, needsReload: false };
  }

  switch (status) {
    case 401:
      return { kind: "unauthorized", applied: false, needsReload: false };
    case 403:
      return { kind: "forbidden", applied: false, needsReload: false };
    case 404:
      return { kind: "not_found", applied: false, needsReload: true };
    case 422:
      // ErrValidation возвращается до коммита, поэтому «ничего не изменилось»
      // здесь — факт, а не догадка.
      return { kind: "refused", applied: false, needsReload: false };
    default:
      return { kind: "unknown", applied: "unknown", needsReload: true };
  }
}

/**
 * Порядок, в котором элемент с позиции `from` переставлен на `to`.
 *
 * Выход за границы и перестановка на то же место возвращают ТОТ ЖЕ массив, так
 * что вызывающий может пропустить запрос целиком: карточка, отпущенная там же,
 * где её взяли, не должна ничего писать.
 *
 * Рядом живут такие же помощники у кухонь, городов и удобств: у каждой полки
 * своя ручка порядка и свой предел, и общий «переставь» ценой связывания
 * четырёх справочников одним типом стоил бы дороже, чем эти шесть строк.
 */
export function moveTopPick(order: readonly string[], from: number, to: number): readonly string[] {
  if (from === to) return order;
  if (from < 0 || from >= order.length) return order;
  if (to < 0 || to >= order.length) return order;
  const next = order.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Правда, когда `next` — это действительно перестановка `current`: тот же
 * состав, то же количество, каждый ровно один раз, но другой порядок.
 *
 * Панель проверяет это перед отправкой. Не вместо сервера — считает он, — а
 * чтобы перетаскивание, ничего не изменившее, не стоило запроса, и чтобы
 * потерянное блюдо всплыло здесь, а не превратилось в отказ, который
 * управляющему нечем объяснить.
 */
export function isTopPickReorder(current: readonly string[], next: readonly string[]): boolean {
  if (current.length !== next.length) return false;
  if (current.length === 0) return false;

  const seen = new Set<string>();
  for (const id of next) {
    if (seen.has(id)) return false;
    seen.add(id);
  }
  for (const id of current) {
    if (!seen.has(id)) return false;
  }
  return current.some((id, i) => id !== next[i]);
}

/**
 * Сколько мест на полке ещё свободно. Никогда не отрицательное: если сервер
 * когда-нибудь вернёт больше отметок, чем нынешний предел (предел подняли, а
 * панель не пересобрали), честнее показать «свободных нет», чем «-2».
 */
export function topPickSlotsLeft(marked: number): number {
  return Math.max(0, MENU_TOP_PICK_LIMIT - marked);
}
