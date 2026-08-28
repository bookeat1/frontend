"use client";

import type { GuideRoutePoint } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";
import { Button } from "../ui/Button";
import { OrderedVenueList, type OrderedVenueRow } from "../ui/OrderedVenueList";
import { EmptyState } from "../StateViews";

const copy = t.admin.gastroRoutes;

/**
 * Остановки гастропрогулки в порядке прохождения.
 *
 * Вся механика перестановки — общая: тот же `OrderedVenueList`, что у подборки
 * гастрогида и у блока «Выбрали для вас». Ручка на сервере устроена так же
 * (принимает ВЕСЬ итоговый порядок и отвергает несовпавший состав), поэтому и
 * список тот же — второй означал бы второй набор ошибок в перетаскивании.
 *
 * Одно отличие от подборки, и оно в смысле, а не в вёрстке: строка списка —
 * это ОСТАНОВКА, а не заведение. Переставляются `point.id`, а не
 * `restaurant_id`, и остановка может быть вовсе без заведения («место»).
 * Поэтому `isActive` здесь — «остановка покажет карточку заведения»: у места
 * показывать нечего по замыслу, и плашка «отключено» ему не ставится.
 */
export function GuideRoutePointList({
  points,
  onReorder,
  onRemove,
  onEdit,
  reordering,
  disabled = false,
}: {
  points: GuideRoutePoint[];
  /** Вызывается с ИТОГОВЫМ порядком id остановок. */
  onReorder: (pointIds: string[]) => void;
  onRemove: (point: GuideRoutePoint) => void;
  onEdit: (point: GuideRoutePoint) => void;
  reordering: boolean;
  disabled?: boolean;
}) {
  const byId = new Map(points.map((p) => [p.id, p]));
  const rows: OrderedVenueRow[] = points.map((p) => ({
    id: p.id,
    name: p.title,
    meta: [
      p.kind === "place" ? copy.pointKindPlace : copy.pointKindVenue,
      p.venue?.name,
      p.address,
    ]
      .filter(Boolean)
      .join(" · "),
    note: p.description || undefined,
    // Плашку «отключено» имеет смысл ставить только остановке-заведению:
    // у места заведения нет, и краснеть ему не за что.
    isActive: p.kind === "place" ? true : !!p.venue?.is_active,
  }));

  return (
    <OrderedVenueList
      rows={rows}
      reordering={reordering}
      disabled={disabled}
      copy={{
        dragHint: copy.pointDragHint,
        orderSaving: copy.orderSaving,
        moveUp: copy.pointMoveUp,
        moveDown: copy.pointMoveDown,
        remove: copy.pointRemove,
        inactive: copy.pointVenueInactive,
      }}
      empty={<EmptyState title={copy.pointsEmpty} description={copy.pointsEmptyDescription} />}
      onReorder={onReorder}
      onRemove={(row) => {
        const point = byId.get(row.id);
        if (point) onRemove(point);
      }}
      rowActions={(row) => {
        const point = byId.get(row.id);
        if (!point) return null;
        return (
          <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onEdit(point)}>
            {copy.pointEdit}
          </Button>
        );
      }}
    />
  );
}
