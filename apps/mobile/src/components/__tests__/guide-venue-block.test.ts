import { describe, expect, it } from "vitest";
import { guideFooterParts, instagramHandle } from "../articles/GuideVenueBlock";

/**
 * Подпись блока в макете — «адрес · @инстаграм». В карточке заведения это поле
 * заполняют вручную, и в живом каталоге там лежит что угодно: полная ссылка,
 * ссылка со слешом на конце, голый ник, ник уже с собакой. Все эти варианты
 * должны печататься одинаково — иначе в одной статье будет «@mongol.almaty», а
 * в соседней «https://instagram.com/mongol.almaty/».
 */
describe("instagramHandle", () => {
  it("сводит все формы записи к одному «@нику»", () => {
    for (const raw of [
      "https://instagram.com/mongol.almaty",
      "https://www.instagram.com/mongol.almaty/",
      "instagram.com/mongol.almaty",
      "mongol.almaty",
      "@mongol.almaty",
      "  mongol.almaty  ",
    ]) {
      expect(instagramHandle(raw)).toBe("@mongol.almaty");
    }
  });

  it("отбрасывает хвост запроса и вложенный путь", () => {
    expect(instagramHandle("https://instagram.com/mongol.almaty?hl=ru")).toBe("@mongol.almaty");
    expect(instagramHandle("https://instagram.com/mongol.almaty/reels/")).toBe("@mongol.almaty");
  });

  it("пустое значение печатает пустотой, а не одинокой собакой", () => {
    expect(instagramHandle("")).toBe("");
    expect(instagramHandle("   ")).toBe("");
    expect(instagramHandle("https://instagram.com/")).toBe("");
  });
});

/**
 * Подпись «адрес · @инстаграм» в макете (node 1013:13736) собрана из трёх
 * элементов, и точка между ними — не часть текста, а отдельный кегль. Значит,
 * разделитель решается данными: у половины живого каталога инстаграма нет
 * вовсе, а у части подборок адрес пустой.
 */
describe("guideFooterParts", () => {
  it("ставит точку только когда есть обе части", () => {
    expect(guideFooterParts("Курмангазы, 43", "https://instagram.com/mongol.almaty")).toEqual({
      address: "Курмангазы, 43",
      handle: "@mongol.almaty",
      separator: true,
    });
  });

  it("без инстаграма оставляет один адрес и убирает точку", () => {
    expect(guideFooterParts("Курмангазы, 43", "")).toEqual({
      address: "Курмангазы, 43",
      handle: "",
      separator: false,
    });
  });

  it("без адреса оставляет один ник и убирает точку", () => {
    expect(guideFooterParts("   ", "@mongol.almaty")).toEqual({
      address: "",
      handle: "@mongol.almaty",
      separator: false,
    });
  });

  it("ссылка, из которой не вышло ника, считается пустой", () => {
    expect(guideFooterParts("", "https://instagram.com/")).toBeNull();
  });

  it("пустая подпись не рисуется вовсе", () => {
    expect(guideFooterParts("", "")).toBeNull();
  });
});
