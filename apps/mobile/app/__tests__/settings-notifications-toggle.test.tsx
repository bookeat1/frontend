import { getDictionary } from "@bookeat/i18n";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as SecureStore from "expo-secure-store";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PushOutcome, PushPermission } from "../../src/lib/push-registration";
import {
  LEGACY_NOTIFICATIONS_PREF_KEY,
  NOTIFICATIONS_PREF_KEY,
} from "../../src/lib/notifications-pref";

/**
 * ЧТО ЭТОТ ФАЙЛ ДЕРЖИТ.
 *
 * Тумблер «Уведомления» в настройках был пустышкой: он писал булево в
 * SecureStore и больше ничего — не спрашивал системного разрешения, не
 * регистрировал токен и показывал «включено» телефону, который уведомления
 * запретил (жалоба тестировщика владельца, 01.09.2026).
 *
 * Здесь проверяется поведение экрана целиком: что он показывает, что он зовёт
 * и что делает при возвращении из системных настроек. Чего он НЕ доказывает:
 * настоящего системного диалога, настоящего перехода в настройки телефона и
 * доставки пуша — это только устройство.
 */

const t = getDictionary("ru");

let permission: PushPermission = "undetermined";
let enableOutcome: PushOutcome = { state: "registered", token: "ExponentPushToken[aaa]" };

const push = {
  supported: true,
  permission: vi.fn(async () => permission),
  enable: vi.fn(async (): Promise<PushOutcome> => enableOutcome),
  disable: vi.fn(async () => {}),
};

const openAppSettings = vi.fn(async () => true);

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/settings",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    status: "signed-in",
    repository: { deleteAccount: vi.fn() },
    signOut: vi.fn(),
  }),
}));

vi.mock("../../src/lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

// Версия сборки читается из нативного expo-constants; к тумблеру отношения не
// имеет.
vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "1.0.0", ios: { buildNumber: "1" } } },
}));

// `src/lib/push` тянет expo-notifications, который в jsdom не поднимается.
// Подменяется весь контекст: экран общается с системой только через него.
vi.mock("../../src/lib/push", () => ({ usePush: () => push }));

// Переход в системные настройки — единственное, что нельзя проверить в jsdom
// по-настоящему.
vi.mock("../../src/lib/external-links", () => ({ openAppSettings }));

const SettingsScreen = (await import("../settings/index")).default;

/** Подписчики AppState, чтобы тест мог вернуть приложение на передний план. */
const appStateListeners: ((state: string) => void)[] = [];

