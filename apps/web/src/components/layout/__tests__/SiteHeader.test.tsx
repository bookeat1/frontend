import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { HEADER_NAV, SiteHeader } from "@web/components/layout/SiteHeader";

/**
 * У шапки одна настоящая обязанность помимо разметки: пометить текущий раздел
 * так, чтобы это было слышно, а не только видно по красному подчёркиванию.
 */
describe("SiteHeader", () => {
  it("рисует все пункты меню из макета", () => {
    render(<SiteHeader />);

    const nav = screen.getByRole("navigation", { name: "Основная навигация" });
    expect(nav.querySelectorAll("a")).toHaveLength(HEADER_NAV.length);
  });

  it("активный раздел помечен aria-current, остальные — нет", () => {
    render(<SiteHeader activeKey="afisha" />);

    expect(screen.getByRole("link", { name: "Афиша" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Гастрогид" }).hasAttribute("aria-current")).toBe(false);
  });

  it("город показывается только когда он известен", () => {
    const { rerender } = render(<SiteHeader />);
    expect(screen.queryByRole("button", { name: "Выбрать город" })).toBeNull();

    rerender(<SiteHeader city="Алматы" />);
    expect(screen.getByRole("button", { name: "Выбрать город" }).textContent).toContain("Алматы");
  });

  it("кнопки входа и регистрации зовут свои обработчики", () => {
    const onSignIn = vi.fn();
    const onSignUp = vi.fn();
    render(<SiteHeader onSignIn={onSignIn} onSignUp={onSignUp} />);

    fireEvent.click(screen.getByRole("button", { name: "Войти" }));
    fireEvent.click(screen.getByRole("button", { name: "Регистрация" }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });
});
