import type { AuthUser, EventPage, EventQuery } from "@bookeat/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * `sort=for_you` (персонализация v1, `specs/foodie-personalization-v1-20260916.md`
 * BE-4, критерий 25) — ЕДИНСТВЕННАЯ разница между полосой «Афиша» на главной
 * (`EventsListSection`, `useExploreEvents({forYou:true})`) и полным экраном
 * `/events` (`events.tsx`, без опции). Проверяется здесь на уровне хука —
 * EventsListSection.test.tsx уже проверяет, что секция передаёт `forYou: true`
 * дальше в хук; этот файл проверяет, что хук из этого делает правильный
 * запрос и правильный ключ кэша.
 */

const listUpcomingEvents = vi.fn<(query?: EventQuery) => Promise<EventPage>>();
const getMe = vi.fn<() => Promise<AuthUser>>();

vi.mock("../../../lib/repository", () => ({
  useRepository: () => ({ listUpcomingEvents }),
}));

vi.mock("../../../lib/auth", () => ({
  useAuth: () => ({ status: "signed-out", repository: { getMe } }),
}));

vi.mock("../../../lib/locale", async () => {
  const { getDictionary } = await import("@bookeat/i18n");
  return {
    useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
  };
});

const { useExploreEvents } = await import("../use-explore-data");

function emptyPage(): EventPage {
  return { items: [], total: 0, page: 1, pages: 1, perPage: 12 };
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("useExploreEvents — sort=for_you только когда явно попросили", () => {
  it("EventsListSection (forYou: true) — sort=for_you уходит в запрос", async () => {
    listUpcomingEvents.mockResolvedValue(emptyPage());
    const { wrapper } = setup();

    renderHook(() => useExploreEvents({ forYou: true }), { wrapper });

    await waitFor(() => expect(listUpcomingEvents).toHaveBeenCalled());
    expect(listUpcomingEvents).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "for_you" }),
    );
  });

  it("events.tsx (без опции) — sort не уходит вовсе", async () => {
    listUpcomingEvents.mockResolvedValue(emptyPage());
    const { wrapper } = setup();

    renderHook(() => useExploreEvents(), { wrapper });

    await waitFor(() => expect(listUpcomingEvents).toHaveBeenCalled());
    const [query] = listUpcomingEvents.mock.calls[0];
    expect(query?.sort).toBeUndefined();
  });

  it("разные ключи кэша — выбор sort одной полки не красит другую", async () => {
    listUpcomingEvents.mockResolvedValue(emptyPage());
    const { client, wrapper } = setup();

    renderHook(() => useExploreEvents({ forYou: true }), { wrapper });
    renderHook(() => useExploreEvents(), { wrapper });

    await waitFor(() => expect(listUpcomingEvents).toHaveBeenCalledTimes(2));
    const keys = client.getQueryCache().getAll().map((q) => q.queryKey);
    // Оба ключа корня "explore-events" присутствуют, и они РАЗНЫЕ.
    const eventsKeys = keys.filter((k) => k[0] === "explore-events");
    expect(eventsKeys).toHaveLength(2);
    expect(eventsKeys[0]).not.toEqual(eventsKeys[1]);
  });
});
