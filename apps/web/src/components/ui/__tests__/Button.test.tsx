import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { Button } from "@web/components/ui/Button";

/**
 * Кнопка проверяется по поведению, а не по классам: покрашено ли что-то в
 * #B33036, глазами видно на /kit, а вот «повторный клик по кнопке, пока идёт
 * запрос, безвреден» — нет.
 */
describe("Button", () => {
  it("это настоящая <button> с типом button, а не отправка формы", () => {
    render(<Button>Забронировать</Button>);
    const button = screen.getByRole("button", { name: "Забронировать" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveProperty("type", "button");
  });

  it("во время загрузки не даёт кликнуть второй раз", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Подтвердить
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Подтвердить/ });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("выключенная кнопка не зовёт обработчик", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Подтвердить
      </Button>,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("в покое клик проходит ровно один раз на нажатие", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Найти</Button>);

    fireEvent.click(screen.getByRole("button", { name: "Найти" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("aria-busy не выставляется, когда загрузки нет", () => {
    render(<Button>Найти</Button>);
    expect(screen.getByRole("button").hasAttribute("aria-busy")).toBe(false);
  });
});
