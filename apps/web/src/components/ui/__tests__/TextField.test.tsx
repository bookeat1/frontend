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

  /**
   * Именно это увидел владелец: поле на экране входа было собрано размером
   * КИТА (радиус 12, высота 48), а макет входа (узел 3272:13) рисует 14 и 52.
   * Проверяем классы, а не «выглядит похоже»: другой источник правды тут
   * взять негде, а расхождение молчаливое — ни tsc, ни линтер про него не
   * скажут.
   */
  it("размер l — это поле модалки входа: радиус 14 и высота 52", () => {
    render(<TextField label="Номер телефона" size="l" />);
    const box = screen.getByLabelText("Номер телефона").parentElement as HTMLElement;

    expect(box.className).toContain("rounded-field");
    expect(box.className).toContain("h-login-field");
    expect(box.className).not.toContain("rounded-md");
  });

  it("размер по умолчанию — поле кита: радиус 12 и высота 48", () => {
    render(<TextField label="Имя" />);
    const box = screen.getByLabelText("Имя").parentElement as HTMLElement;

    expect(box.className).toContain("rounded-md");
    expect(box.className).toContain("h-input");
  });

  it("фокус и ошибка не меняют толщину рамки — иначе содержимое прыгает", () => {
    const { rerender } = render(<TextField label="Имя" />);
    const rest = (screen.getByLabelText("Имя").parentElement as HTMLElement).className;

    expect(rest).toContain("border");
    expect(rest).not.toContain("border-2");

    rerender(<TextField label="Имя" error="Введите имя" />);
    const invalid = (screen.getByLabelText("Имя").parentElement as HTMLElement).className;

    expect(invalid).not.toContain("border-2");
    expect(invalid).toContain("ring-inset");
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
