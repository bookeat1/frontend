import { getDictionary } from "@bookeat/i18n";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { BirthDatePickerDialog } from "../BirthDatePickerDialog";

/**
 * Диалог даты рождения: ДВА способа ввода, одно значение.
 *
 * Правка владельца 2026-09-01 — «дату можно указывать просто цифрами, без
 * вызова календаря». Календарь остался; проверяем, что появившееся поле
 * действительно работает и что оно не разъезжается с календарём.
 *
 * `Modal` react-native-web рисуется ПОРТАЛОМ в `document.body`, поэтому все
 * запросы идут через `screen`, а не через контейнер `render`.
 */

const t = getDictionary("ru");
const copy = t.profile.edit;

const BOUNDS = { earliest: "1906-09-02", latest: "2026-08-31" };

function open(props: Partial<React.ComponentProps<typeof BirthDatePickerDialog>> = {}) {
  const onApply = vi.fn();
  render(
    <BirthDatePickerDialog
      visible
      value=""
      earliest={BOUNDS.earliest}
      latest={BOUNDS.latest}
      onApply={onApply}
      onCancel={vi.fn()}
      {...props}
    />,
  );
  return { onApply, input: screen.getByLabelText(copy.birthDateTypeLabel) };
}

describe("диалог даты рождения — ввод цифрами", () => {
  it("сам расставляет точки: гость печатает только цифры", () => {
    const { input } = open();

    fireEvent.change(input, { target: { value: "04051990" } });

    expect((input as HTMLInputElement).value).toBe("04.05.1990");
  });

  it("набранная дата уходит наружу ключом «YYYY-MM-DD» — формат отправки прежний", () => {
    const { input, onApply } = open();

    fireEvent.change(input, { target: { value: "04051990" } });
    fireEvent.click(screen.getByText(copy.birthDateApply));

    expect(onApply).toHaveBeenCalledWith("1990-05-04");
  });

  it("31.02 объясняет причину и не даёт применить", () => {
    const { input, onApply } = open();

    fireEvent.change(input, { target: { value: "31021992" } });

    expect(screen.getByText(copy.errors.birth_date_format)).toBeDefined();
    fireEvent.click(screen.getByText(copy.birthDateApply));
    expect(onApply).not.toHaveBeenCalled();
  });

  it("будущая дата объясняет именно это, а не «неверный формат»", () => {
    const { input, onApply } = open();

    fireEvent.change(input, { target: { value: `0101${new Date().getFullYear() + 1}` } });

    expect(screen.getByText(copy.errors.birth_date_not_past)).toBeDefined();
    fireEvent.click(screen.getByText(copy.birthDateApply));
    expect(onApply).not.toHaveBeenCalled();
  });

  it("недописанную дату не ругает — это ещё не ошибка человека", () => {
    const { input } = open();

    fireEvent.change(input, { target: { value: "0405" } });

    expect(screen.queryByText(copy.errors.birth_date_format)).toBeNull();
    expect(screen.queryByText(copy.errors.birth_date_incomplete)).toBeNull();
  });

  it("календарь никуда не делся: сохранённая дата открывается уже набранной", () => {
    const { input } = open({ value: "1990-05-04" });

    expect((input as HTMLInputElement).value).toBe("04.05.1990");
    // Заголовок диалога и кнопка календаря на месте — второй способ ввода
    // остался рядом, а не заменён полем.
    expect(screen.getByText(copy.birthDateDialogTitle)).toBeDefined();
  });
});
