import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { webCuisineTile, webLayout } from "@bookeat/design-tokens";

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
    render(<CuisineTile cuisine={{ id: "mediterranean", name: "Средиземноморская" }} compact />);

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

  /** Тесный ряд (14 кухонь против 10 нарисованных) уменьшает и подпись, и
   * круг — но ТОЛЬКО с `xl`: уже 1280 ряд не помещается ни при каком читаемом
   * кегле, там он прокручивается вбок, и мельчить незачем. */
  it("в тесном ряду подпись и круг мельче, и только на десктопе", () => {
    const wide = render(<CuisineTile cuisine={{ id: "european", name: "Европейская" }} />);
    expect(screen.getByText("Европейская").className).toContain("text-cuisine-label");
    expect(screen.getByText("Европейская").className).not.toContain("cuisine-label-compact");
    expect(wide.container.querySelector("span")?.className).toContain("w-cuisine");
    expect(wide.container.querySelector("span")?.className).not.toContain("cuisine-compact");
    wide.unmount();

    const tight = render(<CuisineTile cuisine={{ id: "european", name: "Европейская" }} compact />);
    expect(screen.getByText("Европейская").className).toContain("xl:text-cuisine-label-compact");
    expect(tight.container.querySelector("span")?.className).toContain("xl:w-cuisine-compact");
    // Базовый размер остаётся размером макета — компакт навешан брейкпоинтом.
    expect(tight.container.querySelector("span")?.className).toContain("w-cuisine");
  });

  /**
   * Числа, на которых держится вся правка. Если кто-то поднимет кегль или
   * диаметр «чтобы было виднее», ряд из четырнадцати названий вылезет за
   * 1200 — и это должно упасть здесь, а не на стенде.
   *
   * Как получены em'ы: ширина САМОГО ДЛИННОГО СЛОВА каждого названия,
   * снятая в Chromium на Noto Sans 500 при кегле 100 (тот же шрифт, которым
   * рисует сайт), делённая на 100. Именно самое длинное слово, а не всё
   * название: ячейка это `width: min-content`, многословные названия
   * переносятся по пробелу. Названия — живой `GET /cuisines` тестового
   * стенда на 01.09.2026, все три языка справочника.
   */
  const LONGEST_WORD_EM: Record<string, readonly number[]> = {
    // Европейская, Средиземноморская, Морепродукты, Казахская, Паназиатская,
    // Итальянская, Французская, Грузинская, Турецкая, Греческая, Восточная,
    // Веганская, Авторская, Японская
    ru: [6.74, 10.8, 7.86, 5.41, 7.35, 6.78, 6.91, 6.02, 4.94, 5.43, 5.49, 5.46, 5.45, 4.96],
    // Еуропалық, Жерорта, өнімдері, асханасы, Паназиялық, Итальяндық,
    // асханасы, Грузин, асханасы, асханасы, асханасы, Веган, Авторлық, Жапон
    kk: [5.75, 4.76, 4.51, 4.96, 6.43, 6.5, 4.96, 3.66, 4.96, 4.96, 4.96, 3.1, 5.12, 3.6],
    // European, Mediterranean, Seafood, Kazakh, Pan-Asian, Italian, French,
    // Georgian, Turkish, Greek, Oriental, Vegan, Signature, Japanese
    en: [4.75, 7.3, 4.06, 3.59, 4.86, 3.1, 3.33, 4.54, 3.51, 2.98, 4.01, 3.09, 4.81, 4.54],
  };

  /**
   * Целевая ширина — НЕ 1200. Контейнер шире 1440 отдаёт ровно 1200, но между
   * 1024 и 1440 у него ещё `px-6` с каждой стороны (`Container.tsx`), и на
   * 1280 ряду достаётся 1152. Считаем по 1152: мелкий кегль включается с `xl`,
   * то есть ровно с 1280, и обязан там помещаться, иначе он включается зря.
   */
  const ROW_WIDTH_AT_LG = webLayout.containerWidth - 2 * 24;

  /** Ширина ряда: ячейка = max(круг, самое длинное слово), плюс просветы. */
  function tightRowWidth(ems: readonly number[]): number {
    const cells = ems.map((em) =>
      Math.max(webCuisineTile.sizeCompact, em * webCuisineTile.labelFontSizeCompact),
    );
    return (
      cells.reduce((sum, width) => sum + width, 0) +
      (ems.length - 1) * webCuisineTile.rowGapXCompact
    );
  }

  it.each(Object.keys(LONGEST_WORD_EM))(
    "тесный ряд из 14 кухонь укладывается в контейнер: %s",
    (lang) => {
      expect(tightRowWidth(LONGEST_WORD_EM[lang])).toBeLessThanOrEqual(ROW_WIDTH_AT_LG);
    },
  );

  /** Кегль выбран НЕ с запасом «на глазок»: он и есть максимальный, который
   * ещё помещается. Шаг вверх обязан ломать ряд — иначе подпись зря мельче,
   * чем могла бы быть. */
  it("кегль подписи выбран впритык: на пункт больше ряд уже не влезает", () => {
    const ru = LONGEST_WORD_EM.ru;
    const step = webCuisineTile.labelFontSizeCompact + 1;
    const cells = ru.map((em) => Math.max(webCuisineTile.sizeCompact, em * step));
    const width =
      cells.reduce((sum, w) => sum + w, 0) + (ru.length - 1) * webCuisineTile.rowGapXCompact;

    expect(width).toBeGreaterThan(ROW_WIDTH_AT_LG);
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
