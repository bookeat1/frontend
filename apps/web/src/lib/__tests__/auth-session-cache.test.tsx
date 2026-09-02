import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { FAVORITES_KEY } from "@web/lib/query-keys";

/**
 * Кэш, привязанный к сессии, НЕ ДОЛЖЕН ЕЁ ПЕРЕЖИВАТЬ.
 *
 * Сценарий, ради которого написан тест: у гостя отозвали токен, он видит
 * закрашенные сердца прежнего пользователя; в той же вкладке входит другой
 * человек — и до истечения `staleTime` видит ЧУЖОЕ избранное, а первый же клик
 * шлёт `DELETE` уже от своего имени.
 *
 * Проверяется обе стороны перехода: выход и вход.
 */

const getMe = vi.fn(async () => ({ id: "u-2", name: "Второй" }));

vi.mock("@web/lib/api", () => ({
  authRepository: {
    get getMe() {
      return getMe;
    },
    refresh: vi.fn(),
  },
  repository: {},
  isApiConfigured: true,
  setUnauthorizedHandler: vi.fn(),
  setApiLanguage: vi.fn(),
}));

const { AuthProvider, useAuth } = await import("@web/lib/auth");

function Probe() {
  const { completeSignIn, signOut, signedIn } = useAuth();
  return (
    <div>
      <span data-testid="state">{signedIn ? "in" : "out"}</span>
      <button type="button" onClick={signOut}>
        выйти
      </button>
      <button
        type="button"
        onClick={() =>
          void completeSignIn({
            accessToken: "a",
            refreshToken: "r",
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            isNewUser: false,
          })
        }
      >
        войти
      </button>
    </div>
  );
}

function renderProbe() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  // Кладём избранное «прежнего пользователя» прямо в кэш: как если бы оно
  // приехало запросом минуту назад.
  client.setQueryData(FAVORITES_KEY, new Set(["venue-1"]));
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  window.localStorage.clear();
  getMe.mockClear();
});

describe("кэш и смена сессии", () => {
  it("выход стирает избранное из кэша, а не только из хранилища", async () => {
    const client = renderProbe();
    expect(client.getQueryData(FAVORITES_KEY)).toBeInstanceOf(Set);

    fireEvent.click(screen.getByRole("button", { name: "выйти" }));

    await waitFor(() => expect(client.getQueryData(FAVORITES_KEY)).toBeUndefined());
  });

  it("вход тоже стирает: выйти могли в другой вкладке, а кэш живёт в этой", async () => {
    const client = renderProbe();

    fireEvent.click(screen.getByRole("button", { name: "войти" }));

    await waitFor(() => expect(client.getQueryData(FAVORITES_KEY)).toBeUndefined());
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("in"));
    // И новый гость не унаследовал ни одной записи прежнего.
    expect(client.getQueryData(FAVORITES_KEY)).toBeUndefined();
  });

  it("падение профиля не отменяет вход и не возвращает чужой кэш", async () => {
    // `completeSignIn` намеренно терпит отказ `GET /me`: токены на месте,
    // гость вошёл. Именно из-за этого случая ключ нельзя привязывать к
    // идентификатору гостя — его может не быть.
    getMe.mockRejectedValueOnce(new Error("no profile"));
    const client = renderProbe();

    fireEvent.click(screen.getByRole("button", { name: "войти" }));

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("in"));
    expect(client.getQueryData(FAVORITES_KEY)).toBeUndefined();
  });
});
