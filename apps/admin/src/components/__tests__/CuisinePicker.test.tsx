import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { VenueCuisine } from "@bookeat/api/admin";
import React, { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { CuisinePicker, mergeCuisineOptions } from "../ui/CuisinePicker";

/**
 * Выбор кухонь заведения: до пяти, порядок значим, первая — главная.
 *
 * Компонент управляемый, поэтому вокруг него в тесте живёт крошечный владелец
 * состояния: иначе проверялся бы только вызов onChange, а не то, что человек
 * видит после нажатия.
 */

const DICTIONARY: VenueCuisine[] = [
  { id: "c-1", code: "kazakh", name: "Казахская" },
  { id: "c-2", code: "italian", name: "Итальянская" },
  { id: "c-3", code: "seafood", name: "Морская" },
  { id: "c-4", code: "vegan", name: "Веган" },
  { id: "c-5", code: "bakery", name: "Пекарня" },
  { id: "c-6", code: "turkish", name: "Турецкая" },
];

function Harness({
  options = DICTIONARY,
  initial = [],
}: {
  options?: VenueCuisine[];
  initial?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  return (
    <>
      <CuisinePicker options={options} selected={selected} onChange={setSelected} />
      <div data-testid="selection">{selected.join(",")}</div>
    </>
  );
}

const selection = () => screen.getByTestId("selection").textContent;

afterEach(cleanup);

describe("CuisinePicker", () => {
  it("добавляет кухню в конец набора", () => {
    render(<Harness initial={["c-1"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Добавить кухню «Морская»/i }));
    expect(selection()).toBe("c-1,c-3");
  });

  it("больше пяти кухонь выбрать нельзя — кнопки добавления гаснут", () => {
    render(<Harness initial={["c-1", "c-2", "c-3", "c-4"]} />);

    fireEvent.click(screen.getByRole("button", { name: /Добавить кухню «Пекарня»/i }));
    expect(selection()).toBe("c-1,c-2,c-3,c-4,c-5");

    const sixth = screen.getByRole<HTMLButtonElement>("button", {
      name: /Добавить кухню «Турецкая»/i,
    });
    expect(sixth.disabled).toBe(true);
    fireEvent.click(sixth);
    expect(selection()).toBe("c-1,c-2,c-3,c-4,c-5");
    expect(screen.getByRole("status").textContent).toContain("Выбрано 5 из 5");
  });

  it("«Сделать главной» переносит кухню на первое место, остальные не перемешиваются", () => {
    render(<Harness initial={["c-1", "c-2", "c-3"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Сделать «Морская» главной/i }));
    expect(selection()).toBe("c-3,c-1,c-2");
  });

  it("у первой кухни кнопки «сделать главной» нет — она уже главная", () => {
    render(<Harness initial={["c-1", "c-2"]} />);
    expect(screen.queryByRole("button", { name: /Сделать «Казахская» главной/i })).toBeNull();
    expect(screen.getByText("Главная")).toBeTruthy();
  });

  it("убранная кухня возвращается в список доступных", () => {
    render(<Harness initial={["c-1", "c-2"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Убрать кухню «Казахская»/i }));
    expect(selection()).toBe("c-2");
    expect(screen.getByRole("button", { name: /Добавить кухню «Казахская»/i })).toBeTruthy();
  });

  it("пустой справочник не выглядит как «кухонь не бывает»", () => {
    render(<Harness options={[]} />);
    expect(screen.getByText(/Справочник кухонь пуст/i)).toBeTruthy();
  });

  it("скрытая кухня, уже выбранная заведением, остаётся видна и не пропадает молча", () => {
    const hidden: VenueCuisine = { id: "c-9", code: "french", name: "Французская" };
    const options = mergeCuisineOptions(DICTIONARY, [hidden]);
    render(<Harness options={options} initial={["c-9"]} />);
    expect(screen.getByRole("button", { name: /Убрать кухню «Французская»/i })).toBeTruthy();
  });
});
