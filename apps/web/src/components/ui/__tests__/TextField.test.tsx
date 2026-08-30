import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { TextField } from "@web/components/ui/TextField";

/**
 * Красная рамка — это не сообщение об ошибке: дальтоник её не различит, а
 * скринридер не увидит вовсе. Тест держит связку `aria-invalid` +
 * `aria-describedby` + `role="alert"`, потому что именно она делает ошибку
 * слышимой, и потерять её в рефакторинге легче всего.
 */
describe("TextField", () => {
  it("подпись связана с полем — поле находится по имени", () => {
    render(<TextField label="Номер телефона" />);
    expect(screen.getByLabelText("Номер телефона")).toBeTruthy();
  });

  it("ошибка помечает поле невалидным и связывается с ним", () => {
    render(<TextField label="Номер телефона" error="Введите номер" />);

    const input = screen.getByLabelText("Номер телефона");
    const message = screen.getByRole("alert");

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(message.getAttribute("id"));
    expect(message.textContent).toBe("Введите номер");
  });

  it("подсказка связывается так же, но не считается ошибкой", () => {
    render(<TextField label="Имя" hint="Как к вам обращаться" />);

    const input = screen.getByLabelText("Имя");

    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ошибка вытесняет подсказку — два сообщения под полем не показываем", () => {
    render(<TextField label="Имя" hint="Как к вам обращаться" error="Введите имя" />);

    expect(screen.getByRole("alert").textContent).toBe("Введите имя");
    expect(screen.queryByText("Как к вам обращаться")).toBeNull();
  });

  it("введённое значение сохраняется при появлении ошибки", () => {
    const { rerender } = render(<TextField label="Имя" defaultValue="Камила" />);
    const input = screen.getByLabelText("Имя") as HTMLInputElement;
    expect(input.value).toBe("Камила");

    rerender(<TextField label="Имя" defaultValue="Камила" error="Слишком коротко" />);

    expect((screen.getByLabelText("Имя") as HTMLInputElement).value).toBe("Камила");
  });

  it("у двух полей на странице разные идентификаторы", () => {
    render(
      <>
        <TextField label="Имя" />
        <TextField label="Адрес" />
      </>,
    );

    const name = screen.getByLabelText("Имя");
    const address = screen.getByLabelText("Адрес");

    expect(name.getAttribute("id")).not.toBe(address.getAttribute("id"));
  });
});
