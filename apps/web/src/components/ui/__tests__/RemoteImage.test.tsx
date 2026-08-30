import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { RemoteImage } from "@web/components/ui/RemoteImage";

/**
 * Фотографии приходят с доменов, которых нет ни в одном конфиге (бакет R2,
 * старый Supabase Storage, ссылки, вставленные руками). Тест закрепляет три
 * обещания: адрес уходит в <img> КАК ЕСТЬ (никакой оптимизации и никаких
 * `remotePatterns`), отсутствие адреса не рисует картинку, и битая ссылка
 * убирает <img>, а не оставляет дыру в вёрстке.
 *
 * Оговорка: в vitest `next/image` работает БЕЗ нашего `loaderFile` — тот
 * подставляется сборкой Next, а не рантаймом. Поэтому пройденный тест ещё не
 * доказывает, что в собранном приложении адрес не переписывается; это
 * проверено отдельно на реальной сборке (`next build && next start`,
 * 2026-08-30: в HTML стоит исходная ссылка на `pub-…r2.dev`, без
 * `/_next/image`).
 */
describe("RemoteImage", () => {
  const remote = "https://pub-41b6f06fc8e74b6e959cdd6def081e22.r2.dev/venues/flour.jpg";

  it("отдаёт адрес браузеру без переписывания", () => {
    render(<RemoteImage src={remote} alt="Flour Demi" sizes="282px" />);

    const image = screen.getByRole("img", { name: "Flour Demi" });
    expect(image.getAttribute("src")).toBe(remote);
    // Ровно один адрес и никакого `srcSet`: наш загрузчик отдаёт одну и ту же
    // ссылку на любую ширину, и список из шестнадцати её копий был бы
    // килобайтом разметки на каждую фотографию.
    expect(image.getAttribute("srcset")).toBeNull();
    expect(image.getAttribute("loading")).toBe("lazy");
  });

  it("без адреса картинки нет вовсе, а место остаётся", () => {
    const { container } = render(<RemoteImage src={null} alt="Flour Demi" sizes="282px" />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(container.firstElementChild?.className).toContain("h-full");
  });

  it("пустая строка адресом не считается", () => {
    render(<RemoteImage src="   " alt="Flour Demi" sizes="282px" />);

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("битая ссылка убирает картинку, а не оставляет дыру", () => {
    render(<RemoteImage src={remote} alt="Flour Demi" sizes="282px" />);

    fireEvent.error(screen.getByRole("img", { name: "Flour Demi" }));

    expect(screen.queryByRole("img")).toBeNull();
  });
});
