import type { Booking, Restaurant } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Событие отмены брони гостем.
 *
 * Отмен в аналитике не было вовсе: приложение слало «начал бронировать» и
 * «подтвердил», а куда делись брони, которых нет, — не знал никто. Событие
 * отвечает на два вопроса: КТО отменил (это приложение умеет отменять только
 * от лица гостя — отмена рестораном сюда не приходит) и КОГДА относительно
 * создания брони и относительно визита.
 *
 * 🔴 В свойствах нет ни имени, ни телефона гостя, ни его заметки к брони —
 * хотя всё это лежит в самой брони прямо здесь, под рукой.
 */

const t = getDictionary("ru");

const trackEvent = vi.fn();
vi.mock("../../src/lib/analytics", () => ({
  trackEvent: (name: string, props?: Record<string, unknown>) => trackEvent(name, props),
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ id: "b-1" }),
  usePathname: () => "/booking/b-1",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/lib/auth", () => ({ useAuth: () => ({ status: "signed-in" }) }));

// expo-notifications не поднимается в jsdom, а к отмене отношения не имеет.
vi.mock("../../src/lib/push", () => ({
  usePush: () => ({ support: { supported: false }, permission: "denied", request: vi.fn() }),
}));

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getMapPreviewUrl: () => "https://cdn.example/map.png" }),
}));

vi.mock("../../src/hooks/useRestaurant", () => ({
  useRestaurant: () => ({ data: RESTAURANT, isLoading: false, isError: false }),
}));

/** Мутация отмены отвечает так же, как сервер: отменённой бронью. */
const mutate = vi.fn(
  (
    _input: { bookingId: string },
    handlers: { onSuccess: (booking: Booking) => void },
  ) => handlers.onSuccess({ ...booking, status: "cancelled" }),
);

vi.mock("../../src/hooks/useBooking", () => ({
  useBooking: () => ({ data: booking, isLoading: false, isError: false, refetch: vi.fn() }),
  usePreorder: () => ({ data: null, isLoading: false, isError: false }),
  useBookingPayment: () => ({ data: null, isPending: false, isError: false }),
  useCancelBooking: () => ({ mutate, isPending: false }),
}));

const RESTAURANT: Restaurant = {
  id: "r-1",
  name: "Mongol",
  cuisines: [],
  priceLevel: "₸₸",
  rating: 4.8,
  reviewsCount: 12,
  address: "Достык 1",
  city: "Алматы",
  photos: [],
  promoBanners: [],
  menuHighlights: [],
  openingHoursText: "",
  schedule: null,
  tables: [],
  description: "",
  acceptsOnlineBookings: true,
};

const HOUR = 60 * 60 * 1000;

let booking: Booking;

const { default: ReservationScreen } = await import("../booking/[id]/index");

/**
 * Экран брони теперь содержит блок оплаты предзаказа, а он живёт на
 * react-query (создание счёта + опрос состояния). Поэтому рендер экрана
 * требует провайдера — в приложении он стоит в `app/_layout.tsx`, здесь его
 * приходится поднимать вручную.
 */
function withQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

beforeEach(() => {
  trackEvent.mockClear();
  mutate.mockClear();
  booking = {
    id: "b-1",
    restaurantId: "r-1",
    name: "Дамир",
    phone: "+77078692233",
    guests: 2,
    // Визит через сутки — отмена бесплатная, кнопка активна.
    startsAt: new Date(Date.now() + 24 * HOUR).toISOString(),
    endsAt: new Date(Date.now() + 26 * HOUR).toISOString(),
    status: "confirmed",
    notes: "столик у окна для Дамира, звонить на +77078692233",
    freeCancelDeadline: new Date(Date.now() + 20 * HOUR).toISOString(),
    // Бронь завели за трое суток до визита.
    createdAt: new Date(Date.now() - 48 * HOUR).toISOString(),
  };
});

async function cancelFromScreen() {
  render(withQueryClient(<ReservationScreen />));
  fireEvent.click(await screen.findByRole("button", { name: t.booking.cancelBooking }));
  fireEvent.click(await screen.findByRole("button", { name: t.booking.cancelConfirm }));
  await waitFor(() => expect(mutate).toHaveBeenCalled());
}

describe("отмена брони гостем", () => {
  it("отправляет событие с источником отмены и обоими интервалами", async () => {
    await cancelFromScreen();

    expect(trackEvent).toHaveBeenCalledWith(
      "booking_cancel",
      expect.objectContaining({
        restaurant_id: "r-1",
        cancelled_by: "guest",
        status_before: "confirmed",
        was_free: true,
      }),
    );

    const props = trackEvent.mock.calls.find((call) => call[0] === "booking_cancel")?.[1] as {
      hours_since_created: number;
      hours_before_visit: number;
    };
    // Бронь прожила двое суток, до визита оставались сутки.
    expect(props.hours_since_created).toBeCloseTo(48, 0);
    expect(props.hours_before_visit).toBeCloseTo(24, 0);
  });

  it("не кладёт в событие ни имени, ни телефона, ни заметки гостя", async () => {
    await cancelFromScreen();

    const props = JSON.stringify(
      trackEvent.mock.calls.find((call) => call[0] === "booking_cancel")?.[1],
    );
    expect(props).not.toContain("Дамир");
    expect(props).not.toContain("77078692233");
    expect(props).not.toContain("столик у окна");
  });

  it("оставляет интервал пустым, когда сервер не прислал момент создания", async () => {
    booking = { ...booking, createdAt: null };
    await cancelFromScreen();

    const props = trackEvent.mock.calls.find((call) => call[0] === "booking_cancel")?.[1] as {
      hours_since_created: number | null;
    };
    // Именно null: нарисованный ноль неотличим от мгновенной отмены.
    expect(props.hours_since_created).toBeNull();
  });
});
