import { beforeEach, describe, expect, it } from "vitest";

import {
  addDraftLine,
  clearPreorderDraft,
  decrementDraftLine,
  draftQuantity,
  draftTotalMinor,
  incrementDraftLine,
  PREORDER_MAX_LINES,
  PREORDER_MAX_QTY,
  readPreorderDraft,
  writePreorderDraft,
  type PreorderDraft,
} from "@web/lib/preorder-draft";

/**
 * Черновик предзаказа — A5, A6: хранится в `sessionStorage` по заведению и
 * отбрасывает невалидные данные целиком, без исключений.
 */

const VENUE = "venue-1";
const DISH = { menuItemId: "dish-1", name: "Стейк рибай", priceMinor: 899000 };

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("readPreorderDraft — A6, всё или ничего", () => {
  it("хранилища нет — пустой черновик", () => {
    expect(readPreorderDraft(VENUE)).toEqual({ lines: [] });
  });

  it("не-JSON — пустой черновик, без исключения", () => {
    window.sessionStorage.setItem(`bookeat.web.preorder-draft.${VENUE}`, "не json{");
    expect(readPreorderDraft(VENUE)).toEqual({ lines: [] });
  });

  it("строка без menuItemId — пустой черновик", () => {
    window.sessionStorage.setItem(
      `bookeat.web.preorder-draft.${VENUE}`,
      JSON.stringify({ lines: [{ name: "Стейк", priceMinor: 1000, quantity: 1 }] }),
    );
    expect(readPreorderDraft(VENUE)).toEqual({ lines: [] });
  });

  it("quantity вне 1..20 — пустой черновик", () => {
    window.sessionStorage.setItem(
      `bookeat.web.preorder-draft.${VENUE}`,
      JSON.stringify({ lines: [{ ...DISH, quantity: 0 }] }),
    );
    expect(readPreorderDraft(VENUE)).toEqual({ lines: [] });

    window.sessionStorage.setItem(
      `bookeat.web.preorder-draft.${VENUE}`,
      JSON.stringify({ lines: [{ ...DISH, quantity: 21 }] }),
    );
    expect(readPreorderDraft(VENUE)).toEqual({ lines: [] });
  });

  it("больше 50 строк — пустой черновик", () => {
    const lines = Array.from({ length: PREORDER_MAX_LINES + 1 }, (_, i) => ({
      menuItemId: `dish-${i}`,
      name: `Блюдо ${i}`,
      priceMinor: 1000,
      quantity: 1,
    }));
    window.sessionStorage.setItem(`bookeat.web.preorder-draft.${VENUE}`, JSON.stringify({ lines }));
    expect(readPreorderDraft(VENUE)).toEqual({ lines: [] });
  });

  it("валидный черновик читается как есть и не виден у другого заведения", () => {
    const draft: PreorderDraft = { lines: [{ ...DISH, quantity: 3 }] };
    writePreorderDraft(VENUE, draft);
    expect(readPreorderDraft(VENUE)).toEqual(draft);
    expect(readPreorderDraft("venue-2")).toEqual({ lines: [] });
  });
});

describe("переходы количества — A2-A4", () => {
  it("первый «+» кладёт строку с quantity: 1", () => {
    const draft = addDraftLine({ lines: [] }, DISH);
    expect(draftQuantity(draft, DISH.menuItemId)).toBe(1);
  });

  it("«+» растёт до потолка 20 и дальше не двигается", () => {
    let draft: PreorderDraft = { lines: [{ ...DISH, quantity: PREORDER_MAX_QTY }] };
    draft = incrementDraftLine(draft, DISH.menuItemId);
    expect(draftQuantity(draft, DISH.menuItemId)).toBe(PREORDER_MAX_QTY);
  });

  it("«−» на 1 удаляет строку, а не хранит quantity: 0", () => {
    const draft: PreorderDraft = { lines: [{ ...DISH, quantity: 1 }] };
    const next = decrementDraftLine(draft, DISH.menuItemId);
    expect(next.lines).toEqual([]);
    expect(draftQuantity(next, DISH.menuItemId)).toBe(0);
  });

  it("«−» на >1 уменьшает на единицу", () => {
    const draft: PreorderDraft = { lines: [{ ...DISH, quantity: 3 }] };
    expect(draftQuantity(decrementDraftLine(draft, DISH.menuItemId), DISH.menuItemId)).toBe(2);
  });
});

describe("draftTotalMinor — оценка «Итого ≈», не отправляется на сервер", () => {
  it("сумма строк priceMinor × quantity", () => {
    const draft: PreorderDraft = {
      lines: [
        { menuItemId: "d1", name: "А", priceMinor: 1000, quantity: 2 },
        { menuItemId: "d2", name: "Б", priceMinor: 500, quantity: 3 },
      ],
    };
    expect(draftTotalMinor(draft)).toBe(1000 * 2 + 500 * 3);
  });
});

describe("clearPreorderDraft", () => {
  it("удаляет хранилище заведения", () => {
    writePreorderDraft(VENUE, { lines: [{ ...DISH, quantity: 1 }] });
    clearPreorderDraft(VENUE);
    expect(readPreorderDraft(VENUE)).toEqual({ lines: [] });
  });
});
