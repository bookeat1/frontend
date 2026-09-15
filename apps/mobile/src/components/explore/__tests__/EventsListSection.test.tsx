import type { EventPage, EventSummary } from "@bookeat/api";
import { exploreLayout } from "@bookeat/design-tokens";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Блок «Афиша» на главной, макет 3z0f6dgev4HMwBAHPjTjPo, node 3228:9819.
 *
 * Проверяется не «похоже ли на макет» (этого тест не умеет), а три правила,
 * которые ломались на живых данных:
 *  1) событий нет — блока нет вовсе, вместе с заголовком и стрелкой;
 *  2) длинное название не растягивает карточку, а занимает две строки;
 *  3) события без фотографии и без меток рисуются целиком (на бою 25.08.2026
 *     у всех шести ближайших событий `tags: []`, а у одного нет обложки).
 */

const query: {
  data?: EventPage;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
} = { data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() };

vi.mock("../use-explore-data", () => ({
  useExploreEvents: () => query,
}));

const { EventsListSection } = await import("../EventsListSection");

function event(overrides: Partial<EventSummary> = {}): EventSummary {
  return {
    id: "e1",
    restaurantId: "r1",
    title: "Живая музыка",
    description: "",
    startsAt: "2026-05-18T13:00:00Z",
    endsAt: "2026-05-18T16:00:00Z",
    venue: "",
    coverImageUrl: "https://cdn.example/cover.jpg",
    images: [],
    ticketed: false,
    ticketPriceMinor: null,
    capacity: null,
    ticketsRefundable: false,
    ticketRefundCutoffMinutes: 0,
    restaurant: { id: "r1", name: "INZHU", city: "Алматы" },
    tags: [],
    recurrenceId: null,
    ...overrides,
  };
}

function page(items: EventSummary[]): EventPage {
  return { items, total: items.length, page: 1, pages: 1, perPage: 20 };
}

beforeEach(() => {
  query.data = undefined;
  query.isLoading = false;
  query.isError = false;
  query.error = null;
});

describe("«Афиша» на главной", () => {
  it("не рисует блок вовсе, когда ближайших событий нет", () => {
    query.data = page([]);

    const { container } = render(<EventsListSection onOpenEvent={vi.fn()} />);

    // Ни заголовка, ни пустого состояния — как у соседних блоков главной.
    expect(screen.queryByText("Афиша")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("показывает блок, когда события есть", () => {
    query.data = page([event()]);

    render(<EventsListSection onOpenEvent={vi.fn()} />);

    expect(screen.getByText("Афиша")).toBeTruthy();
    expect(screen.getByText("Живая музыка")).toBeTruthy();
    // Дата слева — числом и месяцем заглавными, а не подписью на фотографии.
    expect(screen.getByText("18")).toBeTruthy();
    expect(screen.getByText("МАЙ")).toBeTruthy();
    expect(screen.getByText("INZHU")).toBeTruthy();
  });

  it("длинное название занимает две строки и не растягивает карточку", () => {
    const title = "Живая музыка и авторская европейская кухня на террасе INZHU";
    query.data = page([event({ title })]);

    render(<EventsListSection onOpenEvent={vi.fn()} />);

    // react-native-web переносит numberOfLines в -webkit-line-clamp.
    const heading = screen.getByText(title);
    expect(getComputedStyle(heading).getPropertyValue("-webkit-line-clamp")).toBe("2");
  });

  it("рисует строку целиком, когда у события нет ни обложки, ни меток", () => {
    query.data = page([event({ coverImageUrl: null, tags: [] })]);

    render(<EventsListSection onOpenEvent={vi.fn()} />);

    // Ничего не отвалилось: дата, название и «заведение · время» на месте.
    expect(screen.getByText("18")).toBeTruthy();
    expect(screen.getByText("Живая музыка")).toBeTruthy();
    expect(screen.getByText("INZHU")).toBeTruthy();
  });

  it("показывает не больше одной метки — вторая утащила бы карточку вниз", () => {
    query.data = page([event({ title: "Джаз и коктейли", tags: ["Живая музыка", "Красивый вид", "Бранч"] })]);

    render(<EventsListSection onOpenEvent={vi.fn()} />);

    expect(screen.getByText("Живая музыка")).toBeTruthy();
    expect(screen.queryByText("Красивый вид")).toBeNull();
    expect(screen.queryByText("Бранч")).toBeNull();
  });

  it("держит кадр события 110x104 из макета", () => {
    expect(exploreLayout.eventThumbWidth).toBe(110);
    expect(exploreLayout.eventThumbHeight).toBe(104);
  });
});
