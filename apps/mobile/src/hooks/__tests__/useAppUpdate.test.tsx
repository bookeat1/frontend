import type { AppUpdateDecision, RestaurantRepository } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Platform } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UPDATE_SNOOZE_KEY, UPDATE_SNOOZE_MS } from "../../lib/update-snooze";
import { useAppUpdate } from "../useAppUpdate";

/**
 * Поведение проверки обновлений — то, из-за чего эту фичу вообще опасно
 * писать «на глаз»:
 *
 *   • отказ сервера НИКОГДА не превращается в окно. Ни в мягкое, ни тем более
 *     в жёсткое: гость не просил проверять, а запертое приложение из-за
 *     потерянной сети — худшее, что эта фича может сделать;
 *   • «Позже» помнится отдельно для магазина и для перезапуска;
 *   • «Позже» для магазина ПЕРЕЖИВАЕТ перезапуск приложения — сутки, и не
 *     дольше, и только для той сборки, которая отказалась;
 *   • жёсткий режим не читает записанный отказ вовсе;
 *   • жёсткий режим закрыть нельзя даже вызовом `dismiss()` напрямую;
 *   • магазин важнее скачанного по воздуху обновления;
 *   • не открывшийся магазин виден, а не проглочен.
 */

const t = getDictionary();

const checkAppUpdate = vi.fn();
const repository = { checkAppUpdate } as unknown as RestaurantRepository;

const openStoreListing = vi.fn<(url: string) => Promise<boolean>>();
const reloadApp = vi.fn(() => true);
/** Меняется в тестах: «обновление по воздуху скачано и ждёт перезапуска». */
let updatePending = false;

// `expo-constants` тянет за собой `expo-modules-core`, который в jsdom
// падает на нативном EventEmitter. Хуку от него нужна ровно одна строка —
// маркетинговая версия сборки.
vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "1.5.1" } },
}));
vi.mock("../../lib/repository", () => ({ useRepository: () => repository }));
vi.mock("../../lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary(), setLocale: () => {} }),
}));
vi.mock("../../lib/external-links", () => ({
  openStoreListing: (url: string) => openStoreListing(url),
}));
vi.mock("../../lib/reload-app", () => ({ reloadApp: () => reloadApp() }));
/**
 * Хранилище отказа — настоящая карта в памяти, а не заглушка из пустых
 * функций: проверять надо, что «Позже» действительно ЗАПИСАНО и что при
 * следующем запуске оно читается, а не что была вызвана функция.
 */
const secureStore = new Map<string, string>();
vi.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => secureStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    secureStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    secureStore.delete(key);
  },
}));
vi.mock("expo-updates", () => ({
  isEnabled: false,
  reloadAsync: async () => {},
  useUpdates: () => ({
    isUpdateAvailable: updatePending,
    isUpdatePending: updatePending,
    isChecking: false,
    isDownloading: false,
  }),
}));

const STORE = "https://apps.apple.com/app/id6757542577";

/**
 * Под тестами `react-native` — это `react-native-web`, у которого
 * `Platform.OS === "web"`, а на вебе хук не спрашивает сервер вовсе. Чтобы
 * проверять поведение ТЕЛЕФОНА, платформа подменяется на время теста и
 * возвращается обратно — иначе половина проверок была бы про пустоту.
 */
function pretendPlatform(os: "ios" | "android" | "web") {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true, writable: true });
}

function answers(decision: AppUpdateDecision) {
  checkAppUpdate.mockResolvedValue(decision);
}

beforeEach(() => {
  secureStore.clear();
  pretendPlatform("ios");
  updatePending = false;
  checkAppUpdate.mockReset();
  openStoreListing.mockReset();
  openStoreListing.mockResolvedValue(true);
  reloadApp.mockReset();
  answers({ action: "none" });
});

afterEach(() => {
  pretendPlatform("web");
});

