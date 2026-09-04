import { describe, expect, it } from "vitest";
import {
  cuisineLabelLines,
  cuisineLabelText,
  hyphenateWord,
  MAX_SINGLE_LINE_CHARS,
} from "../cuisine-label";

/**
 * Перенос подписи кухни — чистая строка, поэтому и проверяется по строке:
 * что именно увидит гость, а не какое свойство выставил react-native-web.
 */
describe("cuisineLabelText", () => {
  it("«Средиземноморская» переносится по слогу с дефисом, а не по букве", () => {
    expect(cuisineLabelText("Средиземноморская")).toBe("Средиземно-\nморская");
    // Регистр и пробелы по краям из кабинета — не помеха словарю.
    expect(cuisineLabelText("  средиземноморская ")).toBe("Средиземно-\nморская");
    expect(cuisineLabelText("Средиземноморская")).not.toContain("Средиземноморска\n");
  });

  it("все остальные боевые названия остаются одной строкой как есть", () => {
    for (const name of [
      "Европейская",
      "Казахская",
      "Грузинская",
      "Греческая",
      "Морепродукты",
      "Паназиятская",
      "Итальянская",
      "Авторская",
      "Seafood",
      "Теңіз өнімдері",
    ]) {
      expect(cuisineLabelText(name)).toBe(name);
      expect(cuisineLabelText(name)).not.toContain("\n");
    }
  });

  it("неизвестное длинное слово из справочника переносится по слогу, а не ужимается", () => {
    expect(cuisineLabelText("Ближневосточная")).toBe("Ближне-\nвосточная");
    // Известное — из словаря, по морфеме; неизвестное — эвристикой, по слогу
    // (Ла-ти-но-а-ме-ри-кан-ская, разрыв ближе к середине): не морфемно, но
    // и не по букве, что и требуется.
    expect(cuisineLabelText("Латиноамериканская")).toBe("Латино-\nамериканская");
    expect(hyphenateWord("Латиноамериканская")).toBe("Латиноаме-\nриканская");
    // Длинное слово внутри составного названия — тоже по слогу.
    expect(cuisineLabelText("Средиземноморская кухня")).toBe("Средиземно-\nморская кухня");
  });

  it("перенос никогда не начинает строку с ь/ъ/й и не оставляет хвост короче трёх букв", () => {
    const word = "Экспериментальная";
    const [head, tail] = hyphenateWord(word).split("\n");
    expect(head?.endsWith("-")).toBe(true);
    expect(tail && tail.length >= 3).toBe(true);
    expect(/^[ьъй]/i.test(tail ?? "")).toBe(false);
    expect(head?.slice(0, -1).length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("слово, которое переносить не по чему, возвращается целым", () => {
    expect(hyphenateWord("BBQGRLLSTKHS")).toBe("BBQGRLLSTKHS");
    expect(cuisineLabelText("")).toBe("");
  });

  it("порог одной строки покрывает самые длинные названия макета", () => {
    // «Морепродукты» и «Паназиятская» (12) в макете 3447:12763 стоят в одну
    // строку; «Средиземноморская» (17) — единственное исключение владельца.
    expect(MAX_SINGLE_LINE_CHARS).toBeGreaterThanOrEqual("Морепродукты".length);
    expect(MAX_SINGLE_LINE_CHARS).toBeLessThan("Средиземноморская".length);
  });
});

describe("cuisineLabelLines", () => {
  it("одна строка без переносов, две — с явным переносом или пробелом", () => {
    expect(cuisineLabelLines("Морепродукты")).toBe(1);
    expect(cuisineLabelLines("Средиземно-\nморская")).toBe(2);
    expect(cuisineLabelLines("Теңіз өнімдері")).toBe(2);
    // Неразрывный пробел — не разделитель: RN по нему не переносит.
    expect(cuisineLabelLines("Теңіз өнімдері")).toBe(1);
  });
});
