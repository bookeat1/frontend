import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@bookeat/api/client";

/**
 * Обёртка Amplitude для сайта — та же граница, что уже держит кабинет
 * (`apps/admin/src/lib/__tests__/analytics-no-pii.test.ts`): в свойства
 * пользователя уходит только `city`, плагин записи сессий не подключается
 * вовсе, ни один вызов обёртки не бросает наружу.
 *
 * Модуль читает ключ и держит `initialized` на уровне модуля, поэтому каждый
 * сценарий с другим окружением (ключ есть/нет, `init` падает) переимпортирует
 * его заново через `vi.resetModules()` — иначе тесты подглядывали бы друг за
 * другом через один и тот же модуль-синглтон.
 */

const setProperty = vi.fn();
const identify = vi.fn();
const setUserId = vi.fn();
const init = vi.fn();
const add = vi.fn();
const track = vi.fn();
const reset = vi.fn();

vi.mock("@amplitude/analytics-browser", () => ({
  init: (...args: unknown[]) => init(...args),
  add: (...args: unknown[]) => add(...args),
  track: (...args: unknown[]) => track(...args),
  reset: (...args: unknown[]) => reset(...args),
  setUserId: (id: string) => setUserId(id),
  identify: (payload: unknown) => identify(payload),
  Identify: class {
    set(key: string, value: unknown) {
      setProperty(key, value);
      return this;
    }
  },
}));

async function importWithKey(key: string | undefined) {
  vi.resetModules();
  if (key === undefined) delete process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  else process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY = key;
  return import("@web/lib/analytics");
}

function guest(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u-1",
    email: "",
    fullName: "",
    phone: null,
    city: null,
    avatarUrl: null,
    createdAt: null,
    birthDate: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
});

describe("аналитика сайта — package.json", () => {
  it("зависит ровно от версии 2.45.5 и не тянет Session Replay", () => {
    // AC1: реальный package.json, не заглушка — сборка (`pnpm run check`)
    // читает то же самое.
    // `vitest.config.ts` runs from the repo root, so this is the stable base
    // regardless of which worktree the test happens to live in.
    const pkgPath = join(process.cwd(), "apps/web/package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies["@amplitude/analytics-browser"]).toBe("2.45.5");
    const names = Object.keys(pkg.dependencies);
    expect(names.some((name) => name.includes("session-replay"))).toBe(false);
    expect(names.some((name) => name.includes("@amplitude/unified"))).toBe(false);
  });
});

describe("аналитика сайта — конфиг автозахвата", () => {
  it("снимок конфига: elementInteractions выключен (🔴1 = A), плагинов нет", async () => {
    const { initAnalytics } = await importWithKey("test-key");
    initAnalytics();

    expect(init).toHaveBeenCalledTimes(1);
    const config = init.mock.calls[0]?.[1] as { autocapture: Record<string, unknown> };
    expect(config.autocapture).toMatchObject({
      sessions: true,
      pageViews: { trackHistoryChanges: "pathOnly" },
      formInteractions: true,
      fileDownloads: false,
      elementInteractions: false,
    });
    // Подключение плагинов (Session Replay и любой другой) — не отсюда.
    expect(add).not.toHaveBeenCalled();
  });

  it("init вызывается ровно один раз на загрузку страницы при любом числе вызовов", async () => {
    const { initAnalytics } = await importWithKey("test-key");
    initAnalytics();
    initAnalytics();
    initAnalytics();
    expect(init).toHaveBeenCalledTimes(1);
  });
});

describe("аналитика сайта — без ключа и без окна", () => {
  it("нет ключа — init не трогает SDK", async () => {
    const { initAnalytics } = await importWithKey(undefined);
    initAnalytics();
    expect(init).not.toHaveBeenCalled();
  });

  it("нет ключа — identify/track/reset остаются no-op, ничего не бросают", async () => {
    const { initAnalytics, identifyUser, trackEvent, resetAnalytics } = await importWithKey(undefined);
    initAnalytics();
    expect(() => identifyUser(guest({ city: "Алматы" }))).not.toThrow();
    expect(() => trackEvent("login", { is_new_user: false })).not.toThrow();
    expect(() => resetAnalytics()).not.toThrow();
    expect(identify).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });
});

describe("аналитика сайта — идентичность без ПДн", () => {
  it("в identify уходит только city, ни имени, ни почты, ни телефона", async () => {
    const { initAnalytics, identifyUser } = await importWithKey("test-key");
    initAnalytics();

    identifyUser(
      guest({
        email: "sarkulindamir@gmail.com",
        phone: "+77078692233",
        fullName: "Дамир",
        city: "Алматы",
      }),
    );

    const keys = setProperty.mock.calls.map((call) => call[0]);
    expect(keys).toEqual(["city"]);
    expect(setUserId).toHaveBeenCalledWith("u-1");
    expect(identify).toHaveBeenCalled();
    const allCalls = JSON.stringify([...setProperty.mock.calls, ...setUserId.mock.calls]);
    expect(allCalls).not.toContain("sarkulindamir");
    expect(allCalls).not.toContain("77078692233");
    expect(allCalls).not.toContain("Дамир");
  });

  it("пустой city — Identify.set не вызывается вовсе", async () => {
    const { initAnalytics, identifyUser } = await importWithKey("test-key");
    initAnalytics();

    identifyUser(guest({ id: "u-2", city: null }));

    expect(setProperty).not.toHaveBeenCalled();
    expect(setUserId).toHaveBeenCalledWith("u-2");
  });
});

describe("аналитика сайта — ни один вызов не бросает наружу", () => {
  it("init: исключение SDK гасится console.error", async () => {
    init.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { initAnalytics } = await importWithKey("test-key");
    expect(() => initAnalytics()).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("identify: исключение SDK гасится console.error", async () => {
    identify.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { initAnalytics, identifyUser } = await importWithKey("test-key");
    initAnalytics();
    expect(() => identifyUser(guest({ city: "Алматы" }))).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("track: исключение SDK гасится console.error", async () => {
    track.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { initAnalytics, trackEvent } = await importWithKey("test-key");
    initAnalytics();
    expect(() => trackEvent("login", { is_new_user: false })).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("reset: исключение SDK гасится console.error", async () => {
    reset.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { initAnalytics, resetAnalytics } = await importWithKey("test-key");
    initAnalytics();
    expect(() => resetAnalytics()).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
