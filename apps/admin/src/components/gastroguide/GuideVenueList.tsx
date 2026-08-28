"use client";

import type { GuideCollectionVenue } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";
import { Button } from "../ui/Button";
import { OrderedVenueList, type OrderedVenueRow } from "../ui/OrderedVenueList";
import { EmptyState } from "../StateViews";

const copy = t.admin.gastroguide;

/**
 * Заведения подборки гастрогида в заданном порядке.
 *
 * Вся механика перестановки (перетаскивание, кнопки «Выше»/«Ниже», отправка
 * ВСЕГО итогового порядка одним запросом, оптимистичный порядок на время
 * сохранения) живёт в общем `OrderedVenueList` — тот же список показывает
 * ручной состав блока «Выбрали для вас». Здесь остаётся только то, что у
 * гастрогида своё: подписи, подпись под карточкой и кнопка её правки.
 */
export function GuideVenueList({
  venues,
  onReorder,
  onRemove,
  onEditNote,
  reordering,
  disabled = false,
}: {
  venues: GuideCollectionVenue[];
  /** Called with the intended FINAL order of restaurant ids. */
  onReorder: (restaurantIds: string[]) => void;
  onRemove: (venue: GuideCollectionVenue) => void;
  onEditNote: (venue: GuideCollectionVenue) => void;
  reordering: boolean;
  disabled?: boolean;
}) {
  const byId = new Map(venues.map((v) => [v.restaurant_id, v]));
  const rows: OrderedVenueRow[] = venues.map((v) => ({
    id: v.restaurant_id,
    name: v.name,
    meta: [v.city, v.address, v.cuisine_type].filter(Boolean).join(" · "),
    note: v.note,
    isActive: v.is_active,
  }));

  return (
    <OrderedVenueList
      rows={rows}
      reordering={reordering}
      disabled={disabled}
      copy={{
        dragHint: copy.venueDragHint,
        orderSaving: copy.orderSaving,
        moveUp: copy.venueMoveUp,
        moveDown: copy.venueMoveDown,
        remove: copy.venueRemove,
        inactive: copy.venueInactive,
      }}
      empty={
        <EmptyState title={copy.venuesEmpty} description={copy.venuesEmptyDescription} />
      }
      onReorder={onReorder}
      onRemove={(row) => {
        const venue = byId.get(row.id);
        if (venue) onRemove(venue);
      }}
      rowActions={(row) => {
        const venue = byId.get(row.id);
        if (!venue) return null;
        return (
          <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onEditNote(venue)}>
            {copy.venueNote}
          </Button>
        );
      }}
    />
  );
}
