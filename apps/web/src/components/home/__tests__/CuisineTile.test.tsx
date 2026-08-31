import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { CuisineTile } from "@web/components/home/CuisineTile";

function photoSrc(container: HTMLElement): string | null {
  return container.querySelector("img")?.getAttribute("src") ?? null;
}

/**
 * Два дефекта, которые здесь заперты:
 *   • ряд кухонь превращался в кашу, потому что подпись шире круга, а
 *     «Средиземноморская» — одно слово и переносить его не по чему;
 *   • круги были пустыми и серыми, потому что справочник не присылает
 *     `image_url` (на тестовом стенде — ни у одной из 14 записей).
 */
describe("CuisineTile", () => {
  it("подпись стоит одной строкой и не обрезается", () => {
    render(<CuisineTile cuisine={{ id: "mediterranean", name: "Средиземноморская" }} />);

    const label = screen.getByText("Средиземноморская");
    // Именно `whitespace-nowrap`: без него ячейка шириной с круг снова
    // отдаст длинное слово соседям.
    expect(label.className).toContain("whitespace-nowrap");
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
    // Снимка нет ни в макете, ни в R2, ни в мобильных ассетах ровно у двух
    // кодов справочника — `georgian` и `authors`. 31.08.2026 к вшитым
    // снимкам добавились `japanese` и `pan_asian`: их круги В МАКЕТЕ
    // нарисованы (узлы 3254:16 и 3254:19), просто раньше не были
    // экспортированы, и оба показывали монограмму на стенде.
    const { container } = render(<CuisineTile cuisine={{ id: "georgian", name: "Грузинская" }} />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Г")).toBeTruthy();
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
