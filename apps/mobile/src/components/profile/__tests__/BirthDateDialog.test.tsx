import { getDictionary } from "@bookeat/i18n";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { BirthDateDialog } from "../BirthDateDialog";

/**
 * Дата рождения НАБИРАЕТСЯ ЦИФРАМИ, и календаря больше нет.
 *
 * Правка владельца 2026-09-01, вечер: «убери календарь из даты рождения».
 * Утром того же дня (PR #108) поле ввода появилось РЯДОМ с месячной сеткой, и
 * сетка осталась вторым способом; вечером она убрана целиком вместе с
 * компонентом `MonthCalendar`.
 *
 * Половина тестов здесь про то, что календарь не вернулся: он умеет вернуться
 * молча — достаточно, чтобы кто-нибудь «починил» диалог, увидев, что выбирать
 * дату мышью удобнее.
 *
 * `Modal` react-native-web рисуется ПОРТАЛОМ в `document.body`, поэтому все
 * запросы идут через `screen`, а не через контейнер `render`.
 */

const t = getDictionary("ru");
const copy = t.profile.edit;

function open(props: Partial<React.ComponentProps<typeof BirthDateDialog>> = {}) {
  const onApply = vi.fn();
  render(
    <BirthDateDialog visible value="" onApply={onApply} onCancel={vi.fn()} {...props} />,
  );
  return { onApply, input: screen.getByLabelText(copy.birthDateTypeLabel) as HTMLInputElement };
}

describe("диалог даты рождения", () => {
  it("КАЛЕНДАРЯ НЕТ: ни дней, ни месяца, ни списка лет", () => {
    open({ value: "1990-05-04" });

    // Дни месяца рисовались кнопками с числом в названии — именно по ним
    // старый тест и «выбирал» дату.
    expect(screen.queryByRole("button", { name: "17" })).toBeNull();
    expect(screen.queryByRole("button", { name: "1990" })).toBeNull();
    // Заголовок месяца и стрелки листания.
    expect(screen.queryByText(/Май 1990/)).toBeNull();
    expect(screen.queryByRole("button", { name: /месяц/i })).toBeNull();
  });

  it("сам расставляет точки: гость печатает только цифры", () => {
    const { input } = open();

    fireEvent.change(input, { target: { value: "04051990" } });

    expect(input.value).toBe("04.05.1990");
  });

  it("сохранённая дата открывается уже набранной, а не пустым полем", () => {
    const { input } = open({ value: "1990-05-04" });

    expect(input.value).toBe("04.05.1990");
  });

  it("набранная дата уходит наружу ключом «YYYY-MM-DD» — формат отправки прежний", () => {
    const { input, onApply } = open();

    fireEvent.change(input, { target: { value: "04051990" } });
    fireEvent.click(screen.getByText(copy.birthDateApply));

    expect(onApply).toHaveBeenCalledWith("1990-05-04");
  });

  it("31.02 объясняет причину по нажатию и не даёт применить", () => {
    const { input, onApply } = open();

    fireEvent.change(input, { target: { value: "31021992" } });
    fireEvent.click(screen.getByText(copy.birthDateApply));

    expect(screen.getByText(copy.errors.birth_date_format)).toBeDefined();
    expect(onApply).not.toHaveBeenCalled();
    // И набранное осталось на месте: причину читают, глядя на свой ввод.
    expect(input.value).toBe("31.02.1992");
  });

  it("будущая дата объясняет именно это, а не «неверный формат»", () => {
    const { input, onApply } = open();

    fireEvent.change(input, { target: { value: `0101${new Date().getFullYear() + 1}` } });
    fireEvent.click(screen.getByText(copy.birthDateApply));

    expect(screen.getByText(copy.errors.birth_date_not_past)).toBeDefined();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("недописанную дату не ругает, пока её набирают", () => {
    const { input } = open();

    fireEvent.change(input, { target: { value: "0405" } });

    expect(screen.queryByText(copy.errors.birth_date_format)).toBeNull();
    expect(screen.queryByText(copy.errors.birth_date_incomplete)).toBeNull();
  });

  it("но по «Готово» называет и недобор — молча погашенной кнопки здесь нет", () => {
    const { input, onApply } = open();

    fireEvent.change(input, { target: { value: "0405" } });
    fireEvent.click(screen.getByText(copy.birthDateApply));

    expect(screen.getByText(copy.errors.birth_date_incomplete)).toBeDefined();
    expect(onApply).not.toHaveBeenCalled();
  });
});
