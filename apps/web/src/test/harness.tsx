import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import type {
  AvailabilitySlot,
  Booking,
  DayAvailability,
  Restaurant,
  RestaurantRepository,
  RestaurantSummary,
} from "@bookeat/api/client";

import { CityProvider } from "@web/lib/city";
import { LocaleProvider } from "@web/lib/locale";

/**
 * Обвязка для тестов экранов.
 *
 * Экран — это провайдеры (кэш запросов, язык, город) плюс репозиторий. Каждый
 * тест, который поднимает это сам, рано или поздно поднимает НЕ ТО (свой
 * QueryClient с ретраями, из-за которого «ошибка сети» проверяется четыре
 * секунды). Поэтому сборка одна и живёт здесь.
 */
export function renderScreen(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        // Ноль повторов: тест на состояние ошибки не должен ждать ретраев.
        retry: false,
        // Запросы, которые задают повтор САМИ (страница заведения повторяет
        // всё, кроме 404), иначе ждали бы экспоненциальную паузу, и «ошибка
        // сети» появлялась бы уже после того, как тест сдался.
        retryDelay: 0,
        gcTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <CityProvider>{ui}</CityProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

/** Никогда не отвечающий промис — им изображается «запрос ещё летит». */
export function pending<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

/** Заглушка заведения в выдаче: ровно те поля, что читает вёрстка. */
export function venueSummary(overrides: Partial<RestaurantSummary> = {}): RestaurantSummary {
  return {
    id: "venue-1",
    name: "Flour Demi",
    cuisines: [{ id: "european", name: "Европейская" }],
    priceLevel: "₸₸₸",
    rating: 4.6,
    reviewsCount: 312,
    address: "Проспект Аль-Фараби, 128В",
    // Город обязателен у RestaurantSummary с 01.09.2026: карточка подборки
    // Ocean Basket печатает его над названием. Без него typecheck красный на
    // всём монорепозитории, а не только в тесте, который эту заглушку читает.
    city: "Алматы",
    description: "Современный ресторан с авторской кухней.",
    schedule: null,
    acceptsOnlineBookings: true,
    ...overrides,
  };
}

export function venueDetail(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    ...venueSummary(),
    city: "Алматы",
    photos: [],
    promoBanners: [],
    menuHighlights: [],
    tables: [],
    openingHoursText: "",
    ...overrides,
  } as Restaurant;
}

/**
 * Один слот выдачи доступности. По умолчанию свободный: недоступность — это
 * то, что тест заявляет ЯВНО, вместе с причиной, потому что причин четыре и
 * экран отвечает на них по-разному.
 */
export function slot(overrides: Partial<AvailabilitySlot> = {}): AvailabilitySlot {
  return {
    startsAt: "2026-08-25T19:30:00+05:00",
    endsAt: "2026-08-25T21:00:00+05:00",
    available: true,
    freeTables: 2,
    reason: null,
    ...overrides,
  };
}

/** Ответ `GET /restaurants/:id/availability` на один день. */
export function dayAvailability(overrides: Partial<DayAvailability> = {}): DayAvailability {
  return {
    restaurantId: "venue-1",
    date: "2026-08-25",
    timezone: "Asia/Almaty",
    guests: 2,
    durationMinutes: 90,
    slots: [slot()],
    ...overrides,
  };
}

/** Бронь, какой её возвращает `POST /bookings`: `startsAt` в UTC, как и у
 * настоящего сервера — экран обязан НЕ печатать её как стенные часы. */
export function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "booking-1",
    restaurantId: "venue-1",
    name: "Дамир",
    phone: "+77010000000",
    guests: 2,
    startsAt: "2026-08-25T14:30:00Z",
    endsAt: "2026-08-25T16:00:00Z",
    status: "pending",
    notes: null,
    freeCancelDeadline: null,
    createdAt: null,
    ...overrides,
  };
}

/**
 * Репозиторий целиком из `vi.fn()`. Экран может дёрнуть любой метод — тест
 * подменяет только те, которые ему интересны, а остальные не падают с
 * «is not a function» и не уводят разбор в сторону.
 */
export function repositoryStub(
  overrides: Partial<RestaurantRepository> = {},
): RestaurantRepository {
  const base = {
    getCities: vi.fn(async () => ["Алматы"]),
    getCuisines: vi.fn(async () => []),
    getAmenities: vi.fn(async () => []),
    getRecommendedRestaurants: vi.fn(async () => []),
    getPromotions: vi.fn(async () => []),
    listUpcomingEvents: vi.fn(async () => ({ items: [], total: 0, page: 1, pages: 0, perPage: 3 })),
    getGuideCollections: vi.fn(async () => []),
    searchRestaurants: vi.fn(async (query) => ({ query, items: [], total: 0 })),
    getRestaurant: vi.fn(async () => venueDetail()),
    getMapPreviewUrl: vi.fn(() => undefined),
    // Избранное. Стоит здесь, а не только в тестах страницы заведения: экран
    // спрашивает его сам, и тест «кнопка не ходила в сеть» должен иметь что
    // проверять.
    getFavorites: vi.fn(async () => [] as RestaurantSummary[]),
    addFavorite: vi.fn(async () => {}),
    removeFavorite: vi.fn(async () => {}),
    // Бронь. Карточка в правой колонке страницы заведения спрашивает
    // доступность сама, и тест «запроса не было» должен иметь что проверять.
    getAvailability: vi.fn(async () => dayAvailability()),
    createBooking: vi.fn(async () => booking()),
    // Страница «Бронь подтверждена» читает бронь по адресу, режим переноса
    // (`?change=`) на странице бронирования зовёт `PATCH /bookings/:id`.
    getBooking: vi.fn(async () => booking()),
    rescheduleBooking: vi.fn(async () => booking()),
  };
  return { ...base, ...overrides } as unknown as RestaurantRepository;
}
