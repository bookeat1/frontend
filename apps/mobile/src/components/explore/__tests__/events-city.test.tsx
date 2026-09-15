import type { AuthUser, EventPage, EventQuery } from "@bookeat/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * «Афиша» показывает события ВЫБРАННОГО города, а не все подряд.
 *
 * До этой правки `useExploreEvents` звал `GET /events` вообще без `city`, хотя
 * ручка фильтр поддерживает (`PublicEventFilter.City` — по городу заведения-
 * хозяина), и гость в Астане видел алматинские вечеринки. Отсюда два правила,
 * и второе ломается ровно так же тихо, как первое:
 *
 *  1) город уходит в запрос;
 *  2) город входит в КЛЮЧ кэша. Без него смена города в шапке главной
 *     оставила бы на экране прежнюю, ещё свежую (staleTime 5 минут) страницу
 *     предыдущего города — запроса бы просто не случилось.
 *
 * Один и тот же хук питает блок на главной, экран `/events` и карточку
 * `/event/[id]`, так что проверка на уровне хука накрывает все три.
 */

const listUpcomingEvents = vi.fn<(query?: EventQuery) => Promise<EventPage>>();
const getMe = vi.fn<() => Promise<AuthUser>>();
const authStatus = { value: "signed-in" as "loading" | "signed-out" | "signed-in" };

vi.mock("../../../lib/repository", () => ({
  useRepository: () => ({ listUpcomingEvents }),
}));

vi.mock("../../../lib/auth", () => ({
  useAuth: () => ({ status: authStatus.value, repository: { getMe } }),
}));

vi.mock("../../../lib/locale", async () => {
  const { getDictionary } = await import("@bookeat/i18n");
  return {
    useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
  };
});

const { useExploreEvents } = await import("../use-explore-data");

function pageFor(city: string): EventPage {
  return {
    items: [
      {
        id: `event-in-${city}`,
        restaurantId: "r1",
        title: `Событие в городе ${city}`,
        description: "",
        startsAt: "2026-09-01T13:00:00Z",
        endsAt: "2026-09-01T16:00:00Z",
        venue: "",
        coverImageUrl: null,
        images: [],
        ticketed: false,
        ticketPriceMinor: null,
        capacity: null,
        ticketsRefundable: false,
        ticketRefundCutoffMinutes: 0,
        restaurant: { id: "r1", name: "INZHU", city },
        tags: [],
        recurrenceId: null,
      },
    ],
    total: 1,
    page: 1,
    pages: 1,
    perPage: 12,
  };
}

function user(city: string): AuthUser {
  return {
    id: "u1",
    email: "guest@example.com",
    fullName: "Дамир",
    phone: "+77010000000",
    city,
    avatarUrl: null,
    createdAt: null,
    birthDate: null,
  };
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("«Афиша» и город гостя", () => {
  it("просит у сервера события города из профиля, а не всей страны", async () => {
    listUpcomingEvents.mockImplementation((query) => Promise.resolve(pageFor(query?.city ?? "")));
    const { client, wrapper } = setup();
    // Тот же кэш `["me"]`, что заполняет шапка главной, — своего запроса хук
    // не делает.
    client.setQueryData(["me"], user("Астана"));

    const { result } = renderHook(() => useExploreEvents(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(listUpcomingEvents).toHaveBeenCalledWith(
      expect.objectContaining({ city: "Астана" }),
    );
    expect(result.current.data?.items[0]?.restaurant.city).toBe("Астана");
  });

  it("после смены города переспрашивает — прежняя страница не остаётся на экране", async () => {
    listUpcomingEvents.mockImplementation((query) => Promise.resolve(pageFor(query?.city ?? "")));
    const { client, wrapper } = setup();
    client.setQueryData(["me"], user("Астана"));

    const { result } = renderHook(() => useExploreEvents(), { wrapper });
    await waitFor(() => expect(result.current.data?.items[0]?.id).toBe("event-in-Астана"));

    // Ровно то, что делает выбор города в шапке главной (app/index.tsx):
    // пишет нового пользователя в кэш `["me"]`.
    client.setQueryData(["me"], user("Алматы"));

    await waitFor(() => expect(result.current.data?.items[0]?.id).toBe("event-in-Алматы"));
    expect(listUpcomingEvents).toHaveBeenCalledTimes(2);
    expect(listUpcomingEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ city: "Алматы" }),
    );
  });

  it("не спрашивает события, пока профиль ещё не ответил — иначе мелькнёт чужой город", async () => {
    listUpcomingEvents.mockImplementation((query) => Promise.resolve(pageFor(query?.city ?? "")));
    // Профиль в полёте: город неизвестен, откат на «Алматы» ещё не факт.
    getMe.mockImplementation(() => new Promise<AuthUser>(() => {}));
    const { wrapper } = setup();

    const { result } = renderHook(() => useExploreEvents(), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(listUpcomingEvents).not.toHaveBeenCalled();
  });
});
