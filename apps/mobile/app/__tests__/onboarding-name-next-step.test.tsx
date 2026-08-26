import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * КУДА ВЕДЁТ ШАГ ИМЕНИ ПОСЛЕ СОХРАНЕНИЯ.
 *
 * Раньше он вёл на дату рождения ВСЕГДА. Пустое имя — не признак нового
 * аккаунта: у гостя, который зарегистрировался до того, как имя стало
 * обязательным, оно тоже пустое, и после его заполнения он получал экран
 * регистрации, которого не просил. Теперь дальше идёт только тот, кого новым
 * назвал сервер (признак приезжает параметром `new` из экрана входа).
 */

const t = getDictionary("ru");

const replace = vi.fn();
let routeParams: { new?: string } = {};
vi.mock("expo-router", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => routeParams,
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

const { default: OnboardingNameScreen } = await import("../onboarding/name");

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OnboardingNameScreen />
    </QueryClientProvider>,
  );
}

async function saveName(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(t.onboarding.name.label), "Дамир");
  await user.click(screen.getByText(t.onboarding.name.save));
}

describe("шаг имени: что дальше", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeParams = {};
    updateMe.mockResolvedValue({
      id: "u-1",
      email: "",
      fullName: "Дамир",
      phone: "+77010000000",
      city: null,
      avatarUrl: null,
      createdAt: "2026-08-26T09:00:00Z",
      birthDate: null,
    });
  });

  it("новый клиент идёт дальше на дату рождения", async () => {
    routeParams = { new: "1" };
    const user = userEvent.setup();
    renderScreen();

    await saveName(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding/birthday"));
  });

  it("ДАВНИЙ клиент, только что заполнивший имя, уходит на главную", async () => {
    routeParams = { new: "0" };
    const user = userEvent.setup();
    renderScreen();

    await saveName(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(replace).not.toHaveBeenCalledWith("/onboarding/birthday");
  });

  it("параметра нет (прямая ссылка) — тоже не тащим в онбординг", async () => {
    const user = userEvent.setup();
    renderScreen();

    await saveName(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(replace).not.toHaveBeenCalledWith("/onboarding/birthday");
  });
});
