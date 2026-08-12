import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GuideCollectionVenue } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GuideVenueList } from "../GuideVenueList";

/**
 * REGRESSION GUARD — reordering a collection's venues.
 *
 * Two things this holds, both of which cost a real person real work:
 *
 *  1. ONE request per move, carrying the WHOLE intended final order. The server
 *     writes a whole new ordering in one transaction (the deferrable unique
 *     (collection_id, position) of migration 0061 is what makes that possible),
 *     and it refuses a payload that is not exactly the current membership. A
 *     panel that sent a swap per drag, or that sent a partial list, would turn a
 *     drag into a stream of writes that can half-apply — and a half-applied
 *     order is a curation nobody can reconstruct.
 *
 *  2. Reordering is reachable WITHOUT a drag. A drag is unreachable from the
 *     keyboard and awkward on a phone, and this panel is used on both. The
 *     up/down buttons must produce exactly the same request as a drag.
 *
 * Also guarded: a deactivated venue is visibly marked. It stays in the
 * collection and keeps its slot, but a guest cannot open it and it does not
 * count towards venue_count — an editor who cannot see that spends the
 * afternoon asking why the app shows seven of their eight venues.
 */

afterEach(cleanup);

function venue(id: string, name: string, position: number, isActive = true): GuideCollectionVenue {
  return {
    restaurant_id: id,
    position,
    note: "",
    name,
    address: "ул. Достык, 1",
    cuisine_type: "Европейская",
    city: "Астана",
    price_category: "средний",
    primary_image_url: null,
    is_active: isActive,
  };
}

const VENUES = [venue("a", "Первый", 1), venue("b", "Второй", 2), venue("c", "Третий", 3)];

function renderList(overrides: Partial<React.ComponentProps<typeof GuideVenueList>> = {}) {
  const onReorder = vi.fn();
  render(
    <GuideVenueList
      venues={VENUES}
      onReorder={onReorder}
      onRemove={vi.fn()}
      onEditNote={vi.fn()}
      reordering={false}
      {...overrides}
    />,
  );
  return { onReorder };
}

describe("порядок заведений в статье", () => {
  it("а кнопка «Ниже» отправляет ВЕСЬ итоговый порядок одним запросом", () => {
    const { onReorder } = renderList();

    fireEvent.click(screen.getByLabelText("Ниже: Первый"));

    expect(onReorder).toHaveBeenCalledTimes(1);
    // The whole sequence, not "swap a and b": one request that describes the
    // result completely and can be replayed without harm.
    expect(onReorder).toHaveBeenCalledWith(["b", "a", "c"]);
  });

  it("а кнопка «Выше» — тоже, и порядок содержит ровно те же заведения", () => {
    const { onReorder } = renderList();

    fireEvent.click(screen.getByLabelText("Выше: Третий"));

    expect(onReorder).toHaveBeenCalledTimes(1);
    const sent = onReorder.mock.calls[0][0] as string[];
    expect(sent).toEqual(["a", "c", "b"]);
    expect(new Set(sent).size).toBe(VENUES.length);
  });

  it("а два перемещения подряд отправляют два ПОЛНЫХ порядка, а не накопленный обмен", () => {
    const { onReorder } = renderList();

    fireEvent.click(screen.getByLabelText("Ниже: Первый"));
    // The list has re-rendered optimistically, so "Первый" is now second.
    fireEvent.click(screen.getByLabelText("Ниже: Первый"));

    expect(onReorder).toHaveBeenCalledTimes(2);
    expect(onReorder.mock.calls[0][0]).toEqual(["b", "a", "c"]);
    expect(onReorder.mock.calls[1][0]).toEqual(["b", "c", "a"]);
  });

  it("а карточка остаётся там, куда её переставили, пока идёт сохранение", () => {
    renderList();
    fireEvent.click(screen.getByLabelText("Ниже: Первый"));

    // A card that snapped back under the editor's hand and then moved again is
    // worse than one that stays put and is corrected once if the server refuses.
    const names = screen.getAllByText(/Первый|Второй|Третий/).map((el) => el.textContent);
    expect(names).toEqual(["Второй", "Первый", "Третий"]);
  });

  it("а первое заведение нельзя поднять, а последнее — опустить", () => {
    renderList();
    // jest-dom is not a declared dependency here (see TESTING.md), so the
    // property is read directly rather than through a matcher.
    expect((screen.getByLabelText("Выше: Первый") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Ниже: Третий") as HTMLButtonElement).disabled).toBe(true);
  });

  it("а пока идёт другая операция, порядок не трогают", () => {
    const { onReorder } = renderList({ disabled: true });
    expect((screen.getByLabelText("Ниже: Первый") as HTMLButtonElement).disabled).toBe(true);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("а отключённое заведение видно как отключённое, а не молча не считается", () => {
    render(
      <GuideVenueList
        venues={[venue("a", "Первый", 1), venue("b", "Закрытый", 2, false)]}
        onReorder={vi.fn()}
        onRemove={vi.fn()}
        onEditNote={vi.fn()}
        reordering={false}
      />,
    );
    expect(screen.getByText("Отключено — гость его не увидит")).toBeTruthy();
  });

  it("а пустая статья объясняет, что публиковать её нельзя", () => {
    render(
      <GuideVenueList
        venues={[]}
        onReorder={vi.fn()}
        onRemove={vi.fn()}
        onEditNote={vi.fn()}
        reordering={false}
      />,
    );
    expect(screen.getByText("В статье пока нет заведений")).toBeTruthy();
    expect(
      screen.getByText("Добавьте хотя бы одно — без этого статью нельзя опубликовать"),
    ).toBeTruthy();
  });
});
