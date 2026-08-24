import type { Preorder, PreorderLineInput } from "@bookeat/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRepository } from "./repository";

/**
 * Корзина предзаказа для СУЩЕСТВУЮЩЕЙ брони.
 *
 * До сих пор блюда выбирались только внутри оформления брони: корзина жила в
 * черновике и прикреплялась к брони сразу после её создания. Владелец попросил
 * (2026-08-24) разрешить и обратный порядок — сначала бронь, потом блюда.
 *
 * Сервер это УЖЕ умеет: `PUT /bookings/:id/preorder` заменяет состав целиком,
 * и он же пересчитывает цены по меню заведения. Поэтому здесь нет ни новой
 * ручки, ни второго источника правды: экран держит состав локально, а при
 * сохранении отправляет его одним запросом.
 *
 * ЗАМЕНА, А НЕ ДОБАВЛЕНИЕ. Ручка заменяет весь состав, поэтому корзина
 * инициализируется тем, что уже прикреплено к брони. Иначе гость, добавивший
 * одно блюдо, стёр бы все предыдущие.
 */
export interface PreorderCartLine {
  menuItemId: string;
  name: string;
  /** Цена может отсутствовать: у части блюд её не заполнили. Тип совпадает с
   * черновиком брони, потому что оба состава рисует один и тот же экран. */
  priceMinor: number | null;
  quantity: number;
}

export function usePreorderCart(bookingId: string | undefined) {
  const repository = useRepository();
  const queryClient = useQueryClient();

  const existing = useQuery<Preorder>({
    queryKey: ["preorder", bookingId],
    queryFn: () => {
      if (!bookingId) throw new Error("bookingId is required");
      return repository.getPreorder(bookingId);
    },
    enabled: Boolean(bookingId),
    staleTime: 60_000,
  });

  const [lines, setLines] = useState<PreorderCartLine[]>([]);
  // Загруженный состав кладём в корзину ОДИН раз: дальше правит человек, и
  // повторная запись затирала бы его выбор при каждом фоновом обновлении.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !existing.data) return;
    setLines(
      existing.data.items
        // Строка без идентификатора блюда — это позиция, которую завели
        // вручную в кабинете; отредактировать её из приложения нельзя, и
        // отправить обратно тоже: ручка принимает только menu_item_id.
        .filter((item): item is typeof item & { menuItemId: string } => Boolean(item.menuItemId))
        .map((item) => ({
          menuItemId: item.menuItemId,
          name: item.name,
          priceMinor: item.priceMinor,
          quantity: item.quantity,
        })),
    );
    setSeeded(true);
  }, [existing.data, seeded]);

  const setQuantity = useCallback(
    (line: Omit<PreorderCartLine, "quantity">, quantity: number) => {
      setLines((prev) => {
        const rest = prev.filter((l) => l.menuItemId !== line.menuItemId);
        return quantity > 0 ? [...rest, { ...line, quantity }] : rest;
      });
    },
    [],
  );

  const clear = useCallback(() => setLines([]), []);

  const save = useMutation({
    mutationFn: () => {
      if (!bookingId) throw new Error("bookingId is required");
      const payload: PreorderLineInput[] = lines.map((l) => ({
        menuItemId: l.menuItemId,
        quantity: l.quantity,
      }));
      return repository.setPreorder(bookingId, payload);
    },
    onSuccess: (preorder) => {
      // Экран брони читает тот же ключ — обновляем его же, чтобы список блюд
      // не мигал старым составом после возврата назад.
      queryClient.setQueryData(["preorder", bookingId], preorder);
      void queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
    },
  });

  const quantities = useMemo(
    () => new Map(lines.map((l) => [l.menuItemId, l.quantity])),
    [lines],
  );

  return {
    lines,
    quantities,
    setQuantity,
    clear,
    save,
    isLoading: existing.isPending,
    isError: existing.isError,
  };
}
