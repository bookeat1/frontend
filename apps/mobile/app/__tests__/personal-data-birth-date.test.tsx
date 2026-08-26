import { RepositoryError, type AuthUser } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { profilePatch } from "../../src/lib/profile-edit";

/**
 * «Персональные данные» — ряд «День рождения» (макет 3z0f6dgev4HMwBAHPjTjPo,
 * node 977-7001).
 *
 * ПОЧЕМУ ЭТОТ ТЕСТ ЕСТЬ. Дата рождения в приложении уже была — но на ДРУГОМ
 * экране («О себе», app/profile/edit.tsx). На «Персональных данных», куда за
 * ней и приходят, ряда не было вовсе, и заметить это можно было только
 * глазами на телефоне.
 *
 * Проверяется ровно то, что ломается тихо:
 *
 *   1. ряд есть и показывает сохранённую дату так, как её читает человек
 *      (ДД.ММ.ГГГГ), а не в формате провода;
 *   2. пустая дата — приглашение её указать, а не пустая строка, которая
 *      читается как неудачная загрузка;
 *   3. сохранение уходит ТЕМ ЖЕ полем, что и с экрана «О себе»: один и тот же
 *      ключ патча `birthDate` → `birth_date`. Если этот экран заведёт своё
 *      поле, два экрана начнут показывать разные даты одного человека;
 *   4. в патче ровно одно поле — город сохранение дня рождения не трогает
 *      (ловушка `onSaved`: город устройства перенимается только тогда, когда
 *      город реально был в патче).
 */

const t = getDictionary("ru");

const push = vi.fn();
const back = vi.fn();
vi.mock("expo-router", () => ({
  useRouter: () => ({ push, back, replace: vi.fn() }),
  usePathname: () => "/profile/personal-data",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

let account: AuthUser;
const updateMe = vi.fn();
vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    status: "signed-in",
    repository: { getMe: async () => account, updateMe },
    signOut: vi.fn(),
  }),
}));

const { default: PersonalDataScreen } = await import("../profile/personal-data");

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "u-1",
    email: "",
    fullName: "Шакен Шаку",
    phone: "+77473123212",
    city: "Алматы",
    avatarUrl: null,
    createdAt: null,
    birthDate: null,
    ...overrides,
  };
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PersonalDataScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  account = user({ birthDate: "1990-05-04" });
  push.mockClear();
  updateMe.mockReset();
});

describe("«Персональные данные»: день рождения", () => {
  it("показывает сохранённую дату отдельным рядом, по-человечески", async () => {
    renderScreen();

    const row = await screen.findByRole("button", {
      name: t.profile.personalData.editBirthDateA11y,
    });
    expect(row.textContent).toContain(t.profile.personalData.birthDateRow);
    expect(row.textContent).toContain("04.05.1990");
    // Формат провода не должен утекать на экран.
    expect(row.textContent).not.toContain("1990-05-04");
  });

  it("без даты зовёт её указать, а не показывает пустоту", async () => {
    account = user({ birthDate: null });
    renderScreen();

    const row = await screen.findByRole("button", {
      name: t.profile.personalData.editBirthDateA11y,
    });
    expect(row.textContent).toContain(t.profile.personalData.birthDateEmpty);
  });

  it("открывает тот же календарь и сохраняет ТЕМ ЖЕ полем, что и «О себе»", async () => {
    updateMe.mockImplementation(async (patch: { birthDate?: string }) =>
      user({ birthDate: patch.birthDate ?? null }),
    );

    renderScreen();

    const row = await screen.findByRole("button", {
      name: t.profile.personalData.editBirthDateA11y,
    });
    fireEvent.click(row);

    // Тот самый календарь из формы «О себе»: заголовок диалога общий.
    expect(await screen.findByText(t.profile.edit.birthDateDialogTitle)).toBeTruthy();

    // Открылся на мае 1990 — на сохранённой дате, а не на «сегодня».
    fireEvent.click(screen.getByRole("button", { name: "17" }));
    fireEvent.click(screen.getByRole("button", { name: t.profile.edit.birthDateApply }));

    await waitFor(() => expect(updateMe).toHaveBeenCalledTimes(1));

    const sent = updateMe.mock.calls[0][0] as Record<string, unknown>;

    // ОДНО И ТО ЖЕ ПОЛЕ: форма «О себе» строит тело патча через profilePatch —
    // сравниваем с ним, а не с руками написанной строкой, чтобы переименование
    // поля ломало этот тест вместе с формой, а не оставляло два разных пути.
    const fromEditScreen = profilePatch(
      { fullName: account.fullName, city: account.city ?? "", birthDate: "1990-05-17" },
      account,
    );
    expect(fromEditScreen).toEqual({ birthDate: "1990-05-17" });
    expect(sent).toEqual(fromEditScreen);

    // И ничего сверх: город в патч не попадает даже пустым.
    expect(Object.keys(sent)).toEqual(["birthDate"]);
  });

  it("при отказе сервера не закрывается и не выдаёт дату за сохранённую", async () => {
    updateMe.mockImplementation(async () => {
      throw new RepositoryError("Unprocessable", undefined, 422);
    });

    renderScreen();

    fireEvent.click(
      await screen.findByRole("button", { name: t.profile.personalData.editBirthDateA11y }),
    );
    fireEvent.click(screen.getByRole("button", { name: "17" }));
    fireEvent.click(screen.getByRole("button", { name: t.profile.edit.birthDateApply }));

    expect(await screen.findByText(t.profile.edit.failure.rejected)).toBeTruthy();
    // Календарь остался открытым на выбранном дне — выбор не потерян.
    expect(screen.getByText(t.profile.edit.birthDateDialogTitle)).toBeTruthy();
    // И ряд по-прежнему показывает то, что реально лежит на сервере.
    expect(
      screen.getByRole("button", { name: t.profile.personalData.editBirthDateA11y }).textContent,
    ).toContain("04.05.1990");
  });
});
