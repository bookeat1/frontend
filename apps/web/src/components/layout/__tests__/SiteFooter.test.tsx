import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { SiteFooter } from "@web/components/layout/SiteFooter";

/**
 * Подвал: T3 (спека `web-fixes-20260906.md`, 2026-09-06) сделал реальными три
 * ссылки блока «для бизнеса» в колонке «Ресторанам» — «Подключить
 * заведение», «Тарифы», «Кабинет ресторана». T4 сделал реальными ровно семь
 * текстовых страниц платформы — «О BookEat», «Вакансии», «Контакты», «Как
 * это работает», «Отмена брони», «Оферта», «Политика данных». Задача
 * 2026-09-12 добавила в колонку «Гостям» реальные адреса «Заведения»/
 * «Афиша»/«Мои брони»/«Избранное» (`FOOTER_KEY_TO_HREF` в `SiteFooter.tsx`),
 * «Гастрогид» → `/guide` добавлен той же картой следом (роут уже был в
 * `SiteHeader`, в подвале его забыли). Пункт «Поддержка» в колонке
 * «Ресторанам» отсутствует вовсе — владелец попросил отложить его до
 * появления номера WhatsApp-бота. «Блог» остаётся заглушкой `href="#"` —
 * отдельная задача, см. `apps/web/src/lib/site-links.ts`.
 */
describe("SiteFooter", () => {
  it("«Подключить заведение» и «Кабинет ресторана» ведут на боевые внешние адреса в новой вкладке", () => {
    render(<SiteFooter />);

    const column = screen.getByRole("navigation", { name: "Ресторанам" });

    const connect = within(column).getByRole("link", { name: /Подключить заведение/ });
    expect(connect.getAttribute("href")).toBe("https://book-eat.app/");
    expect(connect.getAttribute("target")).toBe("_blank");
    expect(connect.getAttribute("rel")).toBe("noopener noreferrer");

    const pricing = within(column).getByRole("link", { name: /Тарифы/ });
    expect(pricing.getAttribute("href")).toBe("https://book-eat.app/#pricing");
    expect(pricing.getAttribute("target")).toBe("_blank");
    expect(pricing.getAttribute("rel")).toBe("noopener noreferrer");

    const cabinet = within(column).getByRole("link", { name: /Кабинет ресторана/ });
    expect(cabinet.getAttribute("href")).toBe("https://admin.book-eat.com/");
    expect(cabinet.getAttribute("target")).toBe("_blank");
    expect(cabinet.getAttribute("rel")).toBe("noopener noreferrer");
  });

  /**
   * Владелец попросил отложить «Поддержку» до появления номера
   * WhatsApp-бота (2026-09-06) — пункта не должно быть в DOM вообще, ни как
   * мёртвая ссылка `href="#"`, ни как заготовка.
   */
  it("«Поддержка» отсутствует в колонке «Ресторанам»", () => {
    render(<SiteFooter />);

    const column = screen.getByRole("navigation", { name: "Ресторанам" });
    expect(within(column).queryByText("Поддержка")).toBeNull();
  });

  it("ссылки блока «для бизнеса» не ведут на href=\"#\"", () => {
    render(<SiteFooter />);

    const column = screen.getByRole("navigation", { name: "Ресторанам" });
    const links = within(column).getAllByRole("link");
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.getAttribute("href")).not.toBe("#");
    }
  });

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

  it("«Блог» остаётся заглушкой — его роут не задача этого захода", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "Блог" }).getAttribute("href")).toBe("#");
  });

  it("«Заведения»/«Афиша»/«Гастрогид»/«Мои брони»/«Избранное» ведут на реальные роуты сайта", () => {
    render(<SiteFooter />);

    const column = screen.getByRole("navigation", { name: "Гостям" });
    const expected: Record<string, string> = {
      Заведения: "/venues",
      Афиша: "/events",
      Гастрогид: "/guide",
      "Мои брони": "/profile",
      Избранное: "/profile?section=favorites",
    };

    for (const [label, href] of Object.entries(expected)) {
      expect(within(column).getByRole("link", { name: label }).getAttribute("href")).toBe(href);
    }
  });

  /**
   * Значки соцсетей в блоке марки (задача 2026-09-12): порядок и состав из
   * узла Figma 3525:14318 — WhatsApp, Instagram, телефон, никакого Telegram.
   * Instagram/WhatsApp — внешние ссылки (новая вкладка), телефон — `tel:`.
   */
  it("значки соцсетей: WhatsApp/Instagram/телефон, реальные адреса, не href=\"#\"", () => {
    render(<SiteFooter />);

    const social = screen.getByRole("list", { name: "Мы в соцсетях" });
    const links = within(social).getAllByRole("link");
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.getAttribute("href")).not.toBe("#");
    }

    const whatsapp = within(social).getByRole("link", { name: /WhatsApp, откроется в новой вкладке/ });
    expect(whatsapp.getAttribute("href")).toBe("https://wa.me/77066911392");
    expect(whatsapp.getAttribute("target")).toBe("_blank");
    expect(whatsapp.getAttribute("rel")).toBe("noopener noreferrer");

    const instagram = within(social).getByRole("link", { name: /Instagram, откроется в новой вкладке/ });
    expect(instagram.getAttribute("href")).toBe("https://www.instagram.com/bookeat_app/");
    expect(instagram.getAttribute("target")).toBe("_blank");
    expect(instagram.getAttribute("rel")).toBe("noopener noreferrer");

    const phone = within(social).getByRole("link", { name: "Телефон" });
    expect(phone.getAttribute("href")).toBe("tel:+77066911392");
    expect(phone.getAttribute("target")).toBeNull();

    // Порядок в DOM — как в макете: WhatsApp, Instagram, телефон.
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://wa.me/77066911392",
      "https://www.instagram.com/bookeat_app/",
      "tel:+77066911392",
    ]);
  });
});
