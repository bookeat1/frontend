import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { webCuisineTile } from "@bookeat/design-tokens";

import { CuisineTile } from "@web/components/home/CuisineTile";

function photoSrc(container: HTMLElement): string | null {
  return container.querySelector("img")?.getAttribute("src") ?? null;
}

/**
 * Три дефекта, которые здесь заперты:
 *   • ряд кухонь превращался в кашу, потому что подпись шире круга, а
 *     «Средиземноморская» — одно слово и переносить его не по чему;
 *   • круги были пустыми и серыми, потому что справочник не присылает
 *     `image_url` (на тестовом стенде — ни у одной из 14 записей);
 *   • название кухни ни при каких условиях не обрезается многоточием: кухня
 *     это вход в фильтр каталога, и «Средиземномо…» ничего не значит.
 */
describe("CuisineTile", () => {
  it("длинное название не рвётся внутри слова и не обрезается", () => {
    render(<CuisineTile cuisine={{ id: "mediterranean", name: "Средиземноморская" }} />);

    const label = screen.getByText("Средиземноморская");
    // Владелец 01.09.2026: «Средизем-номорская» и «Море-продукты» — баг.
    // Разрешён только перенос по пробелу, поэтому оба прежних свойства
    // (`hyphens: auto` и `overflow-wrap: anywhere`) должны быть выключены
    // ЯВНО: у `overflow-wrap` начальное значение и так `normal`, но оно
    // наследуемое и его легко вернуть соседним классом.
    expect(label.className).toContain("[hyphens:none]");
    expect(label.className).toContain("[overflow-wrap:normal]");
    expect(label.className).not.toContain("anywhere");
    expect(label.className).not.toContain("break-all");
    expect(label.className).not.toContain("truncate");
    expect(label.className).not.toContain("text-ellipsis");
  });

  /**
   * ЗНАЧЕНИЯ МАКЕТА, а не «что смотрелось лучше». Сняты из Figma REST
   * 01.09.2026: файл 49Zk9oEV3ZCiCdh6Cz9dE2, кадр 3253:2, ряд 3254:6.
   *
   *   круг 3254:8      104×104, cornerRadius 999
   *   itemSpacing 3254:7   12 (круг → подпись)
   *   подпись 3254:9   Noto Sans 16/18, weight 500, по центру
   *   просвет ряда     238,89 − 120 − 104 = 14,89 → 15
   *
   * Тест стоит здесь потому, что эти четыре числа уже один раз уезжали:
   * 01.09.2026 их ужали до 64 и 11/14, чтобы пятнадцать кухонь влезли в одну
   * строку без прокрутки. Прокрутка вернула размеры макета, и следующая
   * попытка «немного уменьшить, чтобы влезло» обязана упасть здесь.
   */
  it("держит размеры макета", () => {
    expect(webCuisineTile).toEqual({
      size: 104,
      gap: 12,
      labelFontSize: 16,
      labelLineHeight: 18,
      labelFontWeight: 500,
      rowGapX: 15,
    });
  });

  it("рисует круг и подпись размера макета на любой ширине", () => {
    const { container } = render(<CuisineTile cuisine={{ id: "european", name: "Европейская" }} />);

    const circle = container.querySelector("span");
    expect(circle?.className).toContain("h-cuisine");
    expect(circle?.className).toContain("w-cuisine");
    expect(screen.getByText("Европейская").className).toContain("text-cuisine-label");
    // Ни размера, ни кегля, навешанного брейкпоинтом: ряд прокручивается,
    // ужимать его под ширину окна больше незачем.
    expect(container.innerHTML).not.toContain("compact");
    expect(container.innerHTML).not.toMatch(/(md|lg|xl|2xl):(w|h|text)-cuisine/);
  });

  it("без ссылки в справочнике берёт снимок из макета", () => {
    // Картинка декоративная (alt=""), рядом стоит подпись — поэтому ищем
    // тегом, а не ролью: у пустого alt роль `presentation`.
    const { container } = render(<CuisineTile cuisine={{ id: "european", name: "Европейская" }} />);

    expect(photoSrc(container)).toContain("/cuisines/european.webp");
  });

  it("ссылка справочника важнее вшитого снимка", () => {
    const { container } = render(
      <CuisineTile
        cuisine={{ id: "european", name: "Европейская", imageUrl: "https://cdn/eu.png" }}
      />,
    );

    expect(photoSrc(container)).toBe("https://cdn/eu.png");
  });

  it("битая ссылка справочника роняет круг на вшитый снимок, а не в пустоту", () => {
    const { container } = render(
      <CuisineTile
        cuisine={{ id: "european", name: "Европейская", imageUrl: "https://cdn/gone.png" }}
      />,
    );

    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    fireEvent.error(image as HTMLImageElement);

    expect(photoSrc(container)).toContain("/cuisines/european.webp");
  });

  it("кухня без картинки вовсе показывает монограмму, а не серый круг", () => {
    // С 02.09.2026 вшитый снимок есть у ВСЕХ кодов справочника (см.
    // cuisine-photos.ts), поэтому монограмма — запас на будущее: код, которого
    // в карте нет (шестнадцатая кухня), обязан показать букву, а не пустой
    // серый круг.
    const { container } = render(<CuisineTile cuisine={{ id: "fusion", name: "Фьюжн" }} />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Ф")).toBeTruthy();
  });

  it("у каждого кода справочника есть вшитый снимок — монограмм в ряду нет", () => {
    // Все 15 кодов `GET /cuisines` на 02.09.2026. Владелец увидел монограммы
    // у «Грузинской» и «Индийской» на скриншоте 01.09.2026 — этот тест
    // запирает возврат буквы для ЛЮБОЙ кухни справочника.
    const codes = [
      "european",
      "mediterranean",
      "seafood",
      "kazakh",
      "pan_asian",
      "italian",
      "french",
      "georgian",
      "turkish",
      "greek",
      "oriental",
      "vegan",
      "authors",
      "japanese",
      "indian",
    ];
    for (const code of codes) {
      const { container, unmount } = render(<CuisineTile cuisine={{ id: code, name: code }} />);
      expect(photoSrc(container), code).toMatch(/\/cuisines\/[a-z_-]+\.webp$/);
      unmount();
    }
  });

  it("у японской и паназиатской кухни есть вшитый снимок из макета", () => {
    const japanese = render(<CuisineTile cuisine={{ id: "japanese", name: "Японская" }} />);
    expect(photoSrc(japanese.container)).toContain("/cuisines/japanese.webp");
    japanese.unmount();

    const panAsian = render(<CuisineTile cuisine={{ id: "pan_asian", name: "Паназиатская" }} />);
    expect(photoSrc(panAsian.container)).toContain("/cuisines/pan_asian.webp");
  });

  it("ведёт в каталог с фильтром по этой кухне", () => {
    render(<CuisineTile cuisine={{ id: "pan_asian", name: "Паназиатская" }} />);

    expect(screen.getByRole("link").getAttribute("href")).toBe("/venues?cuisine=pan_asian");
  });
});
