import type { Booking, Preorder, Restaurant } from "@bookeat/api";
import { typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { atomicStyle } from "../../test/atomic-style";
import ReservationScreen from "../booking/[id]/index";

/**
 * Карточка брони: состав предзаказа набран той же ценой, что и меню.
 *
 * Часть общей правки 2026-09-02 («прайс везде такого же размера, как в меню»).
 * До неё сумма строки шла `labelMedium` — кегель тот же 14, но начертание
 * Medium, — и на соседних экранах одна и та же цена выглядела по-разному.
 *
 * ГРАНИЦА: строка состава — регулярная 14 (`typography.body`), а строка
 * «Итого примерно» ОСТАЁТСЯ полужирной. Это не непоследовательность: цена
 * позиции и сумма к оплате — разные вещи, и после облегчения строк итог стал
 * единственным выделенным числом карточки. Уравняешь их — второй тест падает.
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

vi.mock("../../src/lib/auth", () => ({ useAuth: () => ({ status: "signed-in" }) }));

vi.mock("../../src/lib/push", () => ({
  usePush: () => ({ support: { supported: false }, permission: "denied", request: vi.fn() }),
}));

vi.mock("../../src/lib/repository", () => ({
  useRepository: () => ({ getMapPreviewUrl: () => "https://cdn.example/map.png" }),
}));

const RESTAURANT = {
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
} as unknown as Restaurant;

vi.mock("../../src/hooks/useRestaurant", () => ({
  useRestaurant: () => ({ data: RESTAURANT, isLoading: false, isError: false }),
}));

const STARTS_AT = new Date(Date.now() + 3 * 24 * 3_600_000).toISOString();

const BOOKING: Booking = {
  id: "b-1",
  restaurantId: "r-1",
  name: "Дамир",
  phone: "+77078692233",
  guests: 2,
  startsAt: STARTS_AT,
  endsAt: STARTS_AT,
  status: "confirmed",
  notes: null,
  freeCancelDeadline: null,
  createdAt: null,
};

/**
 * Две позиции, чтобы ИТОГ (10 980 ₸) не совпал ни с одной строкой: 2 × 4 990 =
 * 9 980 и 1 × 1 000. Совпади итог со строкой, тест адресовался бы к двум
 * элементам с одинаковым текстом и ничего бы не доказывал.
 */
const PREORDER: Preorder = {
  bookingId: "b-1",
  items: [
    {
      id: "pi-1",
      menuItemId: "d-1",
      name: "Бешбармак",
      priceMinor: 499_000,
      quantity: 2,
      totalMinor: 998_000,
      comment: null,
    },
    {
      id: "pi-2",
      menuItemId: "d-2",
      name: "Чай",
      priceMinor: 100_000,
      quantity: 1,
      totalMinor: 100_000,
      comment: null,
    },
  ],
  totalMinor: 1_098_000,
  currency: "KZT",
};

vi.mock("../../src/hooks/useBooking", () => ({
  useBooking: () => ({ data: BOOKING, isLoading: false, isError: false, refetch: vi.fn() }),
  usePreorder: () => ({ data: PREORDER, isLoading: false, isError: false }),
  useBookingPayment: () => ({ data: null, isPending: false, isError: false }),
  useCancelBooking: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../../src/hooks/useKaspiPayment", () => ({
  useKaspiPaymentFlow: () => ({
    phase: "idle",
    payment: null,
    creating: false,
    error: null,
    now: Date.now(),
    pay: vi.fn(),
    renew: vi.fn(),
    check: vi.fn(),
  }),
}));

/** Неразрывный пробел в исходнике — только escape-последовательностью. */
const LINE_TOTAL = "9\u00a0980\u00a0₸";
const GRAND_TOTAL = "10\u00a0980\u00a0₸";

/** Стиль лежит на самом `<Text>`, то есть на элементе без детей-элементов;
 * сравниваем по `textContent`, потому что в цене неразрывный пробел. */
function leafWithText(text: string): HTMLElement {
  const leaf = screen
    .getAllByText((_content, element) => element?.textContent === text)
    .find((element) => element.childElementCount === 0);
  expect(leaf).toBeTruthy();
  return leaf as HTMLElement;
}

describe("состав предзаказа на карточке брони", () => {
  it("сумма строки набрана регулярным 14 и цветом основного текста", async () => {
    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.preorderSummaryTitle)).toBeTruthy());

    const line = atomicStyle(leafWithText(LINE_TOTAL));
    expect(line["font-family"]).toBe(typography.body.fontFamily);
    expect(line["font-size"]).toBe(`${typography.body.fontSize}px`);
    expect(line["color"]).toBe("rgba(27,27,27,1.00)");
  });

  it("«Итого примерно» остаётся полужирным и отличается от строки", async () => {
    render(<ReservationScreen />);
    await waitFor(() => expect(screen.getByText(t.booking.preorderSummaryTitle)).toBeTruthy());

    const line = atomicStyle(leafWithText(LINE_TOTAL));
    const total = atomicStyle(leafWithText(GRAND_TOTAL));
    expect(total["font-family"]).toBe(typography.labelSemiBold.fontFamily);
    expect(total["font-family"]).not.toBe(line["font-family"]);
  });
});
