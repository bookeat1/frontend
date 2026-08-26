import { getDictionary } from "@bookeat/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { PartySelector } from "../explore/PartySelector";
import { toDateKey } from "../../lib/format";

/**
 * Капсула «дата · гости» на главной: выбор происходит ЗДЕСЬ, нижней шторкой.
 *
 * Что чинится этим тестом (правка владельца 2026-08-26): тап по половине
 * капсулы уводил на отдельный экран — в `/search?focus=date`, где немедленно
 * раскрывалась шторка фильтров. Такого экрана в дизайне нет вовсе (макет
 * 918:11747), а нагруженная панель фильтров пугает человека, который назвал
 * всего лишь день.
 *
 * Поэтому проверяем ровно две вещи:
 *   1. тап поднимает ШТОРКУ прямо здесь и НИЧЕГО не сообщает наверх — переход
 *      в каталог на этом шаге не должен случиться даже случайно;
 *   2. «Готово» отдаёт ПАРУ «дата + гости», даже если крутили одно колесо:
 *      сервер игнорирует половину подбора, и второй его половине неоткуда
 *      взяться, кроме значения по умолчанию.
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

describe("выбор даты и гостей на главной", () => {
  it("тап по дате поднимает шторку выбора даты и никуда не уводит", async () => {
    const onSearchParty = renderSelector();
    const user = userEvent.setup();

    expect(screen.queryByText(t.booking.pickDateTitle)).toBeNull();

    await user.click(dateHalf());

    expect(await screen.findByText(t.booking.pickDateTitle)).toBeTruthy();
    // Шторка — это ещё не выбор: пока не нажали «Готово», наверх ничего не
    // ушло и никакого перехода произойти не может.
    expect(onSearchParty).not.toHaveBeenCalled();
  });

  it("тап по гостям поднимает шторку выбора числа гостей", async () => {
    renderSelector();
    const user = userEvent.setup();

    await user.click(guestsHalf());

    expect(await screen.findByText(t.booking.pickGuestsTitle)).toBeTruthy();
    expect(screen.queryByText(t.booking.pickDateTitle)).toBeNull();
  });

  it("«Готово» отдаёт пару «дата + гости», а не одну половину", async () => {
    const onSearchParty = renderSelector();
    const user = userEvent.setup();

    await user.click(dateHalf());
    await screen.findByText(t.booking.pickDateTitle);
    await user.click(screen.getByRole("button", { name: t.search.availabilityDone }));

    expect(onSearchParty).toHaveBeenCalledWith({
      date: toDateKey(new Date()),
      guests: 2,
    });
  });

  it("крестик закрывает шторку, ничего не применив", async () => {
    const onSearchParty = renderSelector();
    const user = userEvent.setup();

    await user.click(guestsHalf());
    await screen.findByText(t.booking.pickGuestsTitle);
    await user.click(screen.getByRole("button", { name: t.search.availabilityClose }));

    await waitFor(() => expect(screen.queryByText(t.booking.pickGuestsTitle)).toBeNull());
    expect(onSearchParty).not.toHaveBeenCalled();
  });
});
