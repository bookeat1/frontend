import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@bookeat/i18n";

/**
 * Шаг «Укажите дату рождения» (макет 3073:11627).
 *
 * Проверяется то, что ломается тихо:
 *
 *   1. Несуществующая дата не уходит на сервер. 31 февраля Date молча
 *      превращает в 3 марта, и без сверки человек сохранил бы не тот день,
 *      которого не набирал.
 *   2. Дата в будущем не уходит на сервер: сервер её отвергнет, и вместо
 *      подсказки человек получит непонятную ошибку сохранения.
 *   3. Нормальная дата уходит в формате «YYYY-MM-DD» — том, который принимает
 *      PATCH /users/me.
 */

const t = getDictionary("ru");

const replace = vi.fn();
vi.mock("expo-router", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn(), canGoBack: () => true }),
  Stack: { Screen: () => null },
}));

vi.mock("../../src/lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const updateMe = vi.fn();
vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ repository: { updateMe }, status: "signed-in" }),
}));

const { default: OnboardingBirthdayScreen } = await import("../onboarding/birthday");

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OnboardingBirthdayScreen />
    </QueryClientProvider>,
  );
}

async function fill(user: ReturnType<typeof userEvent.setup>, d: string, m: string, y: string) {
  await user.type(screen.getByLabelText(t.onboarding.birthday.day), d);
  await user.type(screen.getByLabelText(t.onboarding.birthday.month), m);
  await user.type(screen.getByLabelText(t.onboarding.birthday.year), y);
}

beforeEach(() => {
  replace.mockClear();
  updateMe.mockClear();
  updateMe.mockResolvedValue({ id: "u-1", fullName: "Дамир", birthDate: "1992-05-18" });
});

describe("шаг «дата рождения»", () => {
  it("не отправляет несуществующую дату (31 февраля)", async () => {
    const user = userEvent.setup();
    renderScreen();

    await fill(user, "31", "02", "1992");
    await user.click(screen.getByText(t.onboarding.birthday.save));

    expect(updateMe).not.toHaveBeenCalled();
  });

  it("не отправляет дату из будущего", async () => {
    const user = userEvent.setup();
    renderScreen();

    await fill(user, "01", "01", String(new Date().getFullYear() + 1));
    await user.click(screen.getByText(t.onboarding.birthday.save));

    expect(updateMe).not.toHaveBeenCalled();
  });

  it("нормальную дату отправляет как YYYY-MM-DD и уводит на главную", async () => {
    const user = userEvent.setup();
    renderScreen();

    await fill(user, "18", "05", "1992");
    await user.click(screen.getByText(t.onboarding.birthday.save));

    expect(updateMe).toHaveBeenCalledWith({ birthDate: "1992-05-18" });
    expect(replace).toHaveBeenCalledWith("/");
  });
});
