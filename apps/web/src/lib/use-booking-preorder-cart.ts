"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Preorder } from "@bookeat/api/client";

import {
  addDraftLine,
  decrementDraftLine,
  draftQuantity,
  draftToPreorderInput,
  draftTotalMinor,
  incrementDraftLine,
  PREORDER_MAX_QTY,
  type PreorderDraft,
} from "@web/lib/preorder-draft";
import { usePreorder, useSetBookingPreorder } from "@web/lib/queries";

/**
 * Корзина режима `?booking=<id>` на странице меню — ТЗ
 * `web-preorder-menu-20260908`, C-WEB-1, критерий C3.
 *
 * ПАМЯТЬ СТРАНИЦЫ (React-состояние), А НЕ `sessionStorage`: правка ЧУЖОЙ (по
 * отношению к текущему черновику) брони не должна ни читать, ни портить
 * черновик заведения `bookeat.web.preorder-draft.<venueId>` — это два
 * независимых состояния гостя, и наоборот, уйдя со страницы, гость не должен
 * унести обрывок правки брони в свой следующий обычный набор блюд. Чистые
 * функции над `PreorderDraft` (`addDraftLine` и соседи) переиспользованы как
 * есть: они НЕ трогают хранилище сами по себе — этим занимаются только
 * `read/write/clearPreorderDraft`, сюда не подключённые.
 *
 * СЕЕТСЯ РОВНО ОДИН РАЗ на бронь: `seededFor` запоминает, для какого
 * `bookingId` корзина уже заполнена из ответа `GET /bookings/:id/preorder`;
 * смена `bookingId` (гость через историю браузера попал на правку другой
 * брони тем же смонтированным деревом) сбрасывает семя, а не тащит чужие
 * строки в новую бронь. Строки без `menuItemId` (ручная позиция кабинета) в
 * корзину НЕ ПОПАДАЮТ — их не с чем сверить со степпером, а полная замена
 * стёрла бы их в любом случае; в обычном потоке до этой страницы такая бронь
 * не доходит (кнопка на билете скрыта, `BookingResultScreen.tsx`, C2) — это
 * только защита от прямой ссылки.
 */
export function useBookingPreorderCart(bookingId: string) {
  const query = usePreorder(bookingId);
  const [cart, setCart] = useState<PreorderDraft>({ lines: [] });
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    if (seededFor.current === bookingId) return;
    if (!query.data) return;
    seededFor.current = bookingId;
    setCart(preorderToCart(query.data));
  }, [bookingId, query.data]);

  const add = useCallback((dish: { menuItemId: string; name: string; priceMinor: number }) => {
    setCart((current) => addDraftLine(current, dish));
  }, []);

  const increment = useCallback((menuItemId: string) => {
    setCart((current) => incrementDraftLine(current, menuItemId));
  }, []);

  const decrement = useCallback((menuItemId: string) => {
    setCart((current) => decrementDraftLine(current, menuItemId));
  }, []);

  const clear = useCallback(() => setCart({ lines: [] }), []);

  const save = useSetBookingPreorder(bookingId);

  return {
    /** `GET /bookings/:id/preorder` — источник семени и признак 404/401
     * (гость не владелец / не вошёл, C4 читает `query.error`). */
    query,
    /** Корзина уже заполнена из ответа сервера (а не пуста, потому что ответ
     * ещё в полёте). Полезно там, где «пусто» и «ещё не пришло» нельзя
     * путать — здесь не понадобилось напрямую, но дёшево отдать наружу. */
    seeded: seededFor.current === bookingId,
    cart,
    quantityOf: (menuItemId: string) => draftQuantity(cart, menuItemId),
    totalMinor: draftTotalMinor(cart),
    maxQty: PREORDER_MAX_QTY,
    add,
    increment,
    decrement,
    clear,
    /** C5: тело `PUT` — только `menu_item_id`+`quantity`, никакой цены и
     * названия с клиента. */
    save,
    saveInput: () => draftToPreorderInput(cart),
  };
}

/** `GET /bookings/:id/preorder` → `PreorderDraft` (C3): строки без
 * `menuItemId` отбрасываются (см. комментарий модуля). */
function preorderToCart(preorder: Preorder): PreorderDraft {
  return {
    lines: preorder.items
      .filter((item) => item.menuItemId !== null)
      .map((item) => ({
        menuItemId: item.menuItemId as string,
        name: item.name,
        priceMinor: item.priceMinor,
        quantity: item.quantity,
      })),
  };
}
