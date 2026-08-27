import { describe, expect, it } from "vitest";

import { RepositoryError } from "../repository";
import {
  MENU_TOP_PICK_LIMIT,
  classifyMenuTopPickFailure,
  isTopPickReorder,
  moveTopPick,
  topPickSlotsLeft,
} from "../admin/menu-top-picks";

/**
 * Полка «Лучшие позиции» без DOM: предел, разбор отказа и перестановка.
 *
 * Главное здесь — 422 с кодом `menu_top_picks_limit`. На проводе он ничем не
 * отличается от любой другой проверки, кроме кода, и если ветвиться по статусу,
 * управляющий получит «сервер не принял изменение» там, где единственное
 * осмысленное действие — снять другое блюдо.
 */

function refusal(status: number, code?: string): RepositoryError {
  return new RepositoryError("validation failed", undefined, status, undefined, code);
}

describe("classifyMenuTopPickFailure", () => {
  it("422 с кодом menu_top_picks_limit — это заполненная полка, а не общая ошибка", () => {
    const failure = classifyMenuTopPickFailure(refusal(422, "menu_top_picks_limit"));

    expect(failure.kind).toBe("limit_reached");
    // Сервер сказал «не записал» — значит это факт, а не догадка.
    expect(failure.applied).toBe(false);
    expect(failure.needsReload).toBe(false);
  });

  it("код важнее статуса: тот же код с другим статусом всё равно про предел", () => {
    expect(classifyMenuTopPickFailure(refusal(409, "menu_top_picks_limit")).kind).toBe(
      "limit_reached",
    );
  });

  it("422 без узкого кода — обычный отказ, его нельзя выдавать за предел", () => {
    expect(classifyMenuTopPickFailure(refusal(422)).kind).toBe("refused");
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
  ] as const)("%s → %s", (status, kind) => {
    expect(classifyMenuTopPickFailure(refusal(status)).kind).toBe(kind);
  });

  it("5xx и оборванная сеть — единственный случай, когда мы НЕ знаем результат", () => {
    expect(classifyMenuTopPickFailure(refusal(500)).applied).toBe("unknown");
    expect(classifyMenuTopPickFailure(new Error("network")).kind).toBe("unknown");
    expect(classifyMenuTopPickFailure(new Error("network")).applied).toBe("unknown");
  });
});

describe("предел полки", () => {
  it("совпадает с domain.MenuTopPickLimit", () => {
    expect(MENU_TOP_PICK_LIMIT).toBe(8);
  });

  it("свободных мест не бывает меньше нуля", () => {
    expect(topPickSlotsLeft(0)).toBe(8);
    expect(topPickSlotsLeft(8)).toBe(0);
    // Сервер вернул больше отметок, чем знает эта сборка панели.
    expect(topPickSlotsLeft(10)).toBe(0);
  });
});

describe("moveTopPick", () => {
  it("переставляет блюдо на новое место, сохраняя остальных", () => {
    expect(moveTopPick(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("перестановка на то же место возвращает ТОТ ЖЕ массив — запрос не нужен", () => {
    const order = ["a", "b", "c"];
    expect(moveTopPick(order, 1, 1)).toBe(order);
  });

  it("выход за границы ничего не портит", () => {
    const order = ["a", "b"];
    expect(moveTopPick(order, -1, 0)).toBe(order);
    expect(moveTopPick(order, 0, 5)).toBe(order);
  });
});

describe("isTopPickReorder", () => {
  it("тот же состав в другом порядке — да", () => {
    expect(isTopPickReorder(["a", "b"], ["b", "a"])).toBe(true);
  });

  it("тот же порядок — нет, и запроса не будет", () => {
    expect(isTopPickReorder(["a", "b"], ["a", "b"])).toBe(false);
  });

  it("потерянное, лишнее или задвоенное блюдо — нет", () => {
    expect(isTopPickReorder(["a", "b"], ["a"])).toBe(false);
    expect(isTopPickReorder(["a", "b"], ["a", "c"])).toBe(false);
    expect(isTopPickReorder(["a", "b"], ["a", "a"])).toBe(false);
  });
});
