import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { SiteFooter } from "@web/components/layout/SiteFooter";

/**
 * T3 (спека `web-fixes-20260906.md`, 2026-09-06). Этот PR закрывает только
 * блок «для бизнеса» колонки «Ресторанам» (критерии 22–23, частично);
 * остальные колонки подвала и «Поддержка» — вне скоупа, см. комментарий в
 * `SiteFooter.tsx`.
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
});
