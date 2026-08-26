import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * КУДА ВЕДЁТ УСПЕШНЫЙ ВХОД — на настоящем экране, а не только в чистой функции.
 *
 * Требование владельца: новый клиент после кода попадает на экран даты
 * рождения, существующий не видит ничего. Проверяется главным образом ВТОРОЕ:
 * давний гость с пустой датой рождения не должен попасть в онбординг. Именно
 * этот случай ломается первым, если кто-нибудь снова решит определять новизну
 * по пустому полю профиля.
 */

const t = getDictionary("ru");

const replace = vi.fn();
const back = vi.fn();
vi.mock("expo-router", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back, canGoBack: () => true }),
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const requestCode = vi.fn();
const signInWithCode = vi.fn();
const getMe = vi.fn();
vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ requestCode, signInWithCode, repository: { getMe }, status: "signed-out" }),
}));

const mutateAsync = vi.fn(async () => undefined);
vi.mock("../../src/hooks/useFavorites", () => ({
  useToggleFavorite: () => ({ mutateAsync }),
  useToggleEntityFavorite: () => ({ mutateAsync }),
}));

const { default: SignInScreen } = await import("../auth/sign-in");

/** Профиль, у которого имя есть, а даты рождения нет — самый частый давний
 * гость и одновременно самый опасный для этой логики. */
function account(overrides: Partial<{ fullName: string; birthDate: string | null }> = {}) {
  return {
    id: "u-1",
    email: "",
    fullName: "Дамир",
    phone: "+77010000000",
    city: null,
    avatarUrl: null,
    createdAt: "2025-01-01T00:00:00Z",
    birthDate: null,
    ...overrides,
  };
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SignInScreen />
    </QueryClientProvider>,
  );
}

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(t.auth.phoneLabel), "7010000000");
  await user.click(screen.getByText(t.auth.submitRequestCode));
  // Шесть цифр — экран отправляет код сам на последней.
  await user.type(screen.getByLabelText(t.auth.codeLabel), "123456");
}

describe("после входа: экран даты рождения только новому клиенту", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestCode.mockResolvedValue({ sent: true, devCode: null });
    getMe.mockResolvedValue(account());
  });

  it("новый клиент попадает на экран даты рождения", async () => {
    signInWithCode.mockResolvedValue({ isNewUser: true });
    const user = userEvent.setup();
    renderScreen();

    await signIn(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding/birthday"));
  });

  it("ДАВНИЙ клиент с пустой датой рождения не видит этот экран", async () => {
    signInWithCode.mockResolvedValue({ isNewUser: false });
    const user = userEvent.setup();
    renderScreen();

    await signIn(user);

    // Он просто уходит туда, откуда пришёл.
    await waitFor(() => expect(back).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalledWith("/onboarding/birthday");
  });

  it("сервер не сказал про новизну — тоже не показываем", async () => {
    signInWithCode.mockResolvedValue({ isNewUser: null });
    const user = userEvent.setup();
    renderScreen();

    await signIn(user);

    await waitFor(() => expect(back).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalledWith("/onboarding/birthday");
  });

  it("новый клиент без имени идёт сначала на имя — и несёт новизну с собой", async () => {
    signInWithCode.mockResolvedValue({ isNewUser: true });
    getMe.mockResolvedValue(account({ fullName: "" }));
    const user = userEvent.setup();
    renderScreen();

    await signIn(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding/name?new=1"));
  });

  it("давний клиент без имени идёт на имя, но БЕЗ признака новизны", async () => {
    signInWithCode.mockResolvedValue({ isNewUser: false });
    getMe.mockResolvedValue(account({ fullName: "" }));
    const user = userEvent.setup();
    renderScreen();

    await signIn(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding/name?new=0"));
  });
});
