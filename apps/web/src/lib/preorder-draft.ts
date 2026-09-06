import type { PreorderLineInput } from "@bookeat/api/client";

/**
 * Черновик предзаказа гостя, по заведению — `venue-menu-stepper-promo-card`
 * (2026-09-06), задача A-WEB-1.
 *
 * ТА ЖЕ МОДЕЛЬ, ЧТО `booking-draft.ts`: `sessionStorage`, ключ содержит
 * `venueId`, чтение проверяет всё (хранилище — это ввод, а не доверенная
 * память). Отдельный модуль, а не поле `BookingDraft`: предзаказ живёт с
 * гостем начиная со страницы заведения, до брони, а `BookingDraft` появляется
 * только на странице бронирования.
 *
 * ЦЕНА В ЧЕРНОВИКЕ — ТОЛЬКО ДЛЯ ОЦЕНКИ «Итого ≈» НА КЛИЕНТЕ. На сервер она не
 * уезжает: `PUT /bookings/:id/preorder` принимает только `menu_item_id` и
 * `quantity`, цену считает сервер по своему меню (см. `PreorderLineInput`).
 */

export interface PreorderDraftLine {
  menuItemId: string;
  name: string;
  priceMinor: number;
  /** 1..PREORDER_MAX_QTY. Ноль в черновике не существует — строка с нулём
   * удаляется, а не хранится (A4). */
  quantity: number;
}

export interface PreorderDraft {
  lines: PreorderDraftLine[];
}

/** Потолок одной строки (сервер принимает 100, но 20 уже больше MAX_GUESTS —
 * дальше это звонок заведению, а не кнопка на сайте). */
export const PREORDER_MAX_QTY = 20;
/** Потолок числа строк в черновике (сервер принимает 100). */
export const PREORDER_MAX_LINES = 50;

const PREFIX = "bookeat.web.preorder-draft.";

const EMPTY: PreorderDraft = { lines: [] };

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    // Safari в приватном режиме БРОСАЕТ на обращении, а не отдаёт null.
    return null;
  }
}

function key(venueId: string): string {
  return `${PREFIX}${venueId}`;
}

function isValidLine(value: unknown): value is PreorderDraftLine {
  if (typeof value !== "object" || value === null) return false;
  const { menuItemId, name, priceMinor, quantity } = value as Record<string, unknown>;
  if (typeof menuItemId !== "string" || menuItemId.length === 0) return false;
  if (typeof name !== "string") return false;
  if (typeof priceMinor !== "number" || !Number.isFinite(priceMinor) || priceMinor < 0) return false;
  if (typeof quantity !== "number" || !Number.isInteger(quantity)) return false;
  if (quantity < 1 || quantity > PREORDER_MAX_QTY) return false;
  return true;
}

/**
 * Черновик для заведения, если он есть и валиден целиком.
 *
 * ВСЁ ИЛИ НИЧЕГО (A6): не-JSON, отсутствие `menuItemId`-строки, `quantity`
 * вне 1..20 у ЛЮБОЙ строки или строк больше 50 — пустой черновик, а не
 * частично очищенный. Частичная очистка молча теряла бы соседние строки при
 * каждой правке формата и прятала бы порчу хранилища от разработчика.
 */
export function readPreorderDraft(venueId: string): PreorderDraft {
  const raw = storage()?.getItem(key(venueId));
  if (!raw) return EMPTY;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  if (typeof parsed !== "object" || parsed === null) return EMPTY;

  const { lines } = parsed as Record<string, unknown>;
  if (!Array.isArray(lines)) return EMPTY;
  if (lines.length === 0) return EMPTY;
  if (lines.length > PREORDER_MAX_LINES) return EMPTY;
  if (!lines.every(isValidLine)) return EMPTY;

  return { lines: lines as PreorderDraftLine[] };
}

export function writePreorderDraft(venueId: string, draft: PreorderDraft): void {
  try {
    if (draft.lines.length === 0) {
      storage()?.removeItem(key(venueId));
      return;
    }
    storage()?.setItem(key(venueId), JSON.stringify(draft));
  } catch {
    // Квота или запрет хранилища: карточка работает и без черновика.
  }
}

export function clearPreorderDraft(venueId: string): void {
  try {
    storage()?.removeItem(key(venueId));
  } catch {
    // См. выше.
  }
}

/** Количество строки блюда в черновике, или 0 — строки нет. */
export function draftQuantity(draft: PreorderDraft, menuItemId: string): number {
  return draft.lines.find((line) => line.menuItemId === menuItemId)?.quantity ?? 0;
}

/** Сумма черновика — ТОЛЬКО оценка для «Итого ≈», не отправляется на сервер. */
export function draftTotalMinor(draft: PreorderDraft): number {
  return draft.lines.reduce((sum, line) => sum + line.priceMinor * line.quantity, 0);
}

/**
 * Черновик → тело `PUT /bookings/:id/preorder` (A9): только `menu_item_id` и
 * `quantity`. Ни цена, ни название на сервер не уезжают — цену считает
 * сервер по своему меню, имя ему и так известно по `menu_item_id`.
 */
export function draftToPreorderInput(draft: PreorderDraft): PreorderLineInput[] {
  return draft.lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity }));
}

/**
 * «+» на карточке без строки: кладёт строку с `quantity: 1` (A2). Если строк
 * уже 50 (потолок черновика) и этого блюда среди них нет — новая строка не
 * добавляется, черновик остаётся прежним: это тот же звонок заведению, что и
 * потолок 20 на одной строке.
 */
export function addDraftLine(
  draft: PreorderDraft,
  dish: { menuItemId: string; name: string; priceMinor: number },
): PreorderDraft {
  if (draft.lines.some((line) => line.menuItemId === dish.menuItemId)) return draft;
  if (draft.lines.length >= PREORDER_MAX_LINES) return draft;
  return { lines: [...draft.lines, { ...dish, quantity: 1 }] };
}

/** «+» на существующей строке: +1 до PREORDER_MAX_QTY включительно (A3). */
export function incrementDraftLine(draft: PreorderDraft, menuItemId: string): PreorderDraft {
  return {
    lines: draft.lines.map((line) =>
      line.menuItemId === menuItemId
        ? { ...line, quantity: Math.min(PREORDER_MAX_QTY, line.quantity + 1) }
        : line,
    ),
  };
}

/** «−»: −1, а при единице строка исчезает целиком (A4). */
export function decrementDraftLine(draft: PreorderDraft, menuItemId: string): PreorderDraft {
  const line = draft.lines.find((item) => item.menuItemId === menuItemId);
  if (!line) return draft;
  if (line.quantity <= 1) {
    return { lines: draft.lines.filter((item) => item.menuItemId !== menuItemId) };
  }
  return {
    lines: draft.lines.map((item) =>
      item.menuItemId === menuItemId ? { ...item, quantity: item.quantity - 1 } : item,
    ),
  };
}
