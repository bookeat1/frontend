import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { readBookingFormDraft, writeBookingFormDraft } from "@web/lib/booking-form-draft";
import { BOOKING_KEY, FAVORITES_KEY } from "@web/lib/query-keys";

/**
 * Кэш, привязанный к сессии, НЕ ДОЛЖЕН ЕЁ ПЕРЕЖИВАТЬ.
 *
 * Сценарий, ради которого написан тест: у гостя отозвали токен, он видит
 * закрашенные сердца прежнего пользователя; в той же вкладке входит другой
 * человек — и до истечения `staleTime` видит ЧУЖОЕ избранное, а первый же клик
 * шлёт `DELETE` уже от своего имени.
 *
 * Проверяется обе стороны перехода: выход и вход.
 *
 * То же самое — для брони (`/bookings/<id>` лежит в истории вкладки, а в
 * билете печатается телефон) и для черновика формы брони в `sessionStorage`
 * (он сильнее профиля следующего гостя, см. `clearAllBookingFormDrafts`).
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

const BOOKING_ID = "a1b2c3d4-0000-4000-8000-000000000001";
const DRAFT = { name: "Гость А", phoneDigits: "7010000000", email: "a@example.kz", notes: "", wishes: [] };

function renderProbe() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  // Кладём избранное «прежнего пользователя» прямо в кэш: как если бы оно
  // приехало запросом минуту назад.
  client.setQueryData(FAVORITES_KEY, new Set(["venue-1"]));
  // И его бронь с телефоном — как после `createBooking` (см. queries.ts).
  client.setQueryData([...BOOKING_KEY, BOOKING_ID], { id: BOOKING_ID, phone: "+77010000000" });
  // И его недописанную форму брони.
  writeBookingFormDraft("venue-1", DRAFT);
  writeBookingFormDraft("venue-2", DRAFT);
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
  window.sessionStorage.clear();
  getMe.mockClear();
});

describe("кэш и смена сессии", () => {
  it("выход стирает избранное из кэша, а не только из хранилища", async () => {
    const client = renderProbe();
    expect(client.getQueryData(FAVORITES_KEY)).toBeInstanceOf(Set);

    fireEvent.click(screen.getByRole("button", { name: "выйти" }));

    await waitFor(() => expect(client.getQueryData(FAVORITES_KEY)).toBeUndefined());
  });

  it("выход стирает бронь прежнего гостя: «Назад» на /bookings/<id> не покажет его билет", async () => {
    const client = renderProbe();
    expect(client.getQueryData([...BOOKING_KEY, BOOKING_ID])).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "выйти" }));

    await waitFor(() => expect(client.getQueryData([...BOOKING_KEY, BOOKING_ID])).toBeUndefined());
  });

  it("вход стирает бронь прежнего гостя из кэша этой вкладки", async () => {
    const client = renderProbe();

    fireEvent.click(screen.getByRole("button", { name: "войти" }));

    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("in"));
    expect(client.getQueryData([...BOOKING_KEY, BOOKING_ID])).toBeUndefined();
  });

  it("выход и вход стирают черновики формы брони ВСЕХ заведений", async () => {
    renderProbe();
    expect(readBookingFormDraft("venue-1")?.phoneDigits).toBe("7010000000");

    fireEvent.click(screen.getByRole("button", { name: "выйти" }));
    await waitFor(() => expect(readBookingFormDraft("venue-1")).toBeNull());
    expect(readBookingFormDraft("venue-2")).toBeNull();

    // Снова «чужой» черновик — как если бы выход случился в другой вкладке.
    writeBookingFormDraft("venue-1", DRAFT);
    fireEvent.click(screen.getByRole("button", { name: "войти" }));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("in"));
    expect(readBookingFormDraft("venue-1")).toBeNull();
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
