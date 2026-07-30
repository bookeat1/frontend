"use client";

import { useEffect, useState } from "react";
import type { GuideCollectionVenue } from "@bookeat/api/admin";

import { t } from "@/lib/i18n";
import { Button } from "../ui/Button";
import { EmptyState } from "../StateViews";
import { isReorderOf, moveInOrder } from "./reorder";

const copy = t.admin.gastroguide;

/**
 * The ordered venues of a collection, with drag-and-drop and keyboard-reachable
 * up/down buttons.
 *
 * Two things about the interaction are deliberate:
 *
 *  1. Dragging is NOT the only way to reorder. A drag is unreachable by
 *     keyboard and awkward on a phone, so every row also carries «Выше» /
 *     «Ниже» buttons, and they produce exactly the same request.
 *
 *  2. The whole final order is sent, once, after the move — never a per-swap
 *     call. The endpoint takes the intended final sequence, so one request
 *     describes the result completely and replaying it is harmless. Sending a
 *     swap per drag would be a stream of writes that can half-apply.
 *
 * The list shown while a save is in flight is the OPTIMISTIC one: a card that
 * snapped back for half a second under the editor's hand and then moved again
 * is worse than a card that stays where it was dropped and is corrected once if
 * the server refuses.
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
  const serverOrder = venues.map((v) => v.restaurant_id);
  const [order, setOrder] = useState<readonly string[]>(serverOrder);
  const [dragging, setDragging] = useState<string | null>(null);

  // Re-sync whenever the server's membership changes (a venue was attached or
  // detached, or a refused reorder was rolled back by a refetch). Comparing the
  // joined ids rather than the array identity keeps this from firing on every
  // render of an unchanged list.
  const serverKey = serverOrder.join(",");
  useEffect(() => {
    setOrder(serverKey ? serverKey.split(",") : []);
  }, [serverKey]);

  if (venues.length === 0) {
    return (
      <EmptyState title={copy.venuesEmpty} description={copy.venuesEmptyDescription} />
    );
  }

  const byId = new Map(venues.map((v) => [v.restaurant_id, v]));
  const rows = order.map((id) => byId.get(id)).filter((v): v is GuideCollectionVenue => !!v);

  function apply(next: readonly string[]) {
    // A drop back where it started, or anything that is not a genuine
    // reordering of the same members, costs no request at all.
    if (!isReorderOf(order, next)) return;
    setOrder(next);
    onReorder([...next]);
  }

  function move(from: number, to: number) {
    apply(moveInOrder(order, from, to));
  }

  return (
    <div className="flex flex-col gap-sm">
      <p className="text-[13px] text-text-muted">{copy.venueDragHint}</p>
      {reordering ? (
        <p role="status" aria-live="polite" className="text-[13px] text-text-muted">
          {copy.orderSaving}
        </p>
      ) : null}

      <ol className="flex flex-col gap-sm">
        {rows.map((v, index) => (
          <li
            key={v.restaurant_id}
            draggable={!disabled}
            onDragStart={() => setDragging(v.restaurant_id)}
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
              dragging === v.restaurant_id ? "opacity-60" : ""
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
                  <span className="break-words text-sm font-semibold text-text">{v.name}</span>
                  {/* A deactivated venue is still in the collection and still
                      curated — it is simply invisible to guests right now, and
                      the editor has to be able to see that without counting. */}
                  {!v.is_active ? (
                    <span className="whitespace-nowrap rounded-pill bg-rose-100 px-sm py-xxs text-[11px] font-medium text-rose-700">
                      {copy.venueInactive}
                    </span>
                  ) : null}
                </div>
                <p className="mt-xxs break-words text-[13px] text-text-muted">
                  {[v.city, v.address, v.cuisine_type].filter(Boolean).join(" · ")}
                </p>
                {v.note ? (
                  <p className="mt-xxs break-words text-[13px] text-text">{v.note}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-xs sm:justify-end">
              <Button
                size="sm"
                variant="secondary"
                disabled={disabled || index === 0}
                onClick={() => move(index, index - 1)}
                aria-label={`${copy.venueMoveUp}: ${v.name}`}
              >
                {copy.venueMoveUp}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={disabled || index === rows.length - 1}
                onClick={() => move(index, index + 1)}
                aria-label={`${copy.venueMoveDown}: ${v.name}`}
              >
                {copy.venueMoveDown}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={disabled}
                onClick={() => onEditNote(v)}
              >
                {copy.venueNote}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={disabled}
                onClick={() => onRemove(v)}
                aria-label={`${copy.venueRemove}: ${v.name}`}
              >
                {copy.venueRemove}
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
