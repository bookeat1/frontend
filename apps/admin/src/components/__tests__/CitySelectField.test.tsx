import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CityDictionaryEntry } from "@bookeat/api/admin";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CitySelectField, cityOptionsFor } from "../ui/CitySelectField";

/**
 * Город у заведения выбирается ИЗ СПРАВОЧНИКА, а пишется СТРОКОЙ.
 *
 * Строкой — потому что поля `city_id` в API заведения нет вообще
 * (`internal/transport/rest/restaurants/request.go` знает только `city`), а
 * ссылку по строке проставляет триггер базы. Значение пункта — `value` записи
 * (базовое русское название), а не `name` (перевод) и не `code`: каталог
 * сравнивает строку точно.
 */

function entry(over: Partial<CityDictionaryEntry> = {}): CityDictionaryEntry {
  return {
    id: "c-1",
    code: "astana",
    name: "Астана",
    value: "Астана",
    display_order: 1,
    is_active: true,
    ...over,
  };
}

const DICTIONARY: CityDictionaryEntry[] = [
  entry(),
  entry({ id: "c-2", code: "almaty", name: "Алматы", value: "Алматы", display_order: 2 }),
  entry({
    id: "c-3",
    code: "shymkent",
    name: "Шымкент",
    value: "Шымкент",
    display_order: 3,
    is_active: false,
  }),
];

afterEach(cleanup);

describe("выбор города у заведения", () => {
  it("это список, а не свободный ввод, и скрытый город в нём не предлагают", () => {
    render(
      <CitySelectField dictionary={DICTIONARY} value="Астана" onChange={vi.fn()} />,
    );
    const select = screen.getByLabelText<HTMLSelectElement>(/^Город/);
    expect(select.tagName).toBe("SELECT");
    expect([...select.options].map((o) => o.value)).toEqual(["Астана", "Алматы"]);
  });

  it("отдаёт базовое русское название, а не перевод и не код", () => {
    const onChange = vi.fn();
    render(
      <CitySelectField
        dictionary={[entry({ name: "Астана қаласы", value: "Астана" })]}
        value=""
        onChange={onChange}
      />,
    );
    const select = screen.getByLabelText<HTMLSelectElement>(/^Город/);
    expect([...select.options].map((o) => o.textContent)).toContain("Астана қаласы");

    fireEvent.change(select, { target: { value: "Астана" } });
    expect(onChange).toHaveBeenCalledWith("Астана");
  });

  it("незнакомый справочнику город заведения остаётся выбранным, а не подменяется первым", () => {
    render(
      <CitySelectField dictionary={DICTIONARY} value="Нур-Султан" onChange={vi.fn()} />,
    );
    const select = screen.getByLabelText<HTMLSelectElement>(/^Город/);
    expect(select.value).toBe("Нур-Султан");
    expect(screen.getByText("Нур-Султан — нет в справочнике")).toBeTruthy();
  });

  it("справочник не ответил — честный откат на ввод текстом с объяснением", () => {
    const onChange = vi.fn();
    render(<CitySelectField dictionary={[]} failed value="Алматы" onChange={onChange} />);
    const input = screen.getByLabelText<HTMLInputElement>(/^Город/);
    expect(input.tagName).toBe("INPUT");
    expect(screen.getByText(/Справочник городов не ответил/i)).toBeTruthy();

    fireEvent.change(input, { target: { value: "Караганда" } });
    expect(onChange).toHaveBeenCalledWith("Караганда");
  });

  it("пока справочник грузится, список заблокирован, но город видно", () => {
    render(
      <CitySelectField dictionary={DICTIONARY} loading value="Алматы" onChange={vi.fn()} />,
    );
    const select = screen.getByLabelText<HTMLSelectElement>(/^Город/);
    expect(select.disabled).toBe(true);
    expect(select.value).toBe("Алматы");
  });
});

describe("cityOptionsFor", () => {
  it("порядок справочника, только активные", () => {
    expect(cityOptionsFor(DICTIONARY, "")).toEqual([
      { value: "Астана", label: "Астана" },
      { value: "Алматы", label: "Алматы" },
    ]);
  });

  it("другой регистр того же города не порождает второй пункт", () => {
    expect(cityOptionsFor(DICTIONARY, " алматы ")).toHaveLength(2);
  });
});
