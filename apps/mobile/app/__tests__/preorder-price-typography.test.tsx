import type { MenuDish, MenuSection, Restaurant } from "@bookeat/api";
import { typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { atomicStyle } from "../../test/atomic-style";
import PreorderMenuScreen from "../restaurant/[id]/book/menu";
import ConfirmBookingScreen from "../restaurant/[id]/book/confirm";

/**
 * ЦЕНА БЛЮДА НАБРАНА ОДИНАКОВО НА ВСЕХ ЭКРАНАХ.
 *
 * Жалоба владельца (2026-09-02): «в предзаказе цифры, а в меню цифры
 * предзаказа, то есть стоимость снова жирной, нужно сделать как в меню.
 * Везде используется прайс, он должен быть такого же размера как в меню».
 *
 * Эталон задан двумя предыдущими правками — экран меню (PR #102) и карточка
 * ленты (PR #108): `typography.body` (Noto Sans Regular 14/20) +
 * `colors.text.primary` (#1B1B1B). Здесь тот же эталон проверяется на двух
 * экранах флоу брони: наборе предзаказа и подтверждении.
 *
 * ГРАНИЦА, которую держит тест, — не «цена красивая», а три утверждения:
 *   1) цена набрана регулярным 14, а не SemiBold;
 *   2) она весит МЕНЬШЕ названия блюда над ней (иерархия не потеряна);
 *   3) ИТОГ при этом остаётся выделенным — он не должен слиться со строками.
 * Вернёшь `labelSemiBold` цене позиции — падают 1 и 2. Уравняешь итог со
 * строкой — падает 3.
 *
 * Стиль читается через `atomicStyle`, а не `getComputedStyle`: в jsdom
 * последний врёт про шрифт и цвет (см. conventions/bookeat-frontend-testing).
 */

const t = getDictionary("ru");

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ id: "r-1" }),
  usePathname: () => "/restaurant/r-1/book/menu",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ status: "signed-in", user: { name: "Дамир", phone: "+77010000000" } }),
}));

vi.mock("../../src/lib/analytics", () => ({ trackEvent: vi.fn() }));

/** Цена в тийинах, ровно как её отдаёт сервер. */
const RIBEYE: MenuDish = {
  id: "d-1",
  name: "Стейк Рибай",
  description: "Говядина, овощи гриль",
  priceMinor: 899_000,
  imageUrl: null,
  isAvailable: true,
};

const SECTIONS: MenuSection[] = [{ title: "Горячее", dishes: [RIBEYE] }];

