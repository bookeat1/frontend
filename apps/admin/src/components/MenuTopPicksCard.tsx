"use client";

import { useEffect, useState } from "react";
import {
  MENU_TOP_PICK_LIMIT,
  isTopPickReorder,
  moveTopPick,
  topPickSlotsLeft,
  type AdminMenuTopPick,
} from "@bookeat/api/admin";

import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { ImageThumb } from "./ui/ImageThumb";

const copy = t.admin.menu.topPicks;

/**
 * Полка «Лучшие позиции»: что заведение отметило, в каком порядке, и сколько
 * мест ещё свободно.
 *
 * Три решения, которые здесь намеренные:
 *
 *  1. Порядок — это НЕ флажок. Места 1..8 гость видит слева направо, поэтому
 *     полка показана отдельным пронумерованным списком, а не выводится из
 *     порядка меню.
 *
 *  2. Перетаскивание не единственный способ переставить. Мышь недоступна с
 *     клавиатуры и неудобна на телефоне, поэтому у каждой строки есть «Выше» и
 *     «Ниже», и они шлют РОВНО тот же запрос. Так же сделано в подборках гида.
 *
 *  3. Отправляется весь итоговый порядок целиком, один раз после перестановки.
 *     Ручка принимает результат, поэтому повтор безобиден; запрос на каждый
 *     обмен местами — это череда записей, которая может примениться наполовину.
 *
 * Пока запись в полёте, показан ОПТИМИСТИЧНЫЙ список: карточка, прыгнувшая
 * назад под рукой на полсекунды, хуже карточки, которая осталась там, куда её
 * положили, и один раз поправилась, если сервер отказал.
 */
export function MenuTopPicksCard({
  picks,
  onReorder,
  onRemove,
  reordering,
  removingId,
  disabled = false,
}: {
  /** Ответ GET /restaurants/:id/menu-top-picks — уже в порядке заведения. */
  picks: AdminMenuTopPick[];
  /** Вызывается с ИТОГОВЫМ порядком id блюд. */
  onReorder: (itemIds: string[]) => void;
  onRemove: (pick: AdminMenuTopPick) => void;
  reordering: boolean;
  /** id блюда, которое сейчас снимают, — чтобы погасить только его кнопку. */
  removingId: string | null;
  disabled?: boolean;
}) {
  const serverOrder = picks.map((p) => p.id);
  const [order, setOrder] = useState<readonly string[]>(serverOrder);
  const [dragging, setDragging] = useState<string | null>(null);

  // Пересобираем всякий раз, когда меняется СОСТАВ полки на сервере (блюдо
  // отметили, сняли, или отказ откатили перечитыванием). Сравниваем склеенные
  // id, а не ссылку на массив, иначе эффект срабатывал бы на каждый рендер.
  const serverKey = serverOrder.join(",");
  useEffect(() => {
    setOrder(serverKey ? serverKey.split(",") : []);
  }, [serverKey]);

  const used = picks.length;
  const byId = new Map(picks.map((p) => [p.id, p]));
  const rows = order.map((id) => byId.get(id)).filter((p): p is AdminMenuTopPick => !!p);

  function apply(next: readonly string[]) {
    // Блюдо, отпущенное там же, где его взяли, не стоит запроса.
    if (!isTopPickReorder(order, next)) return;
    setOrder(next);
    onReorder([...next]);
  }

  function move(from: number, to: number) {
    apply(moveTopPick(order, from, to));
  }

  return (
    <section className="flex flex-col gap-md rounded-card bg-surface p-lg">
      <header className="flex flex-wrap items-baseline justify-between gap-sm">
        <h2 className="text-sm font-semibold text-text">{copy.title}</h2>
        {/* Счётчик виден всегда: предел должен читаться до того, как в него
            упрутся, а не только в момент отказа. */}
        <span
          className={`whitespace-nowrap rounded-pill px-sm py-xxs text-[12px] font-medium ${
            topPickSlotsLeft(used) === 0
              ? "bg-rose-100 text-rose-700"
              : "bg-chip text-text-muted"
          }`}
        >
          {copy.counter(used, MENU_TOP_PICK_LIMIT)}
        </span>
      </header>
      <p className="text-[13px] text-text-muted">{copy.description}</p>

      {rows.length === 0 ? (
        <p className="text-[13px] text-text-muted">{copy.emptyDescription}</p>
      ) : (
        <>
          <p className="text-[13px] text-text-muted">{copy.dragHint}</p>
          {reordering ? (
            <p role="status" aria-live="polite" className="text-[13px] text-text-muted">
              {copy.orderSaving}
            </p>
          ) : null}

          {/* Подпись у списка — не украшение: на экране меню есть и другие
              списки, и с закрытыми глазами полка должна называть себя. */}
          <ol aria-label={copy.title} className="flex flex-col gap-sm">
            {rows.map((pick, index) => (
              <li
                key={pick.id}
                draggable={!disabled}
                onDragStart={() => setDragging(pick.id)}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!dragging) return;
                  const from = order.indexOf(dragging);
                  setDragging(null);
                  move(from, index);
                }}
                className={`flex flex-wrap items-center gap-md rounded-card bg-chip px-md py-sm ${
                  dragging === pick.id ? "opacity-60" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-white text-[12px] font-semibold text-text-muted"
                >
                  {index + 1}
                </span>
                <ImageThumb
                  url={pick.image_url}
                  alt={pick.name}
                  emptyLabel={t.admin.menu.noPhoto}
                  className="h-10 w-10"
                />
                <div className="min-w-[120px] flex-1">
                  <p className="break-words text-sm font-medium text-text">{pick.name}</p>
                  {/* Блюдо в стоп-листе держит своё место, но гостю его сейчас
                      не показывают. Сказать это вслух дешевле, чем потом
                      объяснять, почему отмеченного блюда нет в приложении. */}
                  {!pick.is_available ? (
                    <p className="mt-xxs break-words text-[12px] text-rose-700">
                      <span className="font-medium">{copy.stopped}</span> — {copy.stoppedHint}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-xs">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={disabled || index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label={`${copy.moveUp}: ${pick.name}`}
                  >
                    {copy.moveUp}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={disabled || index === rows.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label={`${copy.moveDown}: ${pick.name}`}
                  >
                    {copy.moveDown}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={disabled}
                    loading={removingId === pick.id}
                    onClick={() => onRemove(pick)}
                    aria-label={copy.removeAria(pick.name)}
                  >
                    {copy.remove}
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
