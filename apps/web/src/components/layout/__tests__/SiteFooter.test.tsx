import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SiteFooter } from "@web/components/layout/SiteFooter";

/**
 * Подвал: T4 сделал реальными ровно семь ссылок — «О BookEat», «Вакансии»,
 * «Контакты», «Как это работает», «Отмена брони», «Оферта», «Политика
 * данных». Остальные пункты (заведения, афиша, гастрогид, брони, избранное,
 * «Подключить заведение», тарифы, кабинет, поддержка, блог) — задача T3, не
 * этого PR, и намеренно остаются как были (`href="#"`), см.
 * `apps/web/src/lib/site-links.ts`.
 */
describe("SiteFooter", () => {
  it("семь текстовых страниц ведут на свои реальные роуты", () => {
    render(<SiteFooter />);

    const expected: Record<string, string> = {
      "О BookEat": "/about",
      Вакансии: "/jobs",
      Контакты: "/contacts",
      "Как это работает": "/how-it-works",
      "Отмена брони": "/cancellation",
      Оферта: "/offer",
      "Политика данных": "/privacy",
    };

    for (const [label, href] of Object.entries(expected)) {
      expect(screen.getByRole("link", { name: label }).getAttribute("href")).toBe(href);
    }
  });

  it("пункты вне T4 остаются заглушками — эта задача их не трогает", () => {
    render(<SiteFooter />);

    for (const label of ["Заведения", "Кабинет ресторана", "Блог", "Поддержка"]) {
      expect(screen.getByRole("link", { name: label }).getAttribute("href")).toBe("#");
    }
  });
});
