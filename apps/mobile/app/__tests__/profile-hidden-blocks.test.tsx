import type { AuthUser } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * ЧТО ЭТОТ ФАЙЛ ДЕРЖИТ: из профиля и настроек убраны блоки, за которыми нет
 * продукта (правка владельца 28.08.2026).
 *
 *   • счётчики «Отзывов» и «Друзья» — ни ручки, ни экрана не существует, у
 *     КАЖДОГО гостя там стоял ноль (флаг `PROFILE_SOCIAL_STATS_ENABLED`);
 *   • строка «Безопасность» в настройках — экрана нет, стояла неинтерактивной
 *     с подписью «Скоро» (флаг `SETTINGS_SECURITY_ROW_ENABLED`).
 *
 * Счётчик «Брони» ОСТАЁТСЯ и остаётся кнопкой: за ним `GET /bookings`, и он
 * единственный вход в список броней с этого экрана.
 */

const t = getDictionary("ru");

const push = vi.fn();

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

vi.mock("../../src/hooks/useBooking", () => ({
  useMyBookings: () => ({ data: { pages: [{ total: 3 }] } }),
}));

// Настройки читают версию сборки из expo-constants — это нативный модуль,
// в jsdom он не грузится. Версия для этого файла безразлична.
vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "1.0.0", ios: { buildNumber: "1" } } },
}));

// Загрузка аватара тянет expo-image-picker (нативный модуль).
vi.mock("../../src/lib/avatar-upload", () => ({ pickAndUploadAvatar: vi.fn() }));

const ProfileScreen = (await import("../profile")).default;
const SettingsScreen = (await import("../settings/index")).default;

function renderWithQuery(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

describe("профиль: спрятаны неработающие счётчики", () => {
  it("оставляет «Брони» кнопкой в список броней", async () => {
    renderWithQuery(<ProfileScreen />);

    const bookings = await screen.findByRole("button", { name: `3 ${t.profile.stats.bookings}` });
    bookings.click();
    expect(push).toHaveBeenCalledWith("/bookings");
  });

  it("не рисует «Отзывов» и «Друзья»", async () => {
    renderWithQuery(<ProfileScreen />);

    await screen.findByText(t.profile.stats.bookings);
    expect(screen.queryByText(t.profile.stats.reviews)).toBeNull();
    expect(screen.queryByText(t.profile.stats.friends)).toBeNull();
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
