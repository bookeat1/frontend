import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { HEADER_NAV, SiteHeader } from "@web/components/layout/SiteHeader";

/**
 * У шапки одна настоящая обязанность помимо разметки: пометить текущий раздел
 * так, чтобы это было слышно, а не только видно по красному подчёркиванию.
 */
describe("SiteHeader", () => {
  it("рисует все пункты меню из макета — их ШЕСТЬ", () => {
    render(<SiteHeader />);

    const nav = screen.getByRole("navigation", { name: "Основная навигация" });
    expect(nav.querySelectorAll("a")).toHaveLength(HEADER_NAV.length);
    // Узел 5034:9569 (шапка кадра «Афиша»): «Главная», «Заведения», «Афиша»,
    // «Гастрогид», «Статьи», «Акции». Роуты существуют с 2026-09-05
    // («Афиша» — /events, узел 5033:6703; «Статьи» — /articles, узел
    // 5033:7382) и с 2026-09-07 («Акции» — /promos, см. `SHOW_PROMOS_LINK`).
    expect([...nav.querySelectorAll("a")].map((link) => link.textContent)).toEqual([
      "Главная",
      "Заведения",
      "Афиша",
      "Гастрогид",
      "Статьи",
      "Акции",
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

  /**
   * T3 (спека `web-fixes-20260906.md`, 2026-09-06, критерий 21): «Для
   * бизнеса» ведёт на боевой лендинг `book-eat.app`, а не на несуществующий
   * `/business` — уходит внешне, в новой вкладке, без `window.opener`.
   */
  it("«Для бизнеса» ведёт на book-eat.app в новой вкладке", () => {
    render(<SiteHeader />);

    const link = screen.getByRole("link", { name: /Для бизнеса/ });
    expect(link.getAttribute("href")).toBe("https://book-eat.app/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  /**
   * Дыра № 1 (`apps/web/docs/responsive.md`, § 5): ниже `lg` строки макета
   * нет вовсе — есть бургер, который открывает панель со всеми пунктами.
   * Панель смонтирована только пока открыта: закрытая шапка не должна
   * держать вторую копию каждой ссылки в DOM.
   */
  it("бургер открывает панель со всеми пунктами меню, городом и входом", () => {
    render(<SiteHeader city="Алматы" account={null} />);

    expect(screen.queryByRole("dialog")).toBeNull();

    const trigger = screen.getByRole("button", { name: "Открыть меню" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const dialog = screen.getByRole("dialog", { name: "Меню" });
    const dialogNav = within(dialog).getByRole("navigation", { name: "Основная навигация" });
    expect(dialogNav.querySelectorAll("a")).toHaveLength(HEADER_NAV.length);
    // Панель содержит город и кнопку входа, а не только пункты меню.
    expect(within(dialog).getByText("Алматы")).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: /Войти/ })).toBeTruthy();
  });

  it("Esc закрывает панель мобильного меню", () => {
    render(<SiteHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Открыть меню" }));
    const dialog = screen.getByRole("dialog", { name: "Меню" });

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
