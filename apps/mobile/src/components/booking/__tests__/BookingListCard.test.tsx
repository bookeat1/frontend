import type { Booking, RestaurantSummary } from "@bookeat/api";
import { colors, typography } from "@bookeat/design-tokens";
import { render, screen, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { atomicStyle } from "../../../../test/atomic-style";

/**
 * Карточка брони в списке (Figma 3z0f6dgev4HMwBAHPjTjPo: активная — node
 * 3589:8205 → 3589:8231, прошедшая — node 3589:8370 → 3589:8529).
 *
 * Перерисована 2026-09-01: была серая плашка со снимком 64×64 и пилюлей
 * статуса в углу, стала карточка-снимок с фактами в стеклянных пилюлях.
 * Тесты держат ТРИ границы, которые ломаются молча:
 *
 *  1. ответ `GET /bookings` не несёт ни названия, ни адреса — сводка пришла,
 *     значит адрес есть; не пришла, значит адреса НЕТ, а не выдуманный;
 *  2. видимой подписи статуса на карточке больше нет, поэтому статус ОБЯЗАН
 *     звучать в метке: иначе отменённая бронь для скринридера ничем не
 *     отличается от подтверждённой;
 *  3. два вида карточки — разные: у активной есть цветная полоса статуса и
 *     строка «кухня · чек», у прошедшей нет ни того, ни другого.
 */

const summaryState: { data?: RestaurantSummary; isError: boolean } = { isError: false };

vi.mock("../../../hooks/useRestaurant", () => ({
  useRestaurantSummary: () => summaryState,
}));

const { BookingListCard } = await import("../BookingListCard");

const VENUE: RestaurantSummary = {
  id: "r-1",
  name: "Flour Demi",
  cuisines: [{ id: "c-1", name: "Европейская" }],
  priceLevel: "₸₸",
  rating: 4.8,
  reviewsCount: 120,
  address: "проспект Аль-Фараби, 128В",
  description: "",
  schedule: null,
  acceptsOnlineBookings: true,
};

const BOOKING: Booking = {
  id: "b-1",
  restaurantId: "r-1",
  name: "Дамир",
  phone: "+77010000000",
  guests: 2,
  startsAt: "2026-07-29T15:30:00Z",
  endsAt: "2026-07-29T17:30:00Z",
  status: "pending",
  notes: null,
  freeCancelDeadline: null,
  createdAt: null,
};

beforeEach(() => {
  summaryState.data = VENUE;
  summaryState.isError = false;
});

/** Внешняя рамка карточки — она же полоса статуса, когда та есть. */
function outerFrame(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

describe("BookingListCard — данные", () => {
  it("ставит название и время в одну строку, а кухню с чеком — под неё", () => {
    render(<BookingListCard booking={BOOKING} onPress={vi.fn()} />);

    expect(screen.getByText("Flour Demi · 29 июля, 20:30")).toBeDefined();
    expect(screen.getByText("Европейская · ₸₸")).toBeDefined();
    expect(screen.getByText("2 гостя")).toBeDefined();
    expect(screen.getByText("проспект Аль-Фараби, 128В")).toBeDefined();
  });

  it("не рисует адрес, пока сводка о заведении не пришла", () => {
    summaryState.data = undefined;

    render(<BookingListCard booking={BOOKING} onPress={vi.fn()} />);

    // Гости всё равно известны — они лежат в самой брони.
    expect(screen.getByText("2 гостя")).toBeDefined();
    expect(screen.queryByTestId("icon-MapPin")).toBeNull();
    expect(screen.getByText(/Загружаем название…/)).toBeDefined();
  });

  it("на упавшей сводке говорит об этом, а не подставляет пустой адрес", () => {
    summaryState.data = undefined;
    summaryState.isError = true;

    render(<BookingListCard booking={BOOKING} onPress={vi.fn()} />);

    expect(screen.getByText(/Название ресторана не загрузилось/)).toBeDefined();
    expect(screen.queryByTestId("icon-MapPin")).toBeNull();
  });

  it("открывает бронь по нажатию", () => {
    const onPress = vi.fn();
    render(<BookingListCard booking={BOOKING} onPress={onPress} />);

    screen.getByRole("button").click();

    expect(onPress).toHaveBeenCalledWith("b-1");
  });
});

describe("BookingListCard — статус", () => {
  it("называет статус в метке карточки, раз подписи на ней больше нет", () => {
    render(<BookingListCard booking={BOOKING} onPress={vi.fn()} />);

    const label = screen.getByRole("button").getAttribute("aria-label") ?? "";
    expect(label).toContain("Статус: Ждёт подтверждения");
  });

  it("отменённая бронь не выдаёт себя за ожидающую", () => {
    render(<BookingListCard booking={{ ...BOOKING, status: "cancelled" }} onPress={vi.fn()} />);

    const label = screen.getByRole("button").getAttribute("aria-label") ?? "";
    expect(label).toContain("Статус: Отменена");
    expect(label).not.toContain("Ждёт подтверждения");
  });

  it("красит полосу под карточкой в жёлтый у ожидающей и в зелёный у подтверждённой", () => {
    const pending = render(<BookingListCard booking={BOOKING} onPress={vi.fn()} />);
    expect(atomicStyle(outerFrame(pending.container))["background-color"]).toBe(
      cssColor(colors.status.stripPending),
    );

    const confirmed = render(
      <BookingListCard booking={{ ...BOOKING, status: "confirmed" }} onPress={vi.fn()} />,
    );
    expect(atomicStyle(outerFrame(confirmed.container))["background-color"]).toBe(
      cssColor(colors.status.stripPositive),
    );
  });
});

describe("BookingListCard — вид «История»", () => {
  it("не рисует ни полосы статуса, ни строки «кухня · чек»", () => {
    const { container } = render(
      <BookingListCard booking={BOOKING} variant="past" onPress={vi.fn()} />,
    );

    // Внешняя рамка прошедшей брони — сама кнопка-карточка, а не полоса:
    // цветной подложки под ней в макете нет.
    expect(outerFrame(container).getAttribute("role")).toBe("button");
    // Своей заливки у рамки нет — только прозрачный фон базового класса.
    expect(outerFrame(container).style.backgroundColor).toBe("");
    expect(screen.queryByText("Европейская · ₸₸")).toBeNull();
    // Название и время остаются — без них строка списка бесполезна.
    expect(screen.getByText("Flour Demi · 29 июля, 20:30")).toBeDefined();
  });

  it("ниже активной карточки", () => {
    const active = render(<BookingListCard booking={BOOKING} onPress={vi.fn()} />);
    const activeHeight = getComputedStyle(within(active.container).getByRole("button")).height;

    const past = render(<BookingListCard booking={BOOKING} variant="past" onPress={vi.fn()} />);
    const pastHeight = getComputedStyle(within(past.container).getByRole("button")).height;

    expect(activeHeight).toBe("170px");
    expect(pastHeight).toBe("93px");
  });
});

describe("BookingListCard — типографика", () => {
  it("набирает заголовок основной гарнитурой, а не засечным курсивом карточки каталога", () => {
    render(<BookingListCard booking={BOOKING} onPress={vi.fn()} />);

    const title = screen.getByText("Flour Demi · 29 июля, 20:30");
    const style = atomicStyle(title);

    expect(style["font-family"]).toBe(typography.bookingCardTitle.fontFamily);
    expect(style["font-size"]).toBe(`${typography.bookingCardTitle.fontSize}px`);
    expect(style["font-family"]).not.toBe(typography.displayCard.fontFamily);
  });
});

/** `#22CB87` → `rgb(34, 203, 135)`: так jsdom нормализует inline-цвет. */
function cssColor(hex: string): string {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}
