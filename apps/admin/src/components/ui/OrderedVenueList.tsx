"use client";

import { useEffect, useState, type ReactNode } from "react";

import { isReorderOf, moveInOrder } from "../gastroguide/reorder";
import { Button } from "./Button";

/**
 * УПОРЯДОЧЕННЫЙ СПИСОК ЗАВЕДЕНИЙ — один на панель.
 *
 * Здесь живёт всё, что в таком списке можно сделать неправильно, и поэтому
 * оно ровно одно на два экрана: подборку гастрогида (`GuideVenueList`) и
 * ручной состав блока «Выбрали для вас» (`HomePicksView`). Обе ручки на
 * сервере устроены одинаково — принимают ВЕСЬ итоговый порядок, — и второй
 * такой список означал бы второй набор ошибок в перетаскивании.
 *
 * Три решения об интерфейсе, которые важнее вёрстки:
 *
 *  1. Перетаскивание — НЕ единственный способ. Мышью на телефоне не потянешь,
 *     а с клавиатуры до drag-and-drop не добраться вовсе, поэтому у каждой
 *     строки есть кнопки «Выше»/«Ниже», и они дают ровно тот же результат.
 *
 *  2. Наверх уходит ВЕСЬ итоговый порядок, один раз после перемещения, а не
 *     обмен парой на каждое движение. Один запрос описывает результат
 *     полностью, его безопасно повторить, и он не может примениться наполовину.
 *
 *  3. Пока сохранение в полёте, показывается ОПТИМИСТИЧНЫЙ порядок. Карточка,
 *     отпрыгнувшая назад под рукой редактора и переехавшая снова через
 *     полсекунды, хуже карточки, которая осталась на месте и один раз
 *     поправилась, если сервер отказал.
 *
 * Подписи приходят пропом `copy`, а не читаются из словаря внутри: у двух
 * экранов они разные («Убрать из статьи» и «Убрать из подборки»), и словарь,
 * зашитый в общий компонент, заставил бы их совпасть.
 */

/** Строка списка — ровно то, что список показывает и переставляет. */
export interface OrderedVenueRow {
  id: string;
  name: string;
  /** Вторая строка карточки: город · адрес · кухня. Собирает вызывающий. */
  meta: string;
  /** Третья строка, если она есть (подпись под карточкой у гастрогида). */
  note?: string;
  /**
   * Активно ли заведение в каталоге. `false` — оно остаётся в списке, но гость
   * его не видит, и это обязано быть видно глазом: редактор, который этого не
   * видит, полдня выясняет, почему в приложении заведений меньше.
   */
  isActive: boolean;
}

export interface OrderedVenueListCopy {
  dragHint: string;
  orderSaving: string;
  moveUp: string;
  moveDown: string;
  remove: string;
  inactive: string;
}

export function OrderedVenueList({
  rows,
  copy,
  onReorder,
  onRemove,
  reordering,
  disabled = false,
  empty,
  rowActions,
}: {
  rows: readonly OrderedVenueRow[];
  copy: OrderedVenueListCopy;
  /** Вызывается с ИТОГОВЫМ порядком id — целиком. */
  onReorder: (ids: string[]) => void;
  onRemove: (row: OrderedVenueRow) => void;
  reordering: boolean;
  disabled?: boolean;
  /** Что показать вместо списка, когда он пуст. */
  empty: ReactNode;
  /** Дополнительные кнопки строки (у гастрогида — «Подпись под карточкой»). */
  rowActions?: (row: OrderedVenueRow) => ReactNode;
}) {
  const serverOrder = rows.map((row) => row.id);
  const [order, setOrder] = useState<readonly string[]>(serverOrder);
  const [dragging, setDragging] = useState<string | null>(null);

  // Пересинхронизация, когда СОСТАВ на сервере изменился (заведение добавили,
  // убрали, или отказ в перестановке откатили перечитыванием). Сравниваем
  // склеенные id, а не ссылку на массив: иначе это срабатывало бы на каждый
  // рендер неизменившегося списка.
  const serverKey = serverOrder.join(",");
  useEffect(() => {
    setOrder(serverKey ? serverKey.split(",") : []);
  }, [serverKey]);

  if (rows.length === 0) return <>{empty}</>;

  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = order.map((id) => byId.get(id)).filter((row): row is OrderedVenueRow => !!row);

  function apply(next: readonly string[]) {
    // Возврат карточки туда же, откуда её взяли, — и вообще всё, что не
    // является настоящей перестановкой того же состава, — не стоит запроса.
    if (!isReorderOf(order, next)) return;
    setOrder(next);
    onReorder([...next]);
  }

  function move(from: number, to: number) {
    apply(moveInOrder(order, from, to));
  }

  return (
    <div className="flex flex-col gap-sm">
      <p className="text-[13px] text-text-muted">{copy.dragHint}</p>
      {reordering ? (
        <p role="status" aria-live="polite" className="text-[13px] text-text-muted">
          {copy.orderSaving}
        </p>
      ) : null}

      <ol className="flex flex-col gap-sm">
        {ordered.map((row, index) => (
          <li
            key={row.id}
            draggable={!disabled}
            onDragStart={() => setDragging(row.id)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!dragging) return;
              const from = order.indexOf(dragging);
              setDragging(null);
              move(from, index);
            }}
            className={`flex flex-col gap-md rounded-card bg-surface p-lg sm:flex-row sm:items-start sm:justify-between ${
              dragging === row.id ? "opacity-60" : ""
            }`}
          >
            <div className="flex min-w-0 gap-md">
              <span
                aria-hidden="true"
                className="mt-xxs inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-chip text-[12px] font-semibold text-text-muted"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-sm">
                  <span className="break-words text-sm font-semibold text-text">{row.name}</span>
                  {!row.isActive ? (
                    <span className="whitespace-nowrap rounded-pill bg-rose-100 px-sm py-xxs text-[11px] font-medium text-rose-700">
                      {copy.inactive}
                    </span>
                  ) : null}
                </div>
                <p className="mt-xxs break-words text-[13px] text-text-muted">{row.meta}</p>
                {row.note ? (
                  <p className="mt-xxs break-words text-[13px] text-text">{row.note}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-xs sm:justify-end">
              <Button
                size="sm"
                variant="secondary"
                disabled={disabled || index === 0}
                onClick={() => move(index, index - 1)}
                aria-label={`${copy.moveUp}: ${row.name}`}
              >
                {copy.moveUp}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={disabled || index === ordered.length - 1}
                onClick={() => move(index, index + 1)}
                aria-label={`${copy.moveDown}: ${row.name}`}
              >
                {copy.moveDown}
              </Button>
              {rowActions?.(row)}
              <Button
                size="sm"
                variant="danger"
                disabled={disabled}
                onClick={() => onRemove(row)}
                aria-label={`${copy.remove}: ${row.name}`}
              >
                {copy.remove}
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
