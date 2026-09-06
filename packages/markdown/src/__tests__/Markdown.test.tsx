import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Markdown } from "../Markdown";

// jest-dom не объявлен зависимостью этого репозитория (см. TESTING.md) —
// утверждения написаны на `textContent`/`getAttribute`/`querySelector`, а не
// на матчерах вроде `toBeInTheDocument`.

describe("Markdown", () => {
  it("renders GFM tables and h2-h4 headings", () => {
    render(
      <Markdown>{`## Раздел\n\n### Подраздел\n\n#### Мелкий заголовок\n\n| Поле | Значение |\n| --- | --- |\n| ИИН | 000000000000 |\n`}</Markdown>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Раздел" })).not.toBeNull();
    expect(screen.getByRole("heading", { level: 3, name: "Подраздел" })).not.toBeNull();
    expect(screen.getByRole("heading", { level: 4, name: "Мелкий заголовок" })).not.toBeNull();
    expect(screen.getByRole("table")).not.toBeNull();
    expect(screen.getByText("000000000000")).not.toBeNull();
  });

  it("drops a top-level h1 — the page's own title owns that slot", () => {
    render(<Markdown>{`# Не должно отрендериться\n\nТекст.`}</Markdown>);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByText("Текст.")).not.toBeNull();
  });

  it("never renders a <script> tag from raw HTML in the body", () => {
    const { container } = render(<Markdown>{`Текст <script>alert(1)</script> ещё текст`}</Markdown>);
    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toContain("<script>");
  });

  it("never renders a javascript: link", () => {
    const { container } = render(<Markdown>{`[Кликни](javascript:alert(1))`}</Markdown>);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href") ?? "").not.toMatch(/javascript:/i);
  });

  it("opens external links in a new tab with rel=noopener noreferrer", () => {
    render(<Markdown>{`[BookEat](https://book-eat.com)`}</Markdown>);
    const link = screen.getByRole("link", { name: "BookEat" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("href")).toBe("https://book-eat.com");
  });

  it("renders an https image but drops an http one", () => {
    const { container } = render(
      <Markdown>{`![ок](https://example.com/a.png)\n\n![не ок](http://example.com/b.png)`}</Markdown>,
    );
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute("src")).toBe("https://example.com/a.png");
  });
});
