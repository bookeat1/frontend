import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { Chip } from "@web/components/ui/Chip";

/**
 * Смысл теста — третье состояние. В макете чип бывает `default`, `active` и
 * `selected`, и попытка свести их к булеву флагу уже однажды напрашивалась;
 * здесь зафиксировано, что для скринридера НАЖАТЫ оба «выбранных» вида.
 */
describe("Chip", () => {
  it("невыбранный чип объявлен ненажатым", () => {
    render(<Chip>Завтраки</Chip>);
    expect(screen.getByRole("button", { name: "Завтраки" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("оба выбранных состояния объявлены нажатыми", () => {
    render(
      <>
        <Chip state="active">С террасой</Chip>
        <Chip state="selected">Все</Chip>
      </>,
    );

    expect(screen.getByRole("button", { name: "С террасой" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Все" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("зовёт обработчик по клику", () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>Завтраки</Chip>);

    fireEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("выключенный чип не зовёт обработчик", () => {
    const onClick = vi.fn();
    render(
      <Chip disabled onClick={onClick}>
        Завтраки
      </Chip>,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
  });
});
