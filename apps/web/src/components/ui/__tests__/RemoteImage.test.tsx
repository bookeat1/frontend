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

  /**
   * Одиночный крупный блок (карта 788×280 на странице заведения) без подписи
   * читается как дырка в странице, а не как «не загрузилось». Сетке плиток
   * подпись не нужна — поэтому это проп, а не поведение по умолчанию.
   */
  it("с `fallback` вместо картинки показывается объяснение", () => {
    render(
      <RemoteImage
        src={remote}
        alt="Карта"
        sizes="788px"
        fallback={<span>Карта сейчас недоступна.</span>}
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Карта" }));

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Карта сейчас недоступна.")).toBeTruthy();
  });

  it("без `fallback` подложка остаётся молчаливой", () => {
    const { container } = render(<RemoteImage src={null} alt="Flour Demi" sizes="282px" />);

    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(container.textContent).toBe("");
  });

  /**
   * `fit="letterboxed"` — двухслойная обложка для портретных сторис-постеров
   * (`EventScreen`/`PromoScreen`, 2026-09-15): размытая подложка `cover` на
   * весь контейнер + то же фото целиком поверх, `contain`, без обрезки —
   * иначе `object-cover` в широком баннере отрезает верх/низ портретного
   * постера, где обычно весь текст.
   */
  describe("fit=\"letterboxed\"", () => {
    it("рисует два слоя одной картинки: размытый фон и фото целиком поверх", () => {
      const { container } = render(
        <RemoteImage src={remote} alt="Афиша концерта" sizes="798px" fit="letterboxed" />,
      );

      // Фоновый слой decorative: `alt=""` даёт ему роль "presentation", не
      // "img" — `getAllByRole` его не увидит, поэтому здесь запрос по тегу
      // напрямую через контейнер.
      const images = container.querySelectorAll("img");
      expect(images).toHaveLength(2);

      const [background, foreground] = Array.from(images);
      expect(background.getAttribute("src")).toBe(remote);
      expect(background.getAttribute("aria-hidden")).toBe("true");
      expect(background.className).toContain("object-cover");
      expect(background.className).toContain("blur-");

      expect(foreground.getAttribute("src")).toBe(remote);
      expect(foreground.className).toContain("object-contain");
      expect(foreground).toBe(screen.getByRole("img", { name: "Афиша концерта" }));
    });

    it("битая ссылка убирает оба слоя, а не оставляет обрезанный огрызок", () => {
      render(
        <RemoteImage src={remote} alt="Афиша концерта" sizes="798px" fit="letterboxed" />,
      );

      fireEvent.error(screen.getByRole("img", { name: "Афиша концерта" }));

      expect(screen.queryAllByRole("img", { hidden: true })).toHaveLength(0);
    });
  });
});
