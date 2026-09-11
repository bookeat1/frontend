import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { WheelPicker, type WheelColumnConfig } from "@web/components/ui/WheelPicker";

/** Обёртка делает колонку управляемой в тесте: сам `WheelPicker` без
 * состояния, `onChange` должен реально долетать до значения `value`. */
function ControlledColumn(props: Omit<WheelColumnConfig, "value" | "onChange"> & { initial: number }) {
  const [value, setValue] = useState(props.initial);
  return <WheelPicker columns={[{ ...props, value, onChange: setValue }]} />;
}

describe("WheelPicker", () => {
  it("шеврон «вверх» увеличивает значение на шаг", () => {
    render(
      <ControlledColumn
        initial={12}
        min={0}
        max={23}
        format={(v) => `${v}`.padStart(2, "0")}
        label="Часы"
        incrementLabel="Часы: следующее значение"
        decrementLabel="Часы: предыдущее значение"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Часы: следующее значение" }));
    expect(screen.getByRole("status").textContent).toBe("13");
  });

  it("шеврон «вниз» уменьшает значение на шаг", () => {
    render(
      <ControlledColumn
        initial={12}
        min={0}
        max={23}
        format={(v) => `${v}`.padStart(2, "0")}
        label="Часы"
        incrementLabel="Часы: следующее значение"
        decrementLabel="Часы: предыдущее значение"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Часы: предыдущее значение" }));
    expect(screen.getByRole("status").textContent).toBe("11");
  });

  it("оборачивается на верхней границе диапазона", () => {
    render(
      <ControlledColumn
        initial={23}
        min={0}
        max={23}
        format={(v) => `${v}`.padStart(2, "0")}
        label="Часы"
        incrementLabel="Часы: следующее значение"
        decrementLabel="Часы: предыдущее значение"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Часы: следующее значение" }));
    expect(screen.getByRole("status").textContent).toBe("00");
  });

  it("оборачивается на нижней границе диапазона", () => {
    render(
      <ControlledColumn
        initial={0}
        min={0}
        max={59}
        format={(v) => `${v}`.padStart(2, "0")}
        label="Минуты"
        incrementLabel="Минуты: следующее значение"
        decrementLabel="Минуты: предыдущее значение"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Минуты: предыдущее значение" }));
    expect(screen.getByRole("status").textContent).toBe("59");
  });

  it("клик по соседнему видимому значению выбирает его напрямую", () => {
    render(
      <ControlledColumn
        initial={2}
        min={1}
        max={8}
        format={(v) => `${v}`}
        label="Гости"
        incrementLabel="Гости: следующее значение"
        decrementLabel="Гости: предыдущее значение"
      />,
    );

    // На пять видимых строк вокруг "2" сосед сверху — "1" (стоит отдельной
    // кнопкой со своим aria-label, не спутать с текущим значением-выводом).
    fireEvent.click(screen.getByRole("button", { name: "Гости: 1" }));
    expect(screen.getByRole("status").textContent).toBe("1");
  });

  it("две колонки рендерятся независимо (часы и минуты)", () => {
    const onChangeHour = vi.fn();
    const onChangeMinute = vi.fn();
    render(
      <WheelPicker
        columns={[
          {
            value: 11,
            min: 0,
            max: 23,
            format: (v) => `${v}`.padStart(2, "0"),
            label: "Часы",
            incrementLabel: "Часы: следующее значение",
            decrementLabel: "Часы: предыдущее значение",
            onChange: onChangeHour,
          },
          {
            value: 59,
            min: 0,
            max: 59,
            format: (v) => `${v}`.padStart(2, "0"),
            label: "Минуты",
            incrementLabel: "Минуты: следующее значение",
            decrementLabel: "Минуты: предыдущее значение",
            onChange: onChangeMinute,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Часы: следующее значение" }));
    expect(onChangeHour).toHaveBeenCalledWith(12);
    fireEvent.click(screen.getByRole("button", { name: "Минуты: следующее значение" }));
    expect(onChangeMinute).toHaveBeenCalledWith(0); // 59 + 1 → 0, независимо от часов
  });
});
