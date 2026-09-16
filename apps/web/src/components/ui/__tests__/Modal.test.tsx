import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { Modal } from "@web/components/ui/Modal";

/**
 * У модалки логики больше, чем у всего остального набора вместе: Esc,
 * затемнение, ловушка фокуса, возврат фокуса и блокировка прокрутки. Каждое из
 * этих поведений ломается молча и обнаруживается только клавиатурой, поэтому
 * они и закреплены здесь.
 */
describe("Modal", () => {
  it("объявлен диалогом и подписан заголовком", () => {
    render(
      <Modal title="Вход и регистрация" description="Пароль не нужен" onClose={vi.fn()}>
        <button type="button">Получить код</button>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Вход и регистрация" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("Esc закрывает", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Вход" onClose={onClose}>
        <button type="button">Получить код</button>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("клик по затемнению закрывает", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal title="Вход" onClose={onClose}>
        <button type="button">Получить код</button>
      </Modal>,
    );
    const scrim = container.firstElementChild as HTMLElement;

    fireEvent.mouseDown(scrim);
    fireEvent.mouseUp(scrim);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("выделение текста, отпущенное на затемнении, НЕ закрывает окно", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal title="Вход" onClose={onClose}>
        <button type="button">Получить код</button>
      </Modal>,
    );
    const scrim = container.firstElementChild as HTMLElement;

    // Нажали внутри окна, отпустили за его краем — это протяжка мышью, а не
    // клик по фону. Раньше такой жест закрывал диалог вместе с введённым.
    fireEvent.mouseDown(screen.getByRole("dialog"));
    fireEvent.mouseUp(scrim);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("фокус уезжает внутрь окна при открытии", () => {
    render(
      <Modal title="Вход" onClose={vi.fn()}>
        <button type="button">Получить код</button>
      </Modal>,
    );

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Закрыть" }));
  });

  it("фокус возвращается туда, откуда пришёл", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(
      <Modal title="Вход" onClose={vi.fn()}>
        <button type="button">Получить код</button>
      </Modal>,
    );
    unmount();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("Tab с последнего элемента возвращает на первый — фокус заперт внутри", () => {
    render(
      <Modal title="Вход" onClose={vi.fn()}>
        <button type="button">Получить код</button>
      </Modal>,
    );

    const close = screen.getByRole("button", { name: "Закрыть" });
    const submit = screen.getByRole("button", { name: "Получить код" });
    submit.focus();

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(close);
  });

  it("centerIcon: иконка над заголовком по центру, без крестика-закрытия", () => {
    render(
      <Modal
        title="Выйти из аккаунта?"
        description="Вы уверены?"
        onClose={vi.fn()}
        centerIcon={<span data-testid="badge">значок</span>}
      >
        <button type="button">Выйти</button>
      </Modal>,
    );

    expect(screen.getByTestId("badge")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Закрыть" })).toBeNull();
    // Закрытие всё равно доступно — Esc и клик по затемнению (проверены выше).
  });

  it("centerIcon: заголовок и подпись в своих утилитах кегля, не h3/bodyM обычной модалки", () => {
    render(
      <Modal
        title="Выйти из аккаунта?"
        description="Вы уверены?"
        onClose={vi.fn()}
        centerIcon={<span data-testid="badge">значок</span>}
      >
        <button type="button">Выйти</button>
      </Modal>,
    );

    const heading = screen.getByRole("heading", { name: "Выйти из аккаунта?" });
    expect(heading.className).toContain("text-signout-title");
    expect(heading.className).toContain("text-signout-title-ink");
    expect(heading.className).not.toContain("text-h3");

    const description = screen.getByText("Вы уверены?");
    expect(description.className).toContain("text-signout-text");
    expect(description.className).toContain("text-signout-text-ink");
    expect(description.className).not.toContain("text-bodyM");
  });

  it("centerIcon: фокус при открытии остаётся на диалоге, а не на первой (разрушительной) кнопке", () => {
    render(
      <Modal
        title="Выйти из аккаунта?"
        description="Вы уверены?"
        onClose={vi.fn()}
        centerIcon={<span data-testid="badge">значок</span>}
      >
        <button type="button">Выйти</button>
        <button type="button">Вернуться назад</button>
      </Modal>,
    );

    expect(document.activeElement).toBe(screen.getByRole("dialog"));
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Выйти" }));
  });

  it("страница под окном не прокручивается, пока оно открыто", () => {
    const { unmount } = render(
      <Modal title="Вход" onClose={vi.fn()}>
        <button type="button">Получить код</button>
      </Modal>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
