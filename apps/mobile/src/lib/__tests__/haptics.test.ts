import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Тактильный щелчок колеса выбора (правка владельца 2026-09-01: «добавь
 * микровибрацию как в нативках при скроле даты и количества гостей»).
 *
 * Проверяется РАЗВИЛКА ПО ПЛАТФОРМЕ, потому что ломается она молча: на
 * Android `selectionAsync()` уходит в `Vibrator` и играет волну 50 мс — это
 * жужжание, а не щелчок, и увидеть подмену можно только пальцем на телефоне.
 * Здесь она видна как вызов не той функции.
 */

const haptics = vi.hoisted(() => ({
  selectionAsync: vi.fn(async () => {}),
  performAndroidHapticsAsync: vi.fn(async () => {}),
}));

vi.mock("expo-haptics", () => ({
  selectionAsync: haptics.selectionAsync,
  performAndroidHapticsAsync: haptics.performAndroidHapticsAsync,
  AndroidHaptics: { Clock_Tick: "clock-tick" },
}));

async function loadOn(os: "ios" | "android" | "web") {
  vi.resetModules();
  vi.doMock("react-native", () => ({ Platform: { OS: os } }));
  return await import("../haptics");
}

beforeEach(() => {
  haptics.selectionAsync.mockClear();
  haptics.performAndroidHapticsAsync.mockClear();
});

describe("hapticSelectionTick", () => {
  it("на iOS щёлкает генератором выбора — тем же, что у системного барабана", async () => {
    const { hapticSelectionTick } = await loadOn("ios");

    hapticSelectionTick();

    expect(haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });

  it("на Android щёлкает CLOCK_TICK, а НЕ волной вибромотора", async () => {
    const { hapticSelectionTick } = await loadOn("android");

    hapticSelectionTick();

    expect(haptics.performAndroidHapticsAsync).toHaveBeenCalledWith("clock-tick");
    // Вот это и есть жужжание, ради отсутствия которого тест написан.
    expect(haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it("на вебе не делает ничего: браузерная вибрация — дребезг, а не щелчок", async () => {
    const { hapticSelectionTick } = await loadOn("web");

    hapticSelectionTick();

    expect(haptics.selectionAsync).not.toHaveBeenCalled();
    expect(haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });

  it("телефон без вибромотора не роняет экран и не оставляет висящий отказ", async () => {
    haptics.selectionAsync.mockRejectedValueOnce(new Error("no haptics engine"));
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    const { hapticSelectionTick } = await loadOn("ios");
    expect(() => hapticSelectionTick()).not.toThrow();
    // Отказ обещания разбирается в микрозадаче — даём ей отработать.
    await new Promise((resolve) => setTimeout(resolve, 0));

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
