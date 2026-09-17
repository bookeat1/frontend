import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Событие входа и событие регистрации на сайте — зеркало мобильного
 * `apps/mobile/src/lib/__tests__/auth-login-analytics.test.tsx`.
 *
 * ЧТО ЗДЕСЬ ЛОМАЛОСЬ В МОБИЛКЕ: `trackEvent("login")` стоял РАНЬШЕ загрузки
 * профиля, а `identify` случается только после неё — Amplitude штампует
 * событие тем пользователем, который известен В МОМЕНТ вызова, поэтому все до
 * одного входы уходили анонимными, от device id. Порядок «сначала опознать,
 * потом событие» — критерий 5 спеки `web-amplitude-analytics-20260916.md`.
 */

const calls: string[] = [];
const identifyUser = vi.fn((user: { id: string }) => calls.push(`identify:${user.id}`));
const trackEvent = vi.fn((name: string, _props?: Record<string, unknown>) =>
  calls.push(`track:${name}`),
);

vi.mock("@web/lib/analytics", () => ({
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

const verifyOtp = vi.fn();
const getMe = vi.fn(async () => PROFILE);

vi.mock("@web/lib/api", () => ({
  authRepository: {
    verifyOtp: (input: { phone: string; code: string }) => verifyOtp(input),
    getMe: () => getMe(),
    refresh: () => Promise.reject(new Error("не нужен")),
  },
  repository: {},
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

const { AuthProvider, useAuth } = await import("@web/lib/auth");

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useAuth(), { wrapper });
}

const SESSION_BASE = {
  accessToken: "a",
  refreshToken: "r",
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

beforeEach(() => {
  calls.length = 0;
  identifyUser.mockClear();
  trackEvent.mockClear();
  getMe.mockClear();
  isNewUser = false;
  window.localStorage.clear();
  verifyOtp.mockImplementation(() => Promise.resolve({ ...SESSION_BASE, isNewUser }));
});

describe("вход по коду на сайте", () => {
  it("сначала опознаёт гостя, и только потом шлёт login", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.completeSignIn(await verifyOtp({ phone: "+77078692233", code: "1234" }));
    });

    expect(calls).toEqual(["identify:u-1", "track:login"]);
  });

  it("не кладёт в событие ни телефона, ни имени", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.completeSignIn(await verifyOtp({ phone: "+77078692233", code: "1234" }));
    });

    const props = JSON.stringify(trackEvent.mock.calls.map((call) => call[1]));
    expect(props).not.toContain("77078692233");
    expect(props).not.toContain("Дамир");
  });

  it("новому гостю добавляет отдельное событие регистрации", async () => {
    isNewUser = true;
    const { result } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.completeSignIn(await verifyOtp({ phone: "+77078692233", code: "1234" }));
    });

    expect(calls).toEqual(["identify:u-1", "track:login", "track:signup"]);
    expect(trackEvent.mock.calls[0]?.[1]).toEqual({ is_new_user: true });
  });

  it("вернувшемуся гостю события регистрации не шлёт", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.completeSignIn(await verifyOtp({ phone: "+77078692233", code: "1234" }));
    });

    expect(calls).not.toContain("track:signup");
    expect(trackEvent.mock.calls[0]?.[1]).toEqual({ is_new_user: false });
  });

  it("isNewUser === null уходит как null, а не как false", async () => {
    isNewUser = null;
    const { result } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.completeSignIn(await verifyOtp({ phone: "+77078692233", code: "1234" }));
    });

    expect(trackEvent.mock.calls[0]?.[1]).toEqual({ is_new_user: null });
    expect(calls).not.toContain("track:signup");
  });

  it("профиль не приехал — login и signup всё равно уходят, анонимно (без identify)", async () => {
    isNewUser = true;
    getMe.mockRejectedValueOnce(new Error("сеть моргнула"));
    const { result } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.completeSignIn(await verifyOtp({ phone: "+77078692233", code: "1234" }));
    });

    expect(identifyUser).not.toHaveBeenCalled();
    expect(calls).toEqual(["track:login", "track:signup"]);
  });
});

describe("гидратация сессии из localStorage", () => {
  it("вызывает identify через AnalyticsProvider, но сама completeSignIn здесь не участвует — login/signup не шлёт", async () => {
    // Сессия в хранилище ДО монтирования — это путь гидратации
    // (apps/web/src/lib/auth.tsx, эффект чтения `browserStorage()`), а не
    // `completeSignIn`. Он не зовёт ни `identifyUser`, ни `trackEvent`
    // напрямую — идентификация по гидратации целиком на `AnalyticsProvider`
    // (не поднят в этом тесте намеренно: только `AuthProvider`).
    window.localStorage.setItem("bookeat.web.access_token", "a");
    window.localStorage.setItem("bookeat.web.refresh_token", "r");
    window.localStorage.setItem("bookeat.web.user", JSON.stringify(PROFILE));
    getMe.mockResolvedValue(PROFILE);

    const { result } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(getMe).toHaveBeenCalled());

    expect(trackEvent).not.toHaveBeenCalled();
    expect(identifyUser).not.toHaveBeenCalled();
  });
});
