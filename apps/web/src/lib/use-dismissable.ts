"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Закрыть попап панели поиска (календарь, время, гости) по клику ВНЕ его
 * области или по Escape. Слушатели вешаются, только пока попап открыт —
 * закрытый попап не платит за них ничего.
 *
 * `mousedown`, а не `click`: клик, которым гость только что ОТКРЫЛ попап
 * (на триггере), всплывает до `document` уже после того, как React поставил
 * `open = true`, и `click`-слушатель закрыл бы попап в тот же момент, что
 * открыл. `mousedown` триггера случается ДО того, как React обработает
 * `onClick` и переключит состояние.
 */
export function useDismissable(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!open) return;

    function handlePointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onDismiss();
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, ref, onDismiss]);
}
