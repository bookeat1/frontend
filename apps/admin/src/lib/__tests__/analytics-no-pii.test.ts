import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Аналитика админки не знает почту сотрудника и не пишет видео его сессий.
 *
 * Что здесь было: `identity.set("email", user.email)` плюс Session Replay с
 * `sampleRate: 1`, то есть КАЖДАЯ сессия сотрудника записывалась целиком — а
 * на его экране открыт список броней с именами и телефонами гостей. Всё это
 * уезжало в тот же проект Amplitude, куда идут события гостей.
 *
 * Тест держит обе границы: в свойства пользователя уходят только id и роль, и
 * плагин записи сессий не подключается вовсе (`sampleRate: 0` не годится —
 * SDK записи всё равно загружается и стартует, и вернуть запись можно одной
 * цифрой).
 */

const setProperty = vi.fn();
const identify = vi.fn();
const setUserId = vi.fn();
const init = vi.fn();
const add = vi.fn();

vi.mock("@amplitude/analytics-browser", () => ({
  init: (...args: unknown[]) => init(...args),
  add: (...args: unknown[]) => add(...args),
  track: vi.fn(),
  reset: vi.fn(),
  setUserId: (id: string) => setUserId(id),
  identify: (payload: unknown) => identify(payload),
  Identify: class {
    set(key: string, value: unknown) {
      setProperty(key, value);
      return this;
    }
  },
}));

// Ключ читается на уровне модуля, поэтому он должен стоять ДО импорта: без
// него весь модуль — сознательный no-op, и тест ничего бы не проверял.
process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY = "test-key";
const { identifyUser, initAnalytics } = await import("../analytics");

beforeEach(() => {
  vi.clearAllMocks();
  // Идемпотентен: второй вызов — no-op, но без первого identify молчит.
  initAnalytics();
});

describe("аналитика админки", () => {
  it("не подключает запись сессий", () => {
    // Ни одного плагина: сегодня единственным был Session Replay, и любой
    // новый должен приходить с решением, а не молча.
    expect(add).not.toHaveBeenCalled();
  });

  it("в свойствах пользователя нет почты — только роль", () => {
    identifyUser({
      id: "u-1",
      email: "sarkulindamir@gmail.com",
      phone: "+77078692233",
      full_name: "Дамир",
      role: "superadmin",
      avatar_url: null,
      preferred_language: "ru",
    });

    const keys = setProperty.mock.calls.map((call) => call[0]);
    expect(keys).toEqual(["role"]);
    expect(JSON.stringify(setProperty.mock.calls)).not.toContain("sarkulindamir");
    // Идентификатор остаётся: он говорит, КАКОЙ аккаунт, не говоря, ЧЕЙ.
    expect(setUserId).toHaveBeenCalledWith("u-1");
    expect(identify).toHaveBeenCalled();
  });
});