vi.mock("../../src/hooks/useBooking", () => ({
  useMenuSections: () => ({ data: SECTIONS, isPending: false, isError: false, refetch: vi.fn() }),
  useCreateBooking: () => ({ mutate: vi.fn(), isPending: false }),
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

/** Корзина существующей брони этому экрану не нужна: он открыт БЕЗ параметра
 * `booking`, то есть читает черновик. Подменяем, чтобы не поднимать сеть. */
vi.mock("../../src/lib/preorder-cart", () => ({
  usePreorderCart: () => ({
    lines: [],
    quantities: new Map<string, number>(),
    setQuantity: vi.fn(),
    clear: vi.fn(),
    save: { mutate: vi.fn(), isPending: false, isError: false },
  }),
}));

const DRAFT_LINE = {
  menuItemId: RIBEYE.id,
  name: RIBEYE.name,
  priceMinor: RIBEYE.priceMinor,
  quantity: 2,
};

vi.mock("../../src/lib/booking-draft", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/booking-draft")>();
  return {
    ...actual,
    useBookingDraft: () => ({
      date: "2026-09-10",
      guests: 2,
      slot: { time: "19:00", startsAt: "2026-09-10T19:00:00+05:00", isAvailable: true },
      name: "Дамир",
      phone: "+77010000000",
      notes: "",
      preorder: [DRAFT_LINE],
      idempotencyKey: "key-1",
      setPreorderQuantity: vi.fn(),
      setSlot: vi.fn(),
      clearPreorder: vi.fn(),
    }),
    useAddDishToPreorder: () => vi.fn(),
  };
});

/**
 * Лист с этой строкой. `getAllByText` отдаёт и обёртки (тот же `textContent`),
 * а стиль лежит на самом `<Text>` — элементе без детей-элементов. Сравнение по
 * `textContent`: в цене неразрывный пробел, который нормализатор Testing
 * Library схлопывает.
 */
function leafWithText(text: string): HTMLElement {
  const leaf = screen
    .getAllByText((_content, element) => element?.textContent === text)
    .find((element) => element.childElementCount === 0);
  expect(leaf).toBeTruthy();
  return leaf as HTMLElement;
}

/** «8 990 ₸» и «17 980 ₸». Неразрывный пробел в исходнике — ТОЛЬКО
 * escape-последовательностью: невидимый символ в коде не вычитывается глазом
 * и ловится eslint (no-irregular-whitespace). */
const PRICE = "8\u00a0990\u00a0₸";
/** Две порции: итог заведомо ОТЛИЧАЕТСЯ от цены строки. Совпади они, тест
 * адресовался бы к двум разным элементам с одинаковым текстом и не доказывал
 * бы ничего. */
const TOTAL = "17\u00a0980\u00a0₸";

describe("экран предзаказа: цена блюда", () => {
  it("набрана регулярным 14, как в меню, а не полужирным", () => {
    render(<PreorderMenuScreen />);

    const price = atomicStyle(leafWithText(PRICE));
    expect(price["font-family"]).toBe(typography.body.fontFamily);
    expect(price["font-size"]).toBe(`${typography.body.fontSize}px`);
    expect(price["color"]).toBe("rgba(27,27,27,1.00)");
  });

  it("весит меньше названия блюда над ней", () => {
    render(<PreorderMenuScreen />);

    const price = atomicStyle(leafWithText(PRICE));
    const name = atomicStyle(leafWithText(RIBEYE.name));
    expect(name["font-family"]).toBe(typography.itemName.fontFamily);
    expect(price["font-family"]).not.toBe(name["font-family"]);
  });

  it("итог к оплате остаётся выделенным и НЕ набран как строка блюда", () => {
    // Итог — это не цена позиции: сравняв их, мы спрячем единственное число,
    // ради которого гость сюда смотрит. Подпись «Итого примерно» на экране
    // есть, значит строка итога отрисована.
    render(<PreorderMenuScreen />);

    expect(leafWithText(t.booking.preorderTotalEstimate)).toBeTruthy();
    const price = atomicStyle(leafWithText(PRICE));
    const total = atomicStyle(leafWithText(TOTAL));
    expect(total["font-family"]).toBe(typography.titleMd.fontFamily);
    expect(total["font-size"]).toBe(`${typography.titleMd.fontSize}px`);
    expect(total["font-family"]).not.toBe(price["font-family"]);
  });
});

describe("экран подтверждения: цена позиции предзаказа", () => {
  it("набрана регулярным 14, как в меню, а не полужирным", () => {
    render(<ConfirmBookingScreen />);

    const price = atomicStyle(leafWithText(PRICE));
    expect(price["font-family"]).toBe(typography.body.fontFamily);
    expect(price["font-size"]).toBe(`${typography.body.fontSize}px`);
    expect(price["color"]).toBe("rgba(27,27,27,1.00)");
  });

  it("весит меньше названия позиции над ней", () => {
    render(<ConfirmBookingScreen />);

    const price = atomicStyle(leafWithText(PRICE));
    const name = atomicStyle(leafWithText(RIBEYE.name));
    expect(name["font-family"]).toBe(typography.itemName.fontFamily);
    expect(price["font-family"]).not.toBe(name["font-family"]);
  });

  it("итог предзаказа в шапке карточки остаётся выделенным", () => {
    render(<ConfirmBookingScreen />);

    const price = atomicStyle(leafWithText(PRICE));
    const total = atomicStyle(leafWithText(TOTAL));
    expect(total["font-family"]).toBe(typography.labelSemiBold.fontFamily);
    expect(total["font-family"]).not.toBe(price["font-family"]);
  });
});
