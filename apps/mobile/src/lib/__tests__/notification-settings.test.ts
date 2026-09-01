import { describe, expect, it, vi } from "vitest";
import {
  notificationsToggleAction,
  notificationsView,
  type NotificationsFacts,
} from "../notification-settings";
import {
  LEGACY_NOTIFICATIONS_PREF_KEY,
  NOTIFICATIONS_PREF_KEY,
  readNotificationsPref,
  writeNotificationsPref,
  type PrefStorage,
} from "../notifications-pref";

/**
 * ЧТО ЛОМАЕТСЯ ДЛЯ ГОСТЯ, ЕСЛИ ЭТОТ ФАЙЛ ПОКРАСНЕЕТ.
 *
 * Ровно та жалоба, с которой всё началось (01.09.2026): тумблер «Уведомления»
 * стоит в положении «включено», а телефон уведомления запретил — и человек
 * ждёт сообщения о подтверждении брони, которого не будет никогда. Это ложь
 * интерфейса, а не отсутствие фичи, поэтому проверяется именно ГРАНИЦА между
 * «наше сохранённое да» и «системное нет».
 */

function facts(over: Partial<NotificationsFacts> = {}): NotificationsFacts {
  return { supported: true, permission: "granted", pref: true, ...over };
}

describe("положение тумблера = разрешение системы И выбор гостя", () => {
  it("НЕ показывает «включено», когда система запретила, а выбор сохранён «да»", () => {
    // Это и есть возвращённый баг: до правки value брался из одного pref.
    expect(notificationsView(facts({ permission: "denied" })).value).toBe(false);
  });

  it("НЕ показывает «включено», пока разрешения ещё не спрашивали", () => {
    expect(notificationsView(facts({ permission: "undetermined" })).value).toBe(false);
  });

  it("показывает «включено» только когда сходятся обе половины", () => {
    expect(notificationsView(facts()).value).toBe(true);
    expect(notificationsView(facts({ pref: false })).value).toBe(false);
  });

  it("зовёт в системные настройки того, кто уведомления просил", () => {
    expect(notificationsView(facts({ permission: "denied" })).blocked).toBe(true);
  });

  it("и молчит перед тем, кто их сам выключил", () => {
    // Ему нечего чинить: система запретила уведомления, которых он не хочет.
    expect(notificationsView(facts({ permission: "denied", pref: false })).blocked).toBe(false);
  });

  it("в среде без пушей строка неактивна и не притворяется включённой", () => {
    expect(notificationsView(facts({ supported: false }))).toEqual({
      value: false,
      blocked: false,
      unsupported: true,
    });
  });
});

describe("что делает нажатие", () => {
  it("разрешение уже есть — просто включаем и регистрируем токен", () => {
    expect(notificationsToggleAction(true, { supported: true, permission: "granted" })).toBe(
      "enable",
    );
  });

  it("разрешение не спрашивали — сначала системный диалог", () => {
    expect(notificationsToggleAction(true, { supported: true, permission: "undetermined" })).toBe(
      "prompt",
    );
  });

  it("система отказала — второй раз она не спросит, ведём в её настройки", () => {
    // Ключевой момент: НЕ «prompt». requestPermissionsAsync после отказа
    // возвращает «нет», не показав ничего, и тумблер выглядел бы сломанным.
    expect(notificationsToggleAction(true, { supported: true, permission: "denied" })).toBe(
      "open-settings",
    );
  });

  it("выключение — всегда выключение, каким бы ни было разрешение", () => {
    expect(notificationsToggleAction(false, { supported: true, permission: "granted" })).toBe(
      "disable",
    );
    expect(notificationsToggleAction(false, { supported: true, permission: "denied" })).toBe(
      "disable",
    );
  });

  it("в среде без пушей нажатие не значит ничего", () => {
    expect(notificationsToggleAction(true, { supported: false, permission: "granted" })).toBe(
      "ignore",
    );
  });
});

/** Хранилище в памяти вместо нативного SecureStore. */
function store(initial: Record<string, string> = {}): PrefStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItemAsync: async (key) => (map.has(key) ? map.get(key)! : null),
    setItemAsync: async (key, value) => {
      map.set(key, value);
    },
    deleteItemAsync: async (key) => {
      map.delete(key);
    },
  };
}

describe("сохранённый выбор и переезд со старого ключа", () => {
  it("гость, никогда не трогавший тумблер, считается согласным", async () => {
    expect(await readNotificationsPref(store())).toBe(true);
  });

  it("выключение из старой сборки переезжает и не воскресает", async () => {
    // Самое ценное в v1: человек ОСОЗНАННО выключил уведомления. Потерять это
    // при обновлении значит включить их ему обратно без спроса.
    const s = store({ [LEGACY_NOTIFICATIONS_PREF_KEY]: "false" });

    expect(await readNotificationsPref(s)).toBe(false);
    expect(s.map.get(NOTIFICATIONS_PREF_KEY)).toBe("false");
    // Старый ключ удалён, поэтому миграция случается один раз за установку.
    expect(s.map.has(LEGACY_NOTIFICATIONS_PREF_KEY)).toBe(false);
    expect(await readNotificationsPref(s)).toBe(false);
  });

  it("новый ключ главнее старого, если остались оба", async () => {
    const s = store({
      [NOTIFICATIONS_PREF_KEY]: "false",
      [LEGACY_NOTIFICATIONS_PREF_KEY]: "true",
    });
    expect(await readNotificationsPref(s)).toBe(false);
  });

  it("недоступное хранилище даёт значение по умолчанию, а не падение", async () => {
    const broken: PrefStorage = {
      getItemAsync: async () => {
        throw new Error("keychain locked");
      },
      setItemAsync: async () => {},
      deleteItemAsync: async () => {},
    };
    expect(await readNotificationsPref(broken)).toBe(true);
  });

  it("непрошедшая запись не роняет экран", async () => {
    const failing: PrefStorage = {
      getItemAsync: async () => null,
      setItemAsync: vi.fn(async () => {
        throw new Error("keychain locked");
      }),
      deleteItemAsync: async () => {},
    };
    await expect(writeNotificationsPref(false, failing)).resolves.toBeUndefined();
  });
});
