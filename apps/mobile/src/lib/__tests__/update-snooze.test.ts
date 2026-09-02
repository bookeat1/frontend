import { describe, expect, it } from "vitest";
import {
  UPDATE_SNOOZE_KEY,
  UPDATE_SNOOZE_MS,
  parseSnooze,
  readUpdateSnooze,
  snoozeActive,
  writeUpdateSnooze,
  type SnoozeStorage,
} from "../update-snooze";

/**
 * «Позже», пережившее перезапуск, — единственная часть окна обновления,
 * которая умеет ОШИБАТЬСЯ В ОБЕ СТОРОНЫ, поэтому её правила закреплены
 * отдельно от хука:
 *
 *   • мусор в хранилище читается как «отказа нет» — лишнее окно дешевле
 *     навсегда и молча спрятанной просьбы обновиться;
 *   • отказ привязан к версии сборки: гость обновился — отказ протух;
 *   • отказ не вечен, у него есть срок;
 *   • недоступное хранилище не роняет ни чтение, ни запись.
 */

/** Хранилище в памяти + переключатель «а теперь оно сломано». */
function memory(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  let broken = false;
  const storage: SnoozeStorage = {
    async getItemAsync(key) {
      if (broken) throw new Error("keychain is locked");
      return map.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      if (broken) throw new Error("keychain is locked");
      map.set(key, value);
    },
  };
  return { storage, map, break: () => (broken = true) };
}

const NOW = Date.parse("2026-09-02T10:00:00Z");

describe("parseSnooze", () => {
  it("читает свою запись", () => {
    expect(parseSnooze(JSON.stringify({ version: "1.5.1", until: NOW }))).toEqual({
      version: "1.5.1",
      until: NOW,
    });
  });

  it.each([
    ["пусто", null],
    ["не JSON", "{"],
    ["не объект", '"1.5.1"'],
    ["без версии", JSON.stringify({ until: NOW })],
    ["пустая версия", JSON.stringify({ version: "", until: NOW })],
    ["срок строкой", JSON.stringify({ version: "1.5.1", until: "завтра" })],
    ["срок не число", JSON.stringify({ version: "1.5.1", until: Number.NaN })],
  ])("%s — это «отказа нет», а не молчание навсегда", (_name, raw) => {
    expect(parseSnooze(raw)).toBeNull();
  });
});

describe("snoozeActive", () => {
  const snooze = { version: "1.5.1", until: NOW + UPDATE_SNOOZE_MS };

  it("до срока — молчим", () => {
    expect(snoozeActive(snooze, "1.5.1", NOW + 1000)).toBe(true);
  });

  it("после срока — спрашиваем снова", () => {
    expect(snoozeActive(snooze, "1.5.1", snooze.until + 1)).toBe(false);
  });

  it("ровно в срок — уже спрашиваем", () => {
    expect(snoozeActive(snooze, "1.5.1", snooze.until)).toBe(false);
  });

  it("гость обновился — вчерашний отказ не считается", () => {
    // Сервер не называет версию, до которой просит обновиться, поэтому отказ
    // привязан к версии, которая его дала. Другая сборка — другой разговор.
    expect(snoozeActive(snooze, "1.6.0", NOW + 1000)).toBe(false);
  });

  it("отказа нет — окно показывается", () => {
    expect(snoozeActive(null, "1.5.1", NOW)).toBe(false);
  });
});

describe("хранилище", () => {
  it("записывает срок на сутки вперёд и читает его обратно", async () => {
    const { storage, map } = memory();
    const written = await writeUpdateSnooze("1.5.1", NOW, storage);

    expect(written).toEqual({ version: "1.5.1", until: NOW + UPDATE_SNOOZE_MS });
    expect(map.get(UPDATE_SNOOZE_KEY)).toBe(JSON.stringify(written));
    await expect(readUpdateSnooze(storage)).resolves.toEqual(written);
  });

  it("запертая связка ключей не роняет запись", async () => {
    const store = memory();
    store.break();
    await expect(writeUpdateSnooze("1.5.1", NOW, store.storage)).resolves.toEqual({
      version: "1.5.1",
      until: NOW + UPDATE_SNOOZE_MS,
    });
  });

  it("запертая связка ключей читается как «отказа нет»", async () => {
    const store = memory({
      [UPDATE_SNOOZE_KEY]: JSON.stringify({ version: "1.5.1", until: NOW + UPDATE_SNOOZE_MS }),
    });
    store.break();
    await expect(readUpdateSnooze(store.storage)).resolves.toBeNull();
  });
});
