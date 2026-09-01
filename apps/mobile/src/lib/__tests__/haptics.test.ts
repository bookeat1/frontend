import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Тактильный щелчок колеса выбора (правка владельца 2026-09-01: «добавь
 * микровибрацию как в нативках при скроле даты и количества гостей»).
 *
 * Проверяются две вещи, и обе ломаются молча.
 *
 * 1. РАЗВИЛКА ПО ПЛАТФОРМЕ: на Android `selectionAsync()` уходит в `Vibrator`
 *    и играет волну 50 мс — это жужжание, а не щелчок, и увидеть подмену можно
 *    только пальцем на телефоне. Здесь она видна как вызов не той функции.
 *
 * 2. СБОРКА БЕЗ НАТИВНОГО МОДУЛЯ. `expo-haptics` появится только в следующем
 *    бинаре, а JS мы возим по воздуху и в уже выпущенные (Android 1.5 сборки
 *    100–104, iOS 1.5.1 сборка 3). Модуль обязан подтягиваться лениво: провал
 *    загрузки — это отсутствие вибрации, а не отказ обёртки и тем более не
 *    падение бандла. Статический импорт наверху `haptics.ts` роняет тесты
 *    ниже — так и задумано.
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

/**
 * Первый щелчок ждёт загрузку модуля, а она приходит обещанием. Даём микро- и
 * макрозадачам отработать — на телефоне это доли кадра.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  haptics.selectionAsync.mockClear();
  haptics.performAndroidHapticsAsync.mockClear();
  // `vi.resetModules()` НЕ снимает подмены: без этого мок «загрузчик бросает
  // синхронно» протёк бы в следующие тесты, и они проверяли бы его, а не то,
  // что написано в их названии.
  vi.doUnmock("../haptics-native");
});

describe("hapticSelectionTick", () => {
  it("на iOS щёлкает генератором выбора — тем же, что у системного барабана", async () => {
    const { hapticSelectionTick } = await loadOn("ios");

    hapticSelectionTick();
    await settle();

    expect(haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });

  it("на Android щёлкает CLOCK_TICK, а НЕ волной вибромотора", async () => {
    const { hapticSelectionTick } = await loadOn("android");

    hapticSelectionTick();
    await settle();

    expect(haptics.performAndroidHapticsAsync).toHaveBeenCalledWith("clock-tick");
    // Вот это и есть жужжание, ради отсутствия которого тест написан.
    expect(haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it("на вебе не делает ничего: браузерная вибрация — дребезг, а не щелчок", async () => {
    const { hapticSelectionTick } = await loadOn("web");

    hapticSelectionTick();
    await settle();

    expect(haptics.selectionAsync).not.toHaveBeenCalled();
    expect(haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });

  it("щёлкает на каждый вызов, а не только на первый", async () => {
    const { hapticSelectionTick } = await loadOn("ios");

    hapticSelectionTick();
    await settle();
    hapticSelectionTick();
    hapticSelectionTick();
    await settle();

    expect(haptics.selectionAsync).toHaveBeenCalledTimes(3);
  });

  it("телефон без вибромотора не роняет экран и не оставляет висящий отказ", async () => {
    haptics.selectionAsync.mockRejectedValueOnce(new Error("no haptics engine"));
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    const { hapticSelectionTick } = await loadOn("ios");
    expect(() => hapticSelectionTick()).not.toThrow();
    await settle();

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe("сборка без нативного модуля expo-haptics", () => {
  /**
   * Как это выглядит на старом бинаре. Два разных исхода, и обёртка обязана
   * пережить оба:
   *
   *   «модуля нет» — вычисление модуля бросает `Cannot find native module`
   *   (так делает `requireNativeModule`, на нём стоит большинство нативных
   *   пакетов). Это тот самый исход, ради которого импорт ленивый: со
   *   статическим импортом на этой строке умирает весь бандл.
   *
   *   «модуль есть, нативной части нет» — импорт проходит, а каждый вызов
   *   отказывает (`expo-haptics@57` зовёт `requireOptionalNativeModule`,
   *   получает `null` и падает уже внутри асинхронной функции).
   */
  const unhandled = vi.fn();

  beforeEach(() => {
    unhandled.mockClear();
  });

  it("импорт модуля падает — обёртка молчит, а не бросает", async () => {
    vi.resetModules();
    const attempts = vi.fn();
    vi.doMock("react-native", () => ({ Platform: { OS: "android" } }));
    vi.doMock("expo-haptics", () => {
      attempts();
      throw new Error("Cannot find native module 'ExpoHaptics'");
    });
    process.on("unhandledRejection", unhandled);

    const { hapticSelectionTick } = await import("../haptics");
    expect(() => hapticSelectionTick()).not.toThrow();
    await settle();
    // Прокрутка — это десятки щелчков подряд: провалившаяся загрузка не должна
    // повторяться на каждом кадре.
    hapticSelectionTick();
    hapticSelectionTick();
    await settle();

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(attempts).toHaveBeenCalledTimes(1);
  });

  it("на нативе загрузка бросает СИНХРОННО — обёртка и это переживает", async () => {
    // Форма отказа, которой в jsdom не бывает: Metro прячет за `import()`
    // обычный `require` и, пока бандл не разрезан, зовёт его синхронно (см.
    // `haptics-native.ts`). Отсутствующий модуль тогда прилетает броском из
    // самой функции загрузки, а не отказом обещания, и `.then(…, onRejected)`
    // его не увидит.
    vi.resetModules();
    const attempts = vi.fn();
    vi.doMock("react-native", () => ({ Platform: { OS: "android" } }));
    vi.doMock("../haptics-native", () => ({
      importHaptics: () => {
        attempts();
        throw new Error("Requiring unknown module \"expo-haptics\"");
      },
    }));
    process.on("unhandledRejection", unhandled);

    const { hapticSelectionTick } = await import("../haptics");
    expect(() => hapticSelectionTick()).not.toThrow();
    await settle();
    hapticSelectionTick();
    await settle();

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(attempts).toHaveBeenCalledTimes(1);
  });

  it("нативной части нет — вызовы отказывают, экран этого не замечает", async () => {
    vi.resetModules();
    const notInstalled = () =>
      Promise.reject(new Error("The method or property Haptic.selectionAsync is not available"));
    vi.doMock("react-native", () => ({ Platform: { OS: "ios" } }));
    vi.doMock("expo-haptics", () => ({
      selectionAsync: notInstalled,
      performAndroidHapticsAsync: notInstalled,
      AndroidHaptics: { Clock_Tick: "clock-tick" },
    }));
    process.on("unhandledRejection", unhandled);

    const { hapticSelectionTick } = await import("../haptics");
    expect(() => hapticSelectionTick()).not.toThrow();
    await settle();

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
