import { describe, expect, it } from "vitest";

import { isReorderOf, moveInOrder } from "../reorder";

/**
 * REGRESSION GUARD — the payload a drag produces must describe exactly the
 * collection's current venues, in the new sequence.
 *
 * PUT /admin/gastroguide/collections/:id/venues/order takes the intended FINAL
 * order and refuses anything that is not exactly the current membership with 422
 * guide_order_mismatch, writing nothing. That refusal is the correct server
 * behaviour — it is what stops a stale screen from silently rewriting somebody's
 * curation — but it means a bug on THIS side (an id dropped by a splice, an id
 * duplicated by a bad index, a no-op drag sent anyway) does not show up as a
 * slightly wrong order. It shows up as an editor dragging a card, seeing it
 * bounce back, and being told the collection changed underneath them when it did
 * not.
 *
 * So: the move is an array operation and is tested as one, without a DOM.
 */

const A = "a";
const B = "b";
const C = "c";
const D = "d";

describe("moveInOrder", () => {
  it("а перетаскивание вниз ставит карточку именно туда, куда её отпустили", () => {
    expect(moveInOrder([A, B, C, D], 0, 2)).toEqual([B, C, A, D]);
  });

  it("а перетаскивание вверх — тоже", () => {
    expect(moveInOrder([A, B, C, D], 3, 1)).toEqual([A, D, B, C]);
  });

  it("а соседний обмен местами не теряет и не задваивает ни одного заведения", () => {
    const result = moveInOrder([A, B, C], 1, 0);
    expect(result).toEqual([B, A, C]);
    expect(new Set(result).size).toBe(3);
  });

  it("а разворот всего списка проходит по одному шагу и остаётся полным", () => {
    let order: readonly string[] = [A, B, C, D];
    order = moveInOrder(order, 3, 0);
    order = moveInOrder(order, 3, 1);
    order = moveInOrder(order, 3, 2);
    expect(order).toEqual([D, C, B, A]);
  });

  it("а возврат карточки на то же место не создаёт нового списка — значит и запроса не будет", () => {
    const order = [A, B, C];
    // Same reference, not merely equal: the caller skips the request on this.
    expect(moveInOrder(order, 1, 1)).toBe(order);
  });

  it("а индекс за пределами списка ничего не ломает и ничего не меняет", () => {
    const order = [A, B, C];
    expect(moveInOrder(order, -1, 1)).toBe(order);
    expect(moveInOrder(order, 5, 1)).toBe(order);
    expect(moveInOrder(order, 0, 9)).toBe(order);
    expect(moveInOrder([], 0, 0)).toEqual([]);
  });
});

describe("isReorderOf", () => {
  it("а настоящая перестановка тех же заведений отправляется", () => {
    expect(isReorderOf([A, B, C], [C, A, B])).toBe(true);
  });

  it("а тот же порядок не отправляется вовсе", () => {
    expect(isReorderOf([A, B, C], [A, B, C])).toBe(false);
  });

  it("а потерянное заведение НЕ уходит на сервер — иначе редактор получит отказ вместо порядка", () => {
    expect(isReorderOf([A, B, C], [A, B])).toBe(false);
  });

  it("а задвоенное заведение НЕ уходит на сервер", () => {
    expect(isReorderOf([A, B, C], [A, A, B])).toBe(false);
  });

  it("а чужое заведение в списке НЕ уходит на сервер", () => {
    expect(isReorderOf([A, B, C], [A, B, D])).toBe(false);
  });

  it("а пустой список не считается перестановкой", () => {
    expect(isReorderOf([], [])).toBe(false);
  });
});
