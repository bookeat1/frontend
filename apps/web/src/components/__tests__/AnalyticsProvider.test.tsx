import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `AnalyticsProvider` — критерии 7 и 8 спеки
 * `web-amplitude-analytics-20260916.md`: гидратация сессии из хранилища
 * зовёт `identify`, но не `login`/`signup` (это не её работа — см.
 * `auth-login-analytics.test.tsx`); `signOut` зовёт `reset()` ровно один раз,
 * и не зовёт его вовсе, пока `isLoading === true` (иначе первая отрисовка
 * сбрасывала бы сессию, которая вот-вот станет вошедшей).
 *
 * РЕГРЕССИЯ (код-ревью 2026-09-16): reset() рвёт `device_id` в Amplitude —
 * ровно ту склейку анонимного захода по `?promo=` с последующим `login`,
 * ради которой существует вся воронка марафона. Первая версия звала reset
 * на КАЖДОЙ анонимной загрузке страницы (не только на реальном выходе),
 * потому что гейт был `!signedIn`, а не переход `signedIn → !signedIn`.
 * Обычный анонимный холодный старт не должен звать reset вовсе.
 */

const identifyUser = vi.fn();
const resetAnalytics = vi.fn();
const initAnalytics = vi.fn();
const trackEvent = vi.fn();

vi.mock("@web/lib/analytics", () => ({
  identifyUser: (user: unknown) => identifyUser(user),
  resetAnalytics: () => resetAnalytics(),
  initAnalytics: () => initAnalytics(),
  trackEvent: (name: string, props?: Record<string, unknown>) => trackEvent(name, props),
}));

const PROFILE = {
  id: "u-1",
  email: "",
  fullName: "Дамир",
  phone: "+77018692233",
  city: "Алматы",
  avatarUrl: null,
  createdAt: null,
  birthDate: null,
};

const getMe = vi.fn(async () => PROFILE);

vi.mock("@web/lib/api", () => ({
  authRepository: {
    getMe: () => getMe(),
    refresh: () => Promise.reject(new Error("не нужен")),
  },
  repository: {},
  isApiConfigured: true,
  setApiLanguage: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

const { AuthProvider, useAuth } = await import("@web/lib/auth");
const { AnalyticsProvider } = await import("@web/components/AnalyticsProvider");

function Probe() {
  const { signOut } = useAuth();
  return (
    <button type="button" onClick={signOut}>
      выйти
    </button>
  );
}

function renderTree() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AnalyticsProvider campaignId={null}>
          <Probe />
        </AnalyticsProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  identifyUser.mockClear();
  resetAnalytics.mockClear();
  initAnalytics.mockClear();
  trackEvent.mockClear();
  getMe.mockClear();
  window.localStorage.clear();
});

describe("AnalyticsProvider — гидратация", () => {
  it("сессия в localStorage — identify вызывается, login/signup нет", async () => {
    window.localStorage.setItem("bookeat.web.access_token", "a");
    window.localStorage.setItem("bookeat.web.refresh_token", "r");
    window.localStorage.setItem("bookeat.web.user", JSON.stringify(PROFILE));

    renderTree();

    await waitFor(() => expect(identifyUser).toHaveBeenCalledWith(expect.objectContaining({ id: "u-1" })));
    expect(trackEvent).not.toHaveBeenCalledWith("login", expect.anything());
    expect(trackEvent).not.toHaveBeenCalledWith("signup");
  });

  it("нет сессии — обычный анонимный холодный старт НЕ зовёт reset вовсе", async () => {
    renderTree();

    // Даём эффектам отработать (init должен точно случиться), но reset —
    // не должен: это первая загрузка анонима, не переход из вошедшего
    // состояния. Регрессия 2026-09-16: раньше звался здесь и ротировал
    // device_id на КАЖДОМ анонимном заходе, обрывая склейку воронки.
    await waitFor(() => expect(initAnalytics).toHaveBeenCalled());
    expect(resetAnalytics).not.toHaveBeenCalled();
  });
});

describe("AnalyticsProvider — выход", () => {
  it("signOut зовёт reset() ровно один раз", async () => {
    window.localStorage.setItem("bookeat.web.access_token", "a");
    window.localStorage.setItem("bookeat.web.refresh_token", "r");
    window.localStorage.setItem("bookeat.web.user", JSON.stringify(PROFILE));

    const { getByRole } = renderTree();
    await waitFor(() => expect(identifyUser).toHaveBeenCalled());
    resetAnalytics.mockClear();

    getByRole("button", { name: "выйти" }).click();

    await waitFor(() => expect(resetAnalytics).toHaveBeenCalledTimes(1));
  });
});