async function renderSettings() {
  const rn = await import("react-native");
  vi.spyOn(rn.AppState, "addEventListener").mockImplementation(((
    _type: string,
    handler: (state: string) => void,
  ) => {
    appStateListeners.push(handler);
    return { remove: () => appStateListeners.splice(appStateListeners.indexOf(handler), 1) };
    // Подпись addEventListener перегружена по типу события; тест подменяет
    // одну ветку — тот же приём, что и в greeting.test.tsx.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any);

  const result = render(<SettingsScreen />);
  // Разрешение и сохранённый выбор читаются асинхронно; до этого строка
  // намеренно неактивна.
  await screen.findByText(t.settings.appName);
  await act(async () => {});
  return result;
}

function toggle(): HTMLInputElement {
  return screen.getByRole("switch", { name: t.settings.notifications }) as HTMLInputElement;
}

async function foreground() {
  await act(async () => {
    appStateListeners.forEach((handler) => handler("active"));
  });
}

beforeEach(async () => {
  appStateListeners.length = 0;
  permission = "undetermined";
  enableOutcome = { state: "registered", token: "ExponentPushToken[aaa]" };
  await SecureStore.deleteItemAsync(NOTIFICATIONS_PREF_KEY);
  await SecureStore.deleteItemAsync(LEGACY_NOTIFICATIONS_PREF_KEY);
});

describe("тумблер показывает системное разрешение, а не только своё булево", () => {
  it("стоит выключенным, когда телефон запретил уведомления, а выбор сохранён «да»", async () => {
    // Ровно тот баг, из-за которого гость ждал пуш, которого не будет.
    permission = "denied";
    await SecureStore.setItemAsync(NOTIFICATIONS_PREF_KEY, "true");

    await renderSettings();

    expect(toggle().checked).toBe(false);
    expect(screen.getByText(t.settings.notificationsBlocked)).toBeTruthy();
  });

  it("стоит выключенным, пока разрешения не спрашивали", async () => {
    await SecureStore.setItemAsync(NOTIFICATIONS_PREF_KEY, "true");

    await renderSettings();

    expect(toggle().checked).toBe(false);
    expect(screen.getByText(t.settings.notificationsOff)).toBeTruthy();
  });

  it("стоит включённым только когда сходятся разрешение и выбор", async () => {
    permission = "granted";
    await SecureStore.setItemAsync(NOTIFICATIONS_PREF_KEY, "true");

    await renderSettings();

    expect(toggle().checked).toBe(true);
    expect(screen.getByText(t.settings.notificationsOn)).toBeTruthy();
  });
});

describe("включение", () => {
  it("сначала спрашивает систему и только с согласия сохраняет и регистрирует", async () => {
    await renderSettings();
    expect(toggle().checked).toBe(false);

    // Гость соглашается в системном диалоге.
    push.enable.mockImplementationOnce(async () => {
      permission = "granted";
      return enableOutcome;
    });
    await act(async () => {
      fireEvent.click(toggle());
    });

    expect(push.enable).toHaveBeenCalledTimes(1);
    expect(toggle().checked).toBe(true);
    expect(await SecureStore.getItemAsync(NOTIFICATIONS_PREF_KEY)).toBe("true");
  });

  it("после отказа в системном диалоге не притворяется включённым", async () => {
    await renderSettings();

    push.enable.mockImplementationOnce(async () => {
      permission = "denied";
      return { state: "denied" };
    });
    await act(async () => {
      fireEvent.click(toggle());
    });

    expect(toggle().checked).toBe(false);
    // И объясняет, где это теперь чинится: второй раз система не спросит.
    expect(screen.getByText(t.settings.notificationsBlocked)).toBeTruthy();
  });

  it("не показывает «включено», если токен до сервера не дошёл", async () => {
    permission = "granted";
    // Гость раньше выключил уведомления сам, поэтому строка начинает с «выкл».
    await SecureStore.setItemAsync(NOTIFICATIONS_PREF_KEY, "false");
    await renderSettings();
    expect(toggle().checked).toBe(false);

    enableOutcome = { state: "failed", error: new Error("offline") };
    await act(async () => {
      fireEvent.click(toggle());
    });

    expect(toggle().checked).toBe(false);
    expect(screen.getByText(t.settings.notificationsError)).toBeTruthy();
    // Сохранённый выбор тоже откатывается: иначе тихая синхронизация при
    // следующем старте включила бы то, что гостю показали выключенным.
    expect(await SecureStore.getItemAsync(NOTIFICATIONS_PREF_KEY)).toBe("false");
  });

  it("когда система уже отказала, ведёт в настройки телефона, а не в пустой диалог", async () => {
    permission = "denied";
    await SecureStore.setItemAsync(NOTIFICATIONS_PREF_KEY, "true");
    await renderSettings();

    fireEvent.click(screen.getByRole("button", { name: t.settings.notificationsOpenSettings }));

    expect(openAppSettings).toHaveBeenCalledTimes(1);
    // Системного диалога не было: requestPermissionsAsync после отказа
    // возвращает «нет», ничего не показав.
    expect(push.enable).not.toHaveBeenCalled();
  });
});

describe("выключение", () => {
  it("снимает регистрацию токена и запоминает выбор", async () => {
    permission = "granted";
    await SecureStore.setItemAsync(NOTIFICATIONS_PREF_KEY, "true");
    await renderSettings();
    expect(toggle().checked).toBe(true);

    await act(async () => {
      fireEvent.click(toggle());
    });

    expect(push.disable).toHaveBeenCalledTimes(1);
    expect(toggle().checked).toBe(false);
    expect(await SecureStore.getItemAsync(NOTIFICATIONS_PREF_KEY)).toBe("false");
  });

  it("не трогает системное разрешение — снаружи его выключить нельзя", async () => {
    permission = "granted";
    await SecureStore.setItemAsync(NOTIFICATIONS_PREF_KEY, "true");
    await renderSettings();
    // На открытии экрана токен переподтверждается (разрешение есть и гость
    // уведомления хочет), поэтому считаем вызовы ПОСЛЕ этого момента.
    const beforeTap = push.enable.mock.calls.length;

    await act(async () => {
      fireEvent.click(toggle());
    });

    // Выключение не спрашивает систему ни о чём: разрешение как было, так и
    // осталось — снять его может только сам владелец телефона.
    expect(push.enable.mock.calls.length).toBe(beforeTap);
    expect(permission).toBe("granted");
  });
});

describe("возвращение из системных настроек", () => {
  it("пересчитывает положение, когда приложение снова на переднем плане", async () => {
    permission = "denied";
    await SecureStore.setItemAsync(NOTIFICATIONS_PREF_KEY, "true");
    await renderSettings();
    expect(toggle().checked).toBe(false);

    // Гость ушёл в настройки телефона, разрешил уведомления и вернулся.
    permission = "granted";
    await foreground();

    expect(toggle().checked).toBe(true);
    // И токен регистрируется: разрешение без регистрации — та же пустышка,
    // только наоборот.
    expect(push.enable).toHaveBeenCalled();
  });

  it("не включает тумблер тому, кто выключил его сам", async () => {
    permission = "granted";
    await SecureStore.setItemAsync(NOTIFICATIONS_PREF_KEY, "false");
    await renderSettings();

    await foreground();

    expect(toggle().checked).toBe(false);
    expect(push.enable).not.toHaveBeenCalled();
  });
});

describe("двойное нажатие и недоступная среда", () => {
  it("второе нажатие подряд не запускает вторую работу", async () => {
    let release: (() => void) | null = null;
    push.enable.mockImplementationOnce(
      () =>
        new Promise<PushOutcome>((resolve) => {
          release = () => {
            permission = "granted";
            resolve(enableOutcome);
          };
        }),
    );
    await renderSettings();

    await act(async () => {
      fireEvent.click(toggle());
    });
    // Пока идёт системный диалог, переключатель заблокирован.
    expect(toggle().disabled).toBe(true);
    await act(async () => {
      fireEvent.click(toggle());
      release?.();
    });

    expect(push.enable).toHaveBeenCalledTimes(1);
  });

  it("в сборке без пушей строка неактивна и честно говорит почему", async () => {
    push.supported = false;
    try {
      permission = "denied";
      await renderSettings();

      expect(toggle().disabled).toBe(true);
      expect(screen.getByText(t.settings.notificationsUnavailable)).toBeTruthy();
    } finally {
      push.supported = true;
    }
  });
});
