import type { AuthUser } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * ЧТО ЭТОТ ФАЙЛ ДЕРЖИТ: из профиля и настроек убраны блоки, за которыми нет
 * продукта.
 *
 *   • строка «Безопасность» в настройках — экрана нет, стояла неинтерактивной
 *     с подписью «Скоро» (флаг `SETTINGS_SECURITY_ROW_ENABLED`,
 *     правка владельца 28.08.2026);
 *   • блок статистики в профиле («Брони», а раньше и «Отзывов»/«Друзья») —
 *     убран целиком по прямому указанию владельца 04.09.2026: компонент
 *     `ProfileStats` удалён, запрос списка броней с экрана ушёл вместе с ним.
 */

const t = getDictionary("ru");

const push = vi.fn();

// Шпион на запрос списка броней: раньше экран ходил за ним ради счётчика
// «Брони». Хоистится вместе с vi.mock, чтобы экран получил именно его.
const useMyBookings = vi.hoisted(() => vi.fn(() => ({ data: { pages: [{ total: 3 }] } })));
vi.mock("../../src/hooks/useBooking", () => ({ useMyBookings }));

const ACCOUNT: AuthUser = {
  id: "u-1",
  email: "",
  fullName: "Дамир",
  phone: "+77078692233",
  city: "Алматы",
  avatarUrl: null,
  createdAt: null,
  birthDate: null,
};

vi.mock("expo-router", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/profile",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    status: "signed-in",
    repository: { getMe: async () => ACCOUNT, updateMe: async () => ACCOUNT },
    signOut: vi.fn(),
  }),
}));

vi.mock("../../src/lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

// Настройки читают версию сборки из expo-constants — это нативный модуль,
// в jsdom он не грузится. Версия для этого файла безразлична.
vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "1.0.0", ios: { buildNumber: "1" } } },
}));

// Загрузка аватара тянет expo-image-picker (нативный модуль).
vi.mock("../../src/lib/avatar-upload", () => ({ pickAndUploadAvatar: vi.fn() }));

// Тумблер уведомлений в настройках спрашивает системное разрешение через
// `src/lib/push`, а тот тянет expo-notifications — в jsdom он не поднимается.
// К спрятанным блокам отношения не имеет; поведение самого тумблера проверяет
// settings-notifications-toggle.test.tsx.
vi.mock("../../src/lib/push", () => ({
  usePush: () => ({
    supported: false,
    permission: async () => "denied" as const,
    enable: vi.fn(),
    disable: vi.fn(),
  }),
}));

const ProfileScreen = (await import("../profile")).default;
const SettingsScreen = (await import("../settings/index")).default;

function renderWithQuery(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

describe("профиль: блока статистики нет", () => {
  it("не рисует счётчик броней и не ходит за списком броней", async () => {
    renderWithQuery(<ProfileScreen />);

    // Экран дорисовался: имя на месте, а строки-счётчика с числом броней нет.
    await screen.findByText(ACCOUNT.fullName);
    expect(screen.queryByText("3")).toBeNull();
    expect(screen.queryByRole("button", { name: /^3 / })).toBeNull();
    expect(push).not.toHaveBeenCalledWith("/bookings");
    expect(useMyBookings).not.toHaveBeenCalled();
  });
});

describe("настройки: спрятана «Безопасность»", () => {
  it("не рисует строку, за которой нет экрана", () => {
    renderWithQuery(<SettingsScreen />);

    expect(screen.queryByText(t.settings.security)).toBeNull();
    // Остальные строки блока на месте — спрятана одна, а не весь экран.
    expect(screen.getByText(t.settings.notifications)).toBeTruthy();
    expect(screen.getByText(t.settings.appName)).toBeTruthy();
    expect(screen.getByText(t.settings.deleteAccount)).toBeTruthy();
  });
});
