/**
 * Часы работы заведения: одна строка или дропдаун.
 *
 * Правило (правка владельца 2026-08-26): график, одинаковый во все семь дней,
 * остаётся как был — сводной строкой «Ежедневно с 10:00 до 23:00». График, где
 * дни РАЗНЫЕ, сворачивается в одну строку с шевроном и раскрывается нажатием.
 * До этого семь строк раскрывались всегда и отодвигали контакты и карту за
 * нижний край экрана.
 *
 * Ломается это тихо и в обе стороны: неделя, забывшая свернуться, выглядит как
 * «так и было», а неделя, которая не раскрывается, оставляет гостя вообще без
 * часов по дням.
 */
import type { DayOfWeek, ScheduleDay, VenueSchedule } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { VenueScheduleCard } from "../VenueScheduleCard";

const t = getDictionary();

function day(
  dayOfWeek: DayOfWeek,
  opensAt: string,
  closesAt: string,
): ScheduleDay {
  return { dayOfWeek, isOpen: true, opensAt, closesAt, closesNextDay: false };
}

/** Все семь дней в одни и те же часы. */
const uniform: VenueSchedule = {
  timezone: "Asia/Almaty",
  openNow: true,
  days: ([0, 1, 2, 3, 4, 5, 6] as DayOfWeek[]).map((d) =>
    day(d, "10:00", "23:00"),
  ),
};

/** Будни до 23:00, выходные до 01:00 — обычный график бара. */
const mixed: VenueSchedule = {
  timezone: "Asia/Almaty",
  openNow: true,
  days: ([0, 1, 2, 3, 4, 5, 6] as DayOfWeek[]).map((d) =>
    d === 5 || d === 6 ? day(d, "10:00", "01:00") : day(d, "10:00", "23:00"),
  ),
};

const mount = (schedule: VenueSchedule) =>
  render(<VenueScheduleCard schedule={schedule} openingHoursText="" />);

describe("VenueScheduleCard — одинаковые дни", () => {
  it("остаются одной сводной строкой, без шеврона и без дропдауна", () => {
    mount(uniform);

    expect(
      screen.getByText(t.restaurant.schedule.everyDay("10:00", "23:00")),
    ).toBeTruthy();
    expect(screen.queryByText(t.restaurant.schedule.byDayTitle)).toBeNull();
    expect(
      screen.queryByRole("button", { name: t.restaurant.schedule.byDayExpand }),
    ).toBeNull();
  });
});

describe("VenueScheduleCard — разные дни", () => {
  it("свёрнуты: видна одна строка с шевроном, дней недели на экране нет", () => {
    mount(mixed);

    expect(screen.getByText(t.restaurant.schedule.byDayTitle)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: t.restaurant.schedule.byDayExpand }),
    ).toBeTruthy();
    // Ни одного названия дня: неделя действительно спрятана, а не просто
    // сдвинута за край.
    for (const weekday of Object.values(t.weekdays)) {
      expect(screen.queryByText(weekday)).toBeNull();
    }
  });

  it("статус «сейчас» остаётся виден и в свёрнутом виде", () => {
    // Свёртка прячет разбивку, а не главное: «до скольких сегодня» гость
    // читает не раскрывая.
    mount(mixed);
    expect(screen.getByText(t.restaurant.openUntil("23:00"))).toBeTruthy();
  });

  it("нажатие раскрывает все семь дней, повторное — снова прячет", () => {
    mount(mixed);

    fireEvent.click(
      screen.getByRole("button", { name: t.restaurant.schedule.byDayExpand }),
    );

    for (const weekday of Object.values(t.weekdays)) {
      expect(screen.getByText(weekday)).toBeTruthy();
    }
    // Разные часы обеих групп дней действительно показаны.
    expect(
      screen.getAllByText(t.restaurant.schedule.range("10:00", "23:00")).length,
    ).toBe(5);
    expect(
      screen.getAllByText(t.restaurant.schedule.range("10:00", "01:00")).length,
    ).toBe(2);

    const collapse = screen.getByRole("button", {
      name: t.restaurant.schedule.byDayCollapse,
    });
    fireEvent.click(collapse);
    expect(screen.queryByText(t.weekdays.mon)).toBeNull();
  });

  it("сообщает скринридеру своё состояние, а не только рисует шеврон", () => {
    mount(mixed);

    const toggle = screen.getByRole("button", {
      name: t.restaurant.schedule.byDayExpand,
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    const collapsed = screen.getByRole("button", {
      name: t.restaurant.schedule.byDayCollapse,
    });
    expect(collapsed.getAttribute("aria-expanded")).toBe("true");
  });
});
