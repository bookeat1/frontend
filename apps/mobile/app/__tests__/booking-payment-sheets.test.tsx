import type { Booking, MenuSection, Preorder } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PaymentErrorScreen from "../booking/[id]/payment-error";
import PaymentSuccessScreen from "../booking/[id]/payment-success";

/** Шторки «Предзаказ оплачен» (Figma 5390:8698) и «Оплата не прошла» (5390:9142). */

const t = getDictionary("ru");
const replace = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ id: "b-1" }),
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const preorder: Preorder = {
  bookingId: "b-1",
  items: [
    { id: "pi-1", menuItemId: "d-1", name: "Бешбармак", priceMinor: 499_000, quantity: 2, totalMinor: 998_000, comment: null },
    { id: "pi-2", menuItemId: null, name: "Ручная позиция", priceMinor: 100_000, quantity: 1, totalMinor: 100_000, comment: null },
  ],
  totalMinor: 1_098_000,
  currency: "KZT",
};
const menu: MenuSection[] = [
  {
    title: "Горячее",
    dishes: [
      { id: "d-1", name: "Бешбармак", description: "Конина, лапша, бульон", priceMinor: 499_000, imageUrl: null, isAvailable: true, portionSize: null },
    ],
  },
];

vi.mock("../../src/hooks/useBooking", () => ({
  useBooking: () => ({ data: { id: "b-1", restaurantId: "r-1" } as Booking, isPending: false }),
  usePreorder: () => ({ data: preorder, isPending: false }),
  useMenuSections: () => ({ data: menu }),
}));

beforeEach(() => replace.mockClear());

describe("шторка «Предзаказ оплачен»", () => {
  it("заголовок, текст, строки с описанием и бейджем количества, кнопка ведёт на бронь", () => {
    render(<PaymentSuccessScreen />);
    expect(screen.getByText(t.booking.paymentPaidTitle)).toBeTruthy();
    expect(screen.getByText(t.booking.paymentSuccessSubtitle)).toBeTruthy();
    expect(screen.getByText("Бешбармак")).toBeTruthy();
    expect(screen.getByText("Конина, лапша, бульон")).toBeTruthy();
    expect(screen.getByLabelText("× 2")).toBeTruthy();
    // Позиция, добавленная вручную кабинетом, не ломает список: без описания.
    expect(screen.getByText("Ручная позиция")).toBeTruthy();
    screen.getByRole("button", { name: t.booking.paymentSuccessAction }).click();
    expect(replace).toHaveBeenCalledWith({ pathname: "/booking/[id]", params: { id: "b-1" } });
  });
});

describe("шторка «Оплата не прошла»", () => {
  it("две кнопки: повторить ведёт на оплату, вернуться — на бронь", () => {
    render(<PaymentErrorScreen />);
    expect(screen.getByText(t.booking.paymentFailedTitle)).toBeTruthy();
    expect(screen.getByText(t.booking.paymentFailedText)).toBeTruthy();
    screen.getByRole("button", { name: t.booking.paymentFailedRetry }).click();
    expect(replace).toHaveBeenLastCalledWith({ pathname: "/booking/[id]/payment", params: { id: "b-1" } });
    screen.getByRole("button", { name: t.booking.paymentFailedBackToBooking }).click();
    expect(replace).toHaveBeenLastCalledWith({ pathname: "/booking/[id]", params: { id: "b-1" } });
  });
});
