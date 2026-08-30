import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TimeSlot } from "@web/components/ui/TimeSlot";

/**
 * Занятое время приходит с бэкенда как недоступное. Здесь пришпилено, что оно
 * недоступно ПО-НАСТОЯЩЕМУ — иначе гость выбрал бы слот, которого нет, и
 * узнал бы об этом только из 409 на шаге подтверждения.
 */
describe("TimeSlot", () => {
  it("отдаёт время наверх ровно как получил", () => {
    const onSelect = vi.fn();
    render(<TimeSlot time="19:30" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "19:30" }));

    expect(onSelect).toHaveBeenCalledWith("19:30");
  });

  it("занятый слот выключен и не выбирается", () => {
    const onSelect = vi.fn();
    render(<TimeSlot time="17:30" disabled onSelect={onSelect} />);

    const slot = screen.getByRole("button", { name: "17:30" });
    fireEvent.click(slot);

    expect(slot).toHaveProperty("disabled", true);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("выбранный слот объявлен нажатым", () => {
    render(<TimeSlot time="19:30" selected />);
    expect(screen.getByRole("button", { name: "19:30" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("без обработчика клик не роняет компонент", () => {
    render(<TimeSlot time="18:00" />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: "18:00" }))).not.toThrow();
  });
});
