import type { DayAvailability, Restaurant } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingDraftProvider } from "../../src/lib/booking-draft";
import ReservationScreen from "../restaurant/[id]/book/index";

/**
 * НЕАКТИВНАЯ «Продолжить» ОБЯЗАНА СКАЗАТЬ, ЧЕГО НЕ ХВАТАЕТ.
 *
 * Что чинится (жалоба владельца, 2026-08-27): он заполнил предзаказ, увидел
 * мёртвую кнопку внизу и решил, что сломан предзаказ. На самом деле не было
 * выбрано время — сетка слотов осталась выше, за краем прокрутки, и экран об
 * этом молчал.
 *
 * Проверяются три исхода, потому что делать в них надо разное: время не
 * выбрано (выбрать), свободного времени в этот день нет вовсе (взять другой
 * день) и время выбрано (никакой строки, кнопка живая).
 */

const t = getDictionary("ru");

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ id: "r-1" }),
  usePathname: () => "/restaurant/r-1/book",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-in", user: null }),
}));

vi.mock("../../src/lib/analytics", () => ({ trackEvent: vi.fn() }));

const RESTAURANT = {
  id: "r-1",
  name: "Тестовое заведение",
  address: "ул. Абая, 1",
  acceptsOnlineBookings: true,
  menuHighlights: [],
  schedule: null,
} as unknown as Restaurant;

vi.mock("../../src/hooks/useRestaurant", () => ({
  useRestaurant: () => ({ data: RESTAURANT, isLoading: false, isError: false }),
}));

/** Ответ о доступности, который подставляется в каждом тесте отдельно. */
let availability: { data?: DayAvailability; isPending: boolean; isError: boolean };

vi.mock("../../src/hooks/useBooking", () => ({
  useAvailability: () => ({ ...availability, refetch: vi.fn() }),
}));

function slot(startsAt: string, available: boolean) {
  return { startsAt, endsAt: startsAt, available, freeTables: available ? 2 : 0 };
}

/** День со свободным вечером. */
const FREE_DAY = {
  data: {
    slots: [slot("2026-08-27T19:00:00+05:00", true), slot("2026-08-27T20:00:00+05:00", true)],
  } as unknown as DayAvailability,
  isPending: false,
  isError: false,
};

/** День, где сервер слоты дал, но свободных среди них нет ни одного. */
const FULL_DAY = {
  data: {
    slots: [slot("2026-08-27T19:00:00+05:00", false), slot("2026-08-27T20:00:00+05:00", false)],
  } as unknown as DayAvailability,
  isPending: false,
  isError: false,
};

function renderBooking() {
  return render(
    <BookingDraftProvider restaurantId="r-1" prefill={{}}>
      <ReservationScreen />
    </BookingDraftProvider>,
  );
}

/** Кнопка «Продолжить» внизу экрана. */
function continueButton(): HTMLElement {
  return screen.getByRole("button", { name: t.booking.continueToConfirm });
}

beforeEach(() => {
  availability = FREE_DAY;
});

describe("почему «Продолжить» неактивна", () => {
  it("время не выбрано — под кнопкой сказано «Выберите время»", () => {
    renderBooking();

    expect(continueButton().getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(t.booking.continueNeedsSlot)).toBeTruthy();
    // `accessibilityHint` кнопки здесь НЕ проверяется: react-native-web его
    // просто выбрасывает (это нативное понятие VoiceOver/TalkBack), и в jsdom
    // от него не остаётся ни атрибута, ни следа. Проверяется он только на
    // устройстве.
  });

  it("выбранное время убирает и подпись, и запрет", async () => {
    renderBooking();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "19:00" }));

    expect(screen.queryByText(t.booking.continueNeedsSlot)).toBeNull();
    expect(continueButton().getAttribute("aria-disabled")).not.toBe("true");
  });

  it("свободного времени в этот день нет — сказано именно это, а не «выберите время»", () => {
    availability = FULL_DAY;
    renderBooking();

    expect(screen.getByText(t.booking.continueNoSlots)).toBeTruthy();
    expect(screen.queryByText(t.booking.continueNeedsSlot)).toBeNull();
  });

  it("пока слоты грузятся, причину не выдумываем", () => {
    availability = { data: undefined, isPending: true, isError: false };
    renderBooking();

    expect(screen.queryByText(t.booking.continueNeedsSlot)).toBeNull();
    expect(screen.queryByText(t.booking.continueNoSlots)).toBeNull();
  });
});
