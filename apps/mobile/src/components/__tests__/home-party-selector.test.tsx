import { getDictionary } from "@bookeat/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PartySelector } from "../explore/PartySelector";
import { toDateKey } from "../../lib/format";

/**
 * Капсула «дата · гости» на главной: выбор происходит ЗДЕСЬ, нижней шторкой.
 *
 * Что чинится этим тестом:
 *   1. (правка владельца 2026-08-26) тап по половине капсулы уводил на
 *      отдельный экран — в `/search?focus=date`, где немедленно раскрывалась
 *      шторка фильтров. Такого экрана в дизайне нет вовсе, а нагруженная
 *      панель фильтров пугает человека, который назвал всего лишь день.
 *   2. (правка владельца 2026-08-27) половины поднимали ДВЕ разные шторки, по
 *      одному колесу в каждой. В макете (node 3447:13024) это ОДНА шторка
 *      «Дата и гости» с двумя колёсами рядом, и подтверждение в ней одно.
 *
 * Поэтому проверяем:
 *   1. тап по ЛЮБОЙ половине поднимает ОДНУ и ту же шторку с обоими колёсами
 *      и НИЧЕГО не сообщает наверх — переход в каталог на этом шаге не должен
 *      случиться даже случайно;
 *   2. «Показать заведения» отдаёт ПАРУ «дата + гости»;
 *   3. крестик закрывает шторку, ничего не применив.
 */

const t = getDictionary("ru");

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock("../../lib/locale", async () => {
  const { getDictionary: dict } = await import("@bookeat/i18n");
  return {
    useLocale: () => ({ locale: "ru", dictionary: dict("ru"), setLocale: vi.fn() }),
  };
});

function renderSelector(onSearchParty = vi.fn()) {
  render(
    <PartySelector
      dateValue={t.booking.today}
      guestsValue={t.booking.guestsCount(2)}
      onSearchParty={onSearchParty}
    />,
  );
  return onSearchParty;
}

const dateHalf = () =>
  screen.getByRole("button", {
    name: `${t.explore.dateSelectorLabel}: ${t.booking.today}`,
  });
const guestsHalf = () =>
  screen.getByRole("button", {
    name: `${t.explore.guestsSelectorLabel}: ${t.booking.guestsCount(2)}`,
  });

// Колесо дат в шторке строится от системных часов (`PartySelector`:
// `dateChoices(new Date())`), и «Показать заведения» отдаёт первую строку —
// сегодняшний ключ. Тест сверял его со своим `new Date()`, снятым уже после
// кликов; полночь Алматы между монтированием и сверкой — и ключи разные.
const FIXED_NOW = new Date("2026-09-01T12:00:00+05:00");

// beforeEach, а не beforeAll: общий vitest.setup.ts делает vi.useRealTimers()
// в afterEach, и подмена на весь файл дожила бы только до конца первого теста.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(FIXED_NOW);
});

describe("выбор даты и гостей на главной", () => {
  it("тап по дате поднимает общую шторку и никуда не уводит", async () => {
    const onSearchParty = renderSelector();
    const user = userEvent.setup();

    expect(screen.queryByText(t.explore.partySheetTitle)).toBeNull();

    await user.click(dateHalf());

    expect(await screen.findByText(t.explore.partySheetTitle)).toBeTruthy();
    // Шторка — это ещё не выбор: пока не нажали кнопку, наверх ничего не ушло
    // и никакого перехода произойти не может.
    expect(onSearchParty).not.toHaveBeenCalled();
  });

  it("тап по гостям поднимает ТУ ЖЕ шторку — с обоими колёсами", async () => {
    renderSelector();
    const user = userEvent.setup();

    await user.click(guestsHalf());

    expect(await screen.findByText(t.explore.partySheetTitle)).toBeTruthy();
    // Обе колонки на месте: половина подбора в отдельной шторке — ровно то,
    // от чего эта правка избавляется.
    expect(screen.getByText(t.explore.partyDateColumn)).toBeTruthy();
    expect(screen.getByText(t.explore.partyGuestsColumn)).toBeTruthy();
  });

  it("«Показать заведения» отдаёт пару «дата + гости»", async () => {
    const onSearchParty = renderSelector();
    const user = userEvent.setup();

    await user.click(dateHalf());
    await screen.findByText(t.explore.partySheetTitle);
    await user.click(screen.getByRole("button", { name: t.explore.partySubmit }));

    expect(onSearchParty).toHaveBeenCalledWith({
      date: toDateKey(FIXED_NOW),
      guests: 2,
    });
  });

  it("крестик закрывает шторку, ничего не применив", async () => {
    const onSearchParty = renderSelector();
    const user = userEvent.setup();

    await user.click(guestsHalf());
    await screen.findByText(t.explore.partySheetTitle);
    await user.click(screen.getByRole("button", { name: t.search.availabilityClose }));

    await waitFor(() => expect(screen.queryByText(t.explore.partySheetTitle)).toBeNull());
    expect(onSearchParty).not.toHaveBeenCalled();
  });
});
