import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { HEADER_NAV, SiteHeader } from "@web/components/layout/SiteHeader";

/**
 * У шапки одна настоящая обязанность помимо разметки: пометить текущий раздел
 * так, чтобы это было слышно, а не только видно по красному подчёркиванию.
 */
describe("SiteHeader", () => {
  it("рисует все пункты меню из макета — их ТРИ", () => {
    render(<SiteHeader />);

    const nav = screen.getByRole("navigation", { name: "Основная навигация" });
    expect(nav.querySelectorAll("a")).toHaveLength(HEADER_NAV.length);
    // Узел 3549:5727: «Главная», «Заведения», «Гастрогид». «Афиша» и «Статьи»
    // достались от старого компонента шапки и вели в 404 Next.
    expect([...nav.querySelectorAll("a")].map((link) => link.textContent)).toEqual([
      "Главная",
      "Заведения",
      "Гастрогид",
    ]);
  });

  it("активный раздел помечен aria-current, остальные — нет", () => {
    render(<SiteHeader activeKey="venues" />);

    expect(screen.getByRole("link", { name: "Заведения" }).getAttribute("aria-current")).toBe(
      "page",
    );
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
   * замечание, из-за которого появился экран `/login`.
   *
   * Кнопка ОДНА: в макете (узел 3549:6440) рядом с ней «Регистрации» нет, да и
   * у бэкенда отдельной регистрации не существует — `POST /auth/otp/verify`
   * заводит учётную запись, если номер новый.
   */
  it("гостю без сессии показывает ОДНУ кнопку «Войти» на /login", () => {
    render(<SiteHeader account={null} />);

    expect(screen.getAllByRole("link", { name: "Войти" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Войти" }).getAttribute("href")).toBe("/login");
    expect(screen.queryByRole("link", { name: "Регистрация" })).toBeNull();
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
