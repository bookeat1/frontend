import { describe, expect, it } from "vitest";
import { instagramHandle } from "../articles/GuideVenueBlock";

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
