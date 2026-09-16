import { describe, expect, it } from "vitest";
import {
  EMPTY_FOODIE_INVITE_STATE,
  FOODIE_INVITE_DISMISS_LIMIT,
  FOODIE_INVITE_SNOOZE_KEY,
  FOODIE_INVITE_SNOOZE_MS,
  foodieInviteAllowed,
  parseFoodieInviteState,
  readFoodieInviteState,
  writeFoodieInviteDismiss,
  writeFoodieInviteHiddenForever,
  type FoodieInviteStorage,
} from "../foodie-invite-snooze";

/**
 * Карточка-приглашение «Расскажите, что любите» (персонализация v1,
 * сценарий 3.2, состояния 5.8, критерий 22) — счётчик закрытий, 30-дневный
 * снуз и необратимое «профиль перестал быть пустым», ровно как у
 * `update-snooze.test.ts`, тот же приём.
 */

function memory(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  let broken = false;
  const storage: FoodieInviteStorage = {
    async getItemAsync(key) {
      if (broken) throw new Error("storage is locked");
      return map.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      if (broken) throw new Error("storage is locked");
      map.set(key, value);
    },
  };
  return { storage, map, break: () => (broken = true) };
}

const NOW = Date.parse("2026-09-16T10:00:00Z");

describe("parseFoodieInviteState", () => {
  it("читает свою запись", () => {
    expect(
      parseFoodieInviteState(JSON.stringify({ dismissals: 2, snoozedUntil: null, hiddenForever: false })),
    ).toEqual({ dismissals: 2, snoozedUntil: null, hiddenForever: false });
  });

  it.each([
    ["пусто", null],
    ["не JSON", "{"],
    ["не объект", '"x"'],
    ["dismissals не число", JSON.stringify({ dismissals: "два", snoozedUntil: null, hiddenForever: false })],
    ["hiddenForever не булево", JSON.stringify({ dismissals: 0, snoozedUntil: null, hiddenForever: "да" })],
    ["snoozedUntil не число и не null", JSON.stringify({ dismissals: 0, snoozedUntil: "завтра", hiddenForever: false })],
  ])("%s — исходное состояние, а не падение", (_name, raw) => {
    expect(parseFoodieInviteState(raw)).toEqual(EMPTY_FOODIE_INVITE_STATE);
  });
});

describe("foodieInviteAllowed", () => {
  it("исходное состояние — показ разрешён", () => {
    expect(foodieInviteAllowed(EMPTY_FOODIE_INVITE_STATE, NOW)).toBe(true);
  });

  it("снуз действует до срока", () => {
    const state = { dismissals: 0, snoozedUntil: NOW + 1000, hiddenForever: false };
    expect(foodieInviteAllowed(state, NOW)).toBe(false);
    expect(foodieInviteAllowed(state, NOW + 1001)).toBe(true);
  });

  it("hiddenForever побеждает даже истёкший снуз", () => {
    const state = { dismissals: 0, snoozedUntil: NOW - 1, hiddenForever: true };
    expect(foodieInviteAllowed(state, NOW)).toBe(false);
  });
});

describe("writeFoodieInviteDismiss — счётчик и 30-дневный снуз", () => {
  it("первые два закрытия просто копят счётчик, снуза ещё нет", async () => {
    const { storage } = memory();
    const first = await writeFoodieInviteDismiss(EMPTY_FOODIE_INVITE_STATE, NOW, storage);
    expect(first).toEqual({ dismissals: 1, snoozedUntil: null, hiddenForever: false });

    const second = await writeFoodieInviteDismiss(first, NOW, storage);
    expect(second).toEqual({ dismissals: 2, snoozedUntil: null, hiddenForever: false });
    expect(foodieInviteAllowed(second, NOW)).toBe(true);
  });

  it(`ровно ${FOODIE_INVITE_DISMISS_LIMIT}-е закрытие подряд включает 30-дневный снуз и сбрасывает счётчик`, async () => {
    const { storage } = memory();
    let state = EMPTY_FOODIE_INVITE_STATE;
    for (let i = 0; i < FOODIE_INVITE_DISMISS_LIMIT; i += 1) {
      state = await writeFoodieInviteDismiss(state, NOW, storage);
    }
    expect(state).toEqual({ dismissals: 0, snoozedUntil: NOW + FOODIE_INVITE_SNOOZE_MS, hiddenForever: false });
    expect(foodieInviteAllowed(state, NOW)).toBe(false);
    expect(foodieInviteAllowed(state, NOW + FOODIE_INVITE_SNOOZE_MS + 1)).toBe(true);
  });

  it("запертое хранилище не роняет запись — отказ живёт хотя бы до конца сессии", async () => {
    const store = memory();
    store.break();
    await expect(writeFoodieInviteDismiss(EMPTY_FOODIE_INVITE_STATE, NOW, store.storage)).resolves.toEqual({
      dismissals: 1,
      snoozedUntil: null,
      hiddenForever: false,
    });
  });
});

describe("writeFoodieInviteHiddenForever", () => {
  it("профиль перестал быть пустым — приглашение гаснет НАВСЕГДА", async () => {
    const { storage, map } = memory();
    const state = await writeFoodieInviteHiddenForever(storage);
    expect(state).toEqual({ dismissals: 0, snoozedUntil: null, hiddenForever: true });
    expect(map.get(FOODIE_INVITE_SNOOZE_KEY)).toBe(JSON.stringify(state));
    await expect(readFoodieInviteState(storage)).resolves.toEqual(state);
  });

  it("побеждает даже свежий счётчик закрытий, записанный до этого", async () => {
    const { storage } = memory();
    const dismissed = await writeFoodieInviteDismiss(EMPTY_FOODIE_INVITE_STATE, NOW, storage);
    expect(foodieInviteAllowed(dismissed, NOW)).toBe(true);

    const hidden = await writeFoodieInviteHiddenForever(storage);
    expect(foodieInviteAllowed(hidden, NOW)).toBe(false);
    // Истёкший бы снуз тут не помог бы — hiddenForever не зависит от времени.
    expect(foodieInviteAllowed(hidden, NOW + FOODIE_INVITE_SNOOZE_MS * 10)).toBe(false);
  });
});

describe("readFoodieInviteState", () => {
  it("запертая связка ключей читается как исходное состояние", async () => {
    const store = memory({
      [FOODIE_INVITE_SNOOZE_KEY]: JSON.stringify({ dismissals: 1, snoozedUntil: null, hiddenForever: false }),
    });
    store.break();
    await expect(readFoodieInviteState(store.storage)).resolves.toEqual(EMPTY_FOODIE_INVITE_STATE);
  });
});
