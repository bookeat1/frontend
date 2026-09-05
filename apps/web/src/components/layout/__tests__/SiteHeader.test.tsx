import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { HEADER_NAV, SiteHeader } from "@web/components/layout/SiteHeader";

/**
 * У шапки одна настоящая обязанность помимо разметки: пометить текущий раздел
 * так, чтобы это было слышно, а не только видно по красному подчёркиванию.
 */
describe("SiteHeader", () => {
  it("рисует все пункты меню с существующими роутами — их ЧЕТЫРЕ", () => {
    render(<SiteHeader />);

    const nav = screen.getByRole("navigation", { name: "Основная навигация" });
    expect(nav.querySelectorAll("a")).toHaveLength(HEADER_NAV.length);
    // Узел 5034:9569 (шапка кадра «Афиша»): «Главная», «Заведения», «Афиша»,
    // «Гастрогид», «Статьи». «Статьи» не показываем — роута /articles нет,
    // ссылка вела бы в 404 Next. «Афиша» появилась вместе с роутом /events.
    expect([...nav.querySelectorAll("a")].map((link) => link.textContent)).toEqual([
      "Главная",
      "Заведения",
      "Афиша",
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

  /**
   * Замок от «комментария, который рендерится». Строчный `// …` внутри детей
   * JSX — валидный TSX и валидный React: tsc и eslint его пропускают, а в шапке
   * появляется видимый текст с двумя слэшами. Такое уже случилось 2026-09-04 у
   * ссылки на профиль. Проверяем текст всех трёх состояний сессии: у каждого
   * своя ветка разметки, и комментарий может завестись в любой.
   */
  it.each([
    ["сессия неизвестна", undefined],
    ["гость без сессии", null],
    ["вошедший гость", { name: "Дамир" }],
  ] as const)("в тексте шапки нет «//» (%s)", (_label, account) => {
    const { container } = render(<SiteHeader account={account} city="Алматы" />);

    expect(container.textContent).not.toContain("//");
  });

  /**
   * Замок обратный прежнему: страница гостя `/profile` появилась 2026-09-05,
   * и имя вошедшего ОБЯЗАНО быть ссылкой на неё — текстом оно было только пока
   * роута не существовало и клик вёл в 404 Next.
   */
  it("имя вошедшего ведёт на /profile", () => {
    render(<SiteHeader account={{ name: "Дамир" }} />);

    expect(screen.getByRole("link", { name: "Дамир" }).getAttribute("href")).toBe("/profile");
  });

  /** Пока сессия читается из localStorage, шапка не должна мигать «Войти»
   * тому, кто уже вошёл. */
  it("не показывает ни вход, ни имя, пока сессия неизвестна", () => {
    render(<SiteHeader />);

    expect(screen.queryByRole("link", { name: "Войти" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Выйти" })).toBeNull();
  });
});
