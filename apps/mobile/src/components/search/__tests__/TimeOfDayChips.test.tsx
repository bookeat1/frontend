import { getDictionary } from "@bookeat/i18n";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { TimeOfDayChips } from "../TimeOfDayChips";

/**
 * Ряд «Утро / День / Вечер».
 *
 * Проверяется то, что легко потерять при переносе между экранами: что «Утро»
 * вообще есть (раньше значений было два), что повторный тап СНИМАЕТ фильтр —
 * иначе выбранное время нечем сбросить, кроме «Сбросить фильтры», — и что
 * подписи берутся из словаря, а не зашиты в компонент.
 */

vi.mock("../../../lib/locale", () => ({
  useLocale: () => ({ locale: "ru", dictionary: getDictionary("ru"), setLocale: vi.fn() }),
}));

const t = getDictionary("ru").search.filters;

describe("чипы времени суток", () => {
  it("показывает три времени суток по ходу дня", () => {
    render(<TimeOfDayChips value={undefined} onChange={vi.fn()} />);

    expect(screen.getByText(t.timeOfDayMorning)).toBeTruthy();
    expect(screen.getByText(t.timeOfDayLunch)).toBeTruthy();
    expect(screen.getByText(t.timeOfDayDinner)).toBeTruthy();
  });

  it("тап по «Утро» выбирает утро", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimeOfDayChips value={undefined} onChange={onChange} />);

    await user.click(screen.getByText(t.timeOfDayMorning));

    expect(onChange).toHaveBeenCalledWith("morning");
  });

  it("повторный тап по выбранному снимает фильтр", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TimeOfDayChips value="morning" onChange={onChange} />);

    await user.click(screen.getByText(t.timeOfDayMorning));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("у каждого чипа своя подпись для скринридера", () => {
    // `accessibilityState={{ selected }}` FilterChip уже проставляет, но
    // react-native-web роли button его в разметку НЕ переносит — проверить
    // «выбранность» в jsdom нечем, она слышна только на устройстве. Поэтому
    // здесь запирается то, что проверяемо: три РАЗНЫЕ подписи, а не три
    // одинаковые кнопки подряд.
    render(<TimeOfDayChips value="dinner" onChange={vi.fn()} />);

    expect(screen.getByLabelText(t.timeOfDayMorning)).toBeTruthy();
    expect(screen.getByLabelText(t.timeOfDayLunch)).toBeTruthy();
    expect(screen.getByLabelText(t.timeOfDayDinner)).toBeTruthy();
  });
});
