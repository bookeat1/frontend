import type { Booking, Restaurant } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReservationScreen from "../booking/[id]/index";

/**
 * Coverage gap found while investigating "cancel button does nothing on a
 * pending booking" (2026-09-23): EVERY existing test for this screen
 * (booking-cancel-analytics, booking-terminal-actions, ...) fully mocks
 * `useBookingPayment` to `{ isPending: false }`, so the real interaction
 * between `useBookingPayment` (gates the button via `cancelReady`) and
 * `useAuth`/`useBooking` was never exercised — that combination was the
 * prime suspect (a disabled `useQuery` reports `isPending: true` forever in
 * TanStack Query v5; `cancelReady = !canCancel || !payment.isPending` would
 * then wedge the button with no hint text, matching the report).
 *
 * These tests use the REAL `useBooking` / `useBookingPayment` / `useCancelBooking`
 * hooks (only the repository is faked) and render through react-native-web,
 * the same pipeline this repo's `apps/mobile` web export uses in production
 * (`deploy/mobile-web-prod`, ADR-046) — so this is the closest thing to a
 * live repro that a unit test can give.
 *
 * RESULT: could not reproduce. Both a clean `getBookingPayment` resolution
 * (404 → null, verified live against test.backend.book-eat.com) and a genuine
 * query error settle `isPending` to `false` and the button becomes enabled
 * within seconds. Kept as a permanent regression guard for this exact gap —
 * see the investigation report for everything else that was ruled out
 * (NULL `booking.user_id` ownership, backend `authorizeTransition`, the
 * live `POST /bookings/:id/cancel` call itself).
 */
const t = getDictionary("ru");

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ id: "b-1" }),
  usePathname: () => "/booking/b-1",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-in", ensureFreshToken: async () => "tok" }),
}));

vi.mock("../../src/lib/push", () => ({
  usePush: () => ({ support: { supported: false }, permission: "denied", request: vi.fn() }),
}));

vi.mock("../../src/hooks/useRestaurant", () => ({
  useRestaurant: () => ({ data: RESTAURANT, isLoading: false, isError: false }),
}));

// REAL useBooking/useBookingPayment/usePreorder/useCancelBooking — only the
// repository underneath is faked, to see how the real hooks behave together.
const getBookingCalls: string[] = [];
const getPaymentCalls: string[] = [];
let paymentBehavior: "null" | "error" = "null";
vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({
    getBooking: async (id: string) => {
      getBookingCalls.push(id);
      return booking;
    },
    getBookingPayment: async (id: string) => {
      getPaymentCalls.push(id);
      if (paymentBehavior === "error") throw new Error("simulated 500");
      // Real backend behaviour verified live: 404 -> null, no deposit/preorder.
      return null;
    },
    getPreorder: async () => ({ bookingId: "b-1", items: [], totalMinor: 0, currency: "KZT" }),
    cancelBooking: async () => ({ ...booking, status: "cancelled" as const }),
    getMapPreviewUrl: () => "https://cdn.example/map.png",
  }),
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
  acceptsOnlinePayment: false,
  paymentMethods: null,
  preorderMinAmountMinor: null,
  serviceFeeBps: null,
};

let booking: Booking;

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReservationScreen />
    </QueryClientProvider>,
  );
}

describe("REPRO: cancel button on a real pending booking, real hooks", () => {
  beforeEach(() => {
    getBookingCalls.length = 0;
    getPaymentCalls.length = 0;
    const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    booking = {
      id: "b-1",
      restaurantId: "r-1",
      name: "Дамир",
      phone: "+77078692233",
      guests: 2,
      startsAt,
      endsAt: startsAt,
      status: "pending",
      notes: null,
      freeCancelDeadline: null,
      createdAt: null,
    };
  });

  it("cancel button becomes enabled (aria-disabled=false) once payment resolves", async () => {
    renderScreen();

    const button = await screen.findByRole("button", { name: t.booking.cancelBooking });
    // Immediately after mount it is plausible the button is still disabled
    // (payment query in flight) — that alone is not the bug.
    await waitFor(
      () => {
        expect(button.getAttribute("aria-disabled")).not.toBe("true");
      },
      { timeout: 3000 },
    );
    expect(getPaymentCalls).toContain("b-1");
    // No hint text should be showing once cancellable and enabled.
    expect(screen.queryByText(t.booking.cancelWindowClosed)).toBeNull();
  });
});

describe("REPRO: cancel button when the payment query itself errors (not 404->null)", () => {
  beforeEach(() => {
    paymentBehavior = "error";
    const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    booking = {
      id: "b-1",
      restaurantId: "r-1",
      name: "Дамир",
      phone: "+77078692233",
      guests: 2,
      startsAt,
      endsAt: startsAt,
      status: "pending",
      notes: null,
      freeCancelDeadline: null,
      createdAt: null,
    };
  });

  it("still becomes enabled after a real payment-query error (500, not 404)", async () => {
    renderScreen();
    const button = await screen.findByRole("button", { name: t.booking.cancelBooking });
    await waitFor(
      () => {
        expect(button.getAttribute("aria-disabled")).not.toBe("true");
      },
      { timeout: 3000 },
    );
  });
});
