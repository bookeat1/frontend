import type { MenuDish, MenuHighlight } from "@bookeat/api";
import { describe, expect, it } from "vitest";
import { dishCardFromHighlight, dishCardFromMenuDish } from "../dish-card";

/**
 * Одно блюдо приезжает двумя формами, и карточка обязана показывать обе
 * одинаково честно. Главное, что здесь проверяется, — деньги: незаполненная
 * цена НЕ должна превращаться ни в «0 ₸», ни в пустое место.
 */

const DISH: MenuDish = {
  id: "d1",
  name: "Баклажан",
  description: "Печёный, с йогуртом",
  priceMinor: 390000,
  imageUrl: null,
  isAvailable: true,
};

const HIGHLIGHT: MenuHighlight = {
  id: "h1",
  name: "Люля",
  description: "Баранина на углях",
  price: "5\u00a0400 ₸",
  // `price_minor` с сервера (2026-08-27). До него у блюда из ленты числа не
  // было вовсе, и «Добавить» на карточке была выключена.
  priceMinor: 540_000,
  isTopPick: true,
  photo: undefined,
};

describe("dishCardFromMenuDish", () => {
  it("цену в тиынах печатает строкой и оставляет число для подсчёта итога", () => {
    const card = dishCardFromMenuDish(DISH);
    expect(card.priceLabel).toBe("3\u00a0900\u00a0₸");
    expect(card.priceMinor).toBe(390000);
  });

  it("блюдо без цены — priceLabel null, а не «0 ₸»", () => {
    const card = dishCardFromMenuDish({ ...DISH, priceMinor: null });
    expect(card.priceLabel).toBeNull();
    expect(card.priceMinor).toBeNull();
  });

  it("стоп-лист переносится как есть", () => {
    expect(dishCardFromMenuDish({ ...DISH, isAvailable: false }).isAvailable).toBe(false);
  });
});

describe("dishCardFromHighlight", () => {
  it("печатает готовую строку цены, а считает по числу с сервера", () => {
    const card = dishCardFromHighlight(HIGHLIGHT);
    // Печатаем ровно то, что пришло строкой…
    expect(card.priceLabel).toBe(HIGHLIGHT.price);
    // …а считаем по `price_minor`, а не по разбору этой строки обратно.
    expect(card.priceMinor).toBe(540_000);
  });

  it("сервер не дал числа — priceMinor null, и «Добавить» останется выключенной", () => {
    // Старая сборка бэкенда или цена, которую сервер не смог перевести. Ноль
    // читался бы как «бесплатно», разбор «5 400 ₸» — как выдуманные деньги.
    const card = dishCardFromHighlight({ ...HIGHLIGHT, priceMinor: null });
    expect(card.priceMinor).toBeNull();
    expect(card.priceLabel).toBe(HIGHLIGHT.price);
  });

  it("пустая строка цены — это «цену уточняйте», а не пустое место", () => {
    // `formatMenuPrice` отдаёт "" для незаполненной цены (Number("") === 0
    // сделал бы из неё бесплатное блюдо).
    expect(dishCardFromHighlight({ ...HIGHLIGHT, price: "" }).priceLabel).toBeNull();
    expect(dishCardFromHighlight({ ...HIGHLIGHT, price: "   " }).priceLabel).toBeNull();
  });

  it("в ленте живут только доступные блюда, поэтому карточка не врёт про стоп-лист", () => {
    // Недоступные блюда в ленту не попадают: их отбрасывает СЕРВЕР
    // (usecase/menu.resolveHighlights).
    expect(dishCardFromHighlight(HIGHLIGHT).isAvailable).toBe(true);
  });

  it("фото берётся из photo.uri, а его отсутствие — это null", () => {
    expect(dishCardFromHighlight(HIGHLIGHT).imageUrl).toBeNull();
    const withPhoto = dishCardFromHighlight({
      ...HIGHLIGHT,
      photo: { id: "p", uri: "https://cdn/x.jpg", width: 800, height: 600, alt: "Люля" },
    });
    expect(withPhoto.imageUrl).toBe("https://cdn/x.jpg");
  });
});
