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

  /**
   * Кнопка «Войти» ДОЛЖНА вести на существующую страницу. Раньше она звала
   * обработчик, которого никто не передавал, и не делала ничего — ровно то
   * замечание, из-за которого появился экран `/login`. Проверяем адрес, а не
   * вызов колбэка: обе кнопки макета ведут на один и тот же экран, потому что
   * отдельной регистрации у бэкенда нет.
   */
  it("вход и регистрация ведут на /login, пока гость не вошёл", () => {
    render(<SiteHeader account={null} />);

    expect(screen.getByRole("link", { name: "Войти" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "Регистрация" }).getAttribute("href")).toBe("/login");
  });

  it("вошедшему гостю показывает имя и «Выйти»", () => {
    const onSignOut = vi.fn();
    render(<SiteHeader account={{ name: "Дамир" }} onSignOut={onSignOut} />);

    expect(screen.getByText("Дамир")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Войти" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  /** Пока сессия читается из localStorage, шапка не должна мигать «Войти»
   * тому, кто уже вошёл. */
  it("не показывает ни вход, ни имя, пока сессия неизвестна", () => {
    render(<SiteHeader />);

    expect(screen.queryByRole("link", { name: "Войти" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Выйти" })).toBeNull();
  });
});
