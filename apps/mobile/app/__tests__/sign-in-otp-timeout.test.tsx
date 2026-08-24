import { RepositoryError } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Экран входа: ТАЙМАУТ ЗАПРОСА КОДА НЕ ДОЛЖЕН ЗАКРЫВАТЬ ВХОД.
 *
 * Сервер отправляет код синхронно и создаёт запись в `otp_codes` примерно через
 * секунду после прихода запроса, а клиент перестаёт ждать на 20-й. То есть код у
 * гостя на руках, и раньше ему было некуда его вводить: экран оставался на шаге
 * номера с надписью «Проверьте соединение». Здесь заперто обратное поведение —
 * шаг кода открывается, а неопределённость показана предупреждением.
 *
 * Отдельно проверяется, что отсчёт повторной отправки не сломан: мгновенной
 * ссылки «Отправить заново» быть не должно (иначе гость сожжёт лимит 1/мин), и
 * зависнуть он тоже не должен.
 */

const t = getDictionary("ru");
/** Тот же серверный лимит 1 запрос в минуту на номер, что и в экране. */
const RESEND_COOLDOWN_SECONDS = 60;

vi.mock("expo-router", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn(), canGoBack: () => true }),
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

/** Exactly what http-client.ts throws when our own deadline expires. */
function timeoutError(): RepositoryError {
  return new RepositoryError(
    "Request to /auth/otp/request timed out after 20000ms",
    new Error("TimeoutError"),
    undefined,
    undefined,
    undefined,
    undefined,
    true, // networkFailure
    true, // timedOut
  );
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SignInScreen />
    </QueryClientProvider>,
  );
}

async function askForCode(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(t.auth.phoneLabel), "7010000000");
  await user.click(screen.getByText(t.auth.submitRequestCode));
}

describe("вход: запрос кода не дождался ответа", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("открывает шаг кода и показывает предупреждение вместо отказа", async () => {
    requestCode.mockRejectedValue(timeoutError());
    const user = userEvent.setup();
    renderScreen();

    await askForCode(user);

    // Поле кода есть — гостю есть куда ввести то, что ему пришло.
    expect(screen.getByLabelText(t.auth.codeLabel)).toBeTruthy();
    expect(screen.getByText(t.auth.errorTimedOut)).toBeTruthy();
    // И это НЕ «проверьте соединение» на шаге номера.
    expect(screen.queryByText(t.auth.errorDescription)).toBeNull();
  });

  it("отсчёт повторной отправки идёт: ссылки «отправить заново» сразу нет", async () => {
    requestCode.mockRejectedValue(timeoutError());
    const user = userEvent.setup();
    renderScreen();

    await askForCode(user);

    expect(screen.queryByText(t.auth.resend)).toBeNull();
    const countdown = screen.getByText(/Новый код можно запросить через/);
    const seconds = Number(/(\d+)/.exec(countdown.textContent ?? "")?.[1]);
    // Отсчёт стартует от момента ОТПРАВКИ запроса, а не от момента ответа,
    // поэтому здесь (в тесте ответ приходит мгновенно) он близок к полной
    // минуте. Проверяется не точное число, а границы: не ноль (иначе гость
    // немедленно сожжёт серверный лимит 1/мин) и не больше минуты.
    //
    // Верхняя граница 61, а не 60: экран считает от `tick`, который снят при
    // монтировании — то есть на доли секунды РАНЬШЕ отправки, — и Math.ceil
    // округляет это вверх. То же самое происходит и на успешном пути, ровно
    // одну секунду; поведение общего таймера эта задача не меняет.
    expect(seconds).toBeGreaterThan(50);
    expect(seconds).toBeLessThanOrEqual(RESEND_COOLDOWN_SECONDS + 1);
  });

  it("предупреждение уходит, как только гость начал вводить код", async () => {
    requestCode.mockRejectedValue(timeoutError());
    const user = userEvent.setup();
    renderScreen();

    await askForCode(user);
    expect(screen.getByText(t.auth.errorTimedOut)).toBeTruthy();

    await user.type(screen.getByLabelText(t.auth.codeLabel), "1");
    expect(screen.queryByText(t.auth.errorTimedOut)).toBeNull();
  });

  it("предупреждение не мешает настоящей ошибке проверки кода", async () => {
    requestCode.mockRejectedValue(timeoutError());
    signInWithCode.mockRejectedValue(new RepositoryError("unauthorized", undefined, 401));
    const user = userEvent.setup();
    renderScreen();

    await askForCode(user);
    // Шесть цифр — авто-отправка на последней.
    await user.type(screen.getByLabelText(t.auth.codeLabel), "123456");

    expect(await screen.findByText(t.auth.errorCodeRejected)).toBeTruthy();
    expect(screen.queryByText(t.auth.errorTimedOut)).toBeNull();
  });

  it("офлайн по-прежнему держит гостя на шаге номера — вводить нечего", async () => {
    requestCode.mockRejectedValue(
      new RepositoryError("Network error", undefined, undefined, undefined, undefined, undefined, true),
    );
    const user = userEvent.setup();
    renderScreen();

    await askForCode(user);

    expect(screen.queryByLabelText(t.auth.codeLabel)).toBeNull();
    expect(screen.getByText(t.auth.errorDescription)).toBeTruthy();
  });

  it("5xx тоже держит на шаге номера: код на сервере не создан", async () => {
    requestCode.mockRejectedValue(new RepositoryError("Server error 500", undefined, 500));
    const user = userEvent.setup();
    renderScreen();

    await askForCode(user);

    expect(screen.queryByLabelText(t.auth.codeLabel)).toBeNull();
    expect(screen.getByText(t.auth.errorServerFailure)).toBeTruthy();
  });

  it("429 держит на шаге номера: сервер отказался создавать код", async () => {
    requestCode.mockRejectedValue(
      new RepositoryError("rate limited", undefined, 429, undefined, undefined, 12),
    );
    const user = userEvent.setup();
    renderScreen();

    await askForCode(user);

    expect(screen.queryByLabelText(t.auth.codeLabel)).toBeNull();
    expect(screen.getByText(t.auth.errorRateLimited(12))).toBeTruthy();
  });
});
