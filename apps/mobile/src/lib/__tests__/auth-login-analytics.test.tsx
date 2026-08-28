import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Событие входа и событие регистрации.
 *
 * ЧТО ЗДЕСЬ БЫЛО СЛОМАНО: `trackEvent("login")` стоял РАНЬШЕ загрузки профиля,
 * а identify случается только после неё — Amplitude штампует событие тем
 * пользователем, который известен В МОМЕНТ вызова, поэтому все до одного
 * входы уходили анонимными, от device id. Ровно этот порядок («сначала
 * опознать, потом событие») уже стоит в админке.
 *
 * Регистрации не было события вовсе, хотя `signInWithCode` давно возвращает
 * `isNewUser`.
 *
 * И то, и другое ломается ТИХО: события идут, отчёт строится, просто отвечает
 * не на тот вопрос.
 */

const calls: string[] = [];
const identifyUser = vi.fn((user: { id: string }) => calls.push(`identify:${user.id}`));
const trackEvent = vi.fn((name: string, _props?: Record<string, unknown>) =>
  calls.push(`track:${name}`),
);

vi.mock("../analytics", () => ({
  identifyUser: (user: { id: string }) => identifyUser(user),
  trackEvent: (name: string, props?: Record<string, unknown>) => trackEvent(name, props),
  initAnalytics: vi.fn(),
  resetAnalytics: vi.fn(),
}));

const PROFILE = {
  id: "u-1",
  email: "",
  fullName: "Дамир",
  phone: "+77078692233",
  city: "Алматы",
  avatarUrl: null,
  createdAt: null,
  birthDate: null,
};

let isNewUser: boolean | null = false;

const verifyOtp = vi.fn((_input: { phone: string; code: string }) =>
  Promise.resolve({
    accessToken: "a",
    refreshToken: "r",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    isNewUser,
  }),
);

/**
 * AuthProvider строит репозиторий сам (`createAuthRepository`), поэтому
 * подменяется именно фабрика, а не контекст: всё остальное из `@bookeat/api`
 * — настоящее.
 */
vi.mock("@bookeat/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bookeat/api")>()),
  createAuthRepository: () => ({
    verifyOtp: (input: { phone: string; code: string }) => verifyOtp(input),
    getMe: () => Promise.resolve(PROFILE),
    requestOtp: () => Promise.resolve({ sent: true }),
    refresh: () => Promise.reject(new Error("не нужен")),
    login: () => Promise.reject(new Error("не нужен")),
  }),
}));

const { AuthProvider, useAuth } = await import("../auth");

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useAuth(), { wrapper });
}

beforeEach(() => {
  calls.length = 0;
  identifyUser.mockClear();
  trackEvent.mockClear();
  isNewUser = false;
});

describe("вход по коду", () => {
  it("сначала опознаёт пользователя, и только потом шлёт login", async () => {
    const { result } = setup();
    // Не «signed-out»: заглушка SecureStore помнит сессию между тестами в
    // одном файле, а важно здесь только то, что гидратация закончилась.
    await waitFor(() => expect(result.current.status).not.toBe("loading"));

    await act(async () => {
      await result.current.signInWithCode({ phone: "+77078692233", code: "1234" });
    });

    expect(calls).toEqual(["identify:u-1", "track:login"]);
  });

  it("не кладёт в событие ни телефона, ни имени", async () => {
    const { result } = setup();
    // Не «signed-out»: заглушка SecureStore помнит сессию между тестами в
    // одном файле, а важно здесь только то, что гидратация закончилась.
    await waitFor(() => expect(result.current.status).not.toBe("loading"));

    await act(async () => {
      await result.current.signInWithCode({ phone: "+77078692233", code: "1234" });
    });

    const props = JSON.stringify(trackEvent.mock.calls.map((call) => call[1]));
    expect(props).not.toContain("77078692233");
    expect(props).not.toContain("Дамир");
  });

  it("новому гостю добавляет отдельное событие регистрации", async () => {
    isNewUser = true;
    const { result } = setup();
    // Не «signed-out»: заглушка SecureStore помнит сессию между тестами в
    // одном файле, а важно здесь только то, что гидратация закончилась.
    await waitFor(() => expect(result.current.status).not.toBe("loading"));

    await act(async () => {
      await result.current.signInWithCode({ phone: "+77078692233", code: "1234" });
    });

    expect(calls).toEqual(["identify:u-1", "track:login", "track:signup"]);
    expect(trackEvent.mock.calls[0]?.[1]).toEqual({ is_new_user: true });
  });

  it("вернувшемуся гостю события регистрации не шлёт", async () => {
    const { result } = setup();
    // Не «signed-out»: заглушка SecureStore помнит сессию между тестами в
    // одном файле, а важно здесь только то, что гидратация закончилась.
    await waitFor(() => expect(result.current.status).not.toBe("loading"));

    await act(async () => {
      await result.current.signInWithCode({ phone: "+77078692233", code: "1234" });
    });

    expect(calls).not.toContain("track:signup");
    expect(trackEvent.mock.calls[0]?.[1]).toEqual({ is_new_user: false });
  });
});