describe("useAppUpdate", () => {
  it("«none» — окна нет", async () => {
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(checkAppUpdate).toHaveBeenCalled());
    expect(result.current.prompt).toBeNull();
  });

  it("отказ сервера — молчание, а не окно", async () => {
    checkAppUpdate.mockRejectedValue(new Error("network is gone"));
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(checkAppUpdate).toHaveBeenCalled());
    expect(result.current.prompt).toBeNull();
  });

  it("мягкий режим показывается и снимается «Позже»", async () => {
    answers({ action: "recommended", storeUrl: STORE, title: { ru: "Есть новая версия" } });
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.prompt?.title).toBe("Есть новая версия"));

    act(() => result.current.dismiss());
    expect(result.current.prompt).toBeNull();
  });

  it("жёсткий режим не снимается ничем", async () => {
    answers({ action: "required", storeUrl: STORE });
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.prompt?.blocking).toBe(true));

    act(() => result.current.dismiss());
    expect(result.current.prompt?.blocking).toBe(true);
  });

  it("«Позже» для магазина не прячет предложение перезапуститься", async () => {
    updatePending = true;
    answers({ action: "recommended", storeUrl: STORE });
    const { result } = renderHook(() => useAppUpdate());
    // Магазин важнее: по воздуху нативную часть не довезти.
    await waitFor(() => expect(result.current.prompt?.kind).toBe("store"));

    act(() => result.current.dismiss());
    expect(result.current.prompt?.kind).toBe("restart");

    act(() => result.current.dismiss());
    expect(result.current.prompt).toBeNull();
  });

  it("кнопка магазина открывает именно ту ссылку, что прислал сервер", async () => {
    answers({ action: "recommended", storeUrl: STORE });
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.prompt).not.toBeNull());

    await act(async () => {
      result.current.act();
    });
    expect(openStoreListing).toHaveBeenCalledWith(STORE);
    expect(result.current.actionError).toBeNull();
  });

  it("не открывшийся магазин становится видимой ошибкой", async () => {
    openStoreListing.mockResolvedValue(false);
    answers({ action: "required", storeUrl: STORE });
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.prompt).not.toBeNull());

    await act(async () => {
      result.current.act();
    });
    await waitFor(() => expect(result.current.actionError).toBe(t.appUpdate.openFailed));
  });

  it("скачанное по воздуху обновление предлагает перезапуск и перезапускает", async () => {
    updatePending = true;
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.prompt?.kind).toBe("restart"));

    act(() => result.current.act());
    expect(reloadApp).toHaveBeenCalledTimes(1);
    // В магазин при этом никто не уходит: обновление уже на телефоне.
    expect(openStoreListing).not.toHaveBeenCalled();
  });

  it("«Позже» записывается и переживает перезапуск приложения", async () => {
    answers({ action: "recommended", storeUrl: STORE });
    const first = renderHook(() => useAppUpdate());
    await waitFor(() => expect(first.result.current.prompt).not.toBeNull());

    await act(async () => {
      first.result.current.dismiss();
    });
    await waitFor(() => expect(secureStore.get(UPDATE_SNOOZE_KEY)).toBeDefined());
    first.unmount();

    // Новый запуск: тот же сервер, тот же ответ, но окна быть не должно.
    const second = renderHook(() => useAppUpdate());
    await waitFor(() => expect(checkAppUpdate).toHaveBeenCalledTimes(2));
    await act(async () => {
      await Promise.resolve();
    });
    expect(second.result.current.prompt).toBeNull();
  });

  it("через сутки просьба возвращается", async () => {
    secureStore.set(
      UPDATE_SNOOZE_KEY,
      JSON.stringify({ version: "1.5.1", until: Date.now() - 1 }),
    );
    answers({ action: "recommended", storeUrl: STORE });
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.prompt?.kind).toBe("store"));
  });

  it("после обновления сборки старый отказ не действует", async () => {
    // Сборка в тесте — 1.5.1 (замоканный expo-constants). Отказ записан
    // предыдущей версией, значит он про другой разговор.
    secureStore.set(
      UPDATE_SNOOZE_KEY,
      JSON.stringify({ version: "1.5.0", until: Date.now() + UPDATE_SNOOZE_MS }),
    );
    answers({ action: "recommended", storeUrl: STORE });
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.prompt?.kind).toBe("store"));
  });

  it("записанное «Позже» не проглатывает жёсткий режим", async () => {
    // Самое опасное место фичи: вчера гость снял мягкую просьбу, сегодня в
    // панели включили принуждение. Оно обязано доехать.
    secureStore.set(
      UPDATE_SNOOZE_KEY,
      JSON.stringify({ version: "1.5.1", until: Date.now() + UPDATE_SNOOZE_MS }),
    );
    answers({ action: "required", storeUrl: STORE });
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.prompt?.blocking).toBe(true));
  });

  it("отказ от перезапуска в хранилище не пишется", async () => {
    // Скачанный бандл применяется на следующем холодном старте сам, так что
    // переживать перезапуск этому отказу нечего и незачем.
    updatePending = true;
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.prompt?.kind).toBe("restart"));

    await act(async () => {
      result.current.dismiss();
    });
    expect(result.current.prompt).toBeNull();
    expect(secureStore.has(UPDATE_SNOOZE_KEY)).toBe(false);
  });

  it("веб-сборка сервер не спрашивает вовсе", async () => {
    // Обновлять там нечего: ни магазина, ни бинаря.
    pretendPlatform("web");
    answers({ action: "required", storeUrl: STORE });
    const { result } = renderHook(() => useAppUpdate());
    await act(async () => {
      await Promise.resolve();
    });
    expect(checkAppUpdate).not.toHaveBeenCalled();
    expect(result.current.prompt).toBeNull();
  });
});
