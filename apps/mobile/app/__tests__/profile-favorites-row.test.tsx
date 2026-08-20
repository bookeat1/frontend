import type { AuthUser } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfileScreen from "../profile";

/**
 * Избранное лишилось нижней вкладки (её занял «Гастрогид»), поэтому
 * единственный вход в него теперь — строка в профиле. Если она исчезнет или
 * перестанет никуда вести, экран /favorites станет недостижимым, и заметить
 * это глазами почти невозможно: экран останется рабочим, просто до него никто
 * не дойдёт.
 */

const push = vi.fn();
const replace = vi.fn();

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
  useRouter: () => ({ push, replace, back: vi.fn() }),
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

// Загрузка аватара тянет expo-image-picker (нативный модуль) — экрану для
// этого теста она не нужна.
vi.mock("../../src/lib/avatar-upload", () => ({
  pickAndUploadAvatar: vi.fn(),
}));

beforeEach(() => {
  push.mockClear();
});

function renderProfile() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileScreen />
    </QueryClientProvider>,
  );
}

describe("профиль: вход в избранное", () => {
  it("рисует строку «Избранные» и ведёт ею на /favorites", async () => {
    renderProfile();

    const row = await screen.findByRole("button", { name: "Избранные" });
    row.click();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/favorites"));
  });

  it("держит её в верхней группе, рядом с бронями, а не внизу у выхода", async () => {
    renderProfile();

    const favorites = await screen.findByRole("button", { name: "Избранные" });
    const logout = screen.getByRole("button", { name: "Выйти из аккаунта" });

    // «Избранные» встречается в дереве РАНЬШЕ «Выйти из аккаунта».
    expect(favorites.compareDocumentPosition(logout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
