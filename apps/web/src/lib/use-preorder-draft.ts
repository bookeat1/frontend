"use client";

import { useCallback, useEffect, useState } from "react";

import {
  addDraftLine,
  clearPreorderDraft,
  decrementDraftLine,
  draftQuantity,
  draftTotalMinor,
  incrementDraftLine,
  PREORDER_MAX_QTY,
  readPreorderDraft,
  writePreorderDraft,
  type PreorderDraft,
} from "@web/lib/preorder-draft";

/**
 * Черновик предзаказа в React-состоянии, синхронизированный с
 * `sessionStorage` — общий для карточки блюда (`/venues/[id]`) и сводки
 * бронирования (`/venues/[id]/book`), которые монтируются на РАЗНЫХ
 * страницах и не могут делить состояние иначе, чем через хранилище.
 *
 * Читается в `useEffect`, а не в начальном состоянии: `sessionStorage`
 * недоступен при серверном рендере (`booking-draft.ts`/`booking-form-draft.ts`
 * пользуются тем же приёмом), а начальное состояние компонента и разметка
 * первого клиентского рендера обязаны совпасть, иначе React пожалуется на
 * гидратацию.
 */
export function usePreorderDraft(venueId: string) {
  const [draft, setDraft] = useState<PreorderDraft>({ lines: [] });

  useEffect(() => {
    setDraft(readPreorderDraft(venueId));
  }, [venueId]);

  const persist = useCallback(
    (next: PreorderDraft) => {
      setDraft(next);
      writePreorderDraft(venueId, next);
    },
    [venueId],
  );

  const add = useCallback(
    (dish: { menuItemId: string; name: string; priceMinor: number }) => {
      persist(addDraftLine(draft, dish));
    },
    [draft, persist],
  );

  const increment = useCallback(
    (menuItemId: string) => {
      persist(incrementDraftLine(draft, menuItemId));
    },
    [draft, persist],
  );

  const decrement = useCallback(
    (menuItemId: string) => {
      persist(decrementDraftLine(draft, menuItemId));
    },
    [draft, persist],
  );

  const clear = useCallback(() => {
    setDraft({ lines: [] });
    clearPreorderDraft(venueId);
  }, [venueId]);

  return {
    draft,
    quantityOf: (menuItemId: string) => draftQuantity(draft, menuItemId),
    totalMinor: draftTotalMinor(draft),
    maxQty: PREORDER_MAX_QTY,
    add,
    increment,
    decrement,
    clear,
  };
}
