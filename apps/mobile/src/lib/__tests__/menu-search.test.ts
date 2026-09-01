import type { MenuDish } from "@bookeat/api";
import { describe, expect, it } from "vitest";
import { filterMenuSections } from "../menu-search";

/**
 * Поиск по меню (макет 918:11948, поле 3563:7051).
 *
 * Проверяем ГРАНИЦЫ отбора, а не середину: пустой запрос, запрос из одних
 * пробелов, слово только в описании, два слова, регистр и раздел, из которого
 * выпало всё.
 */

function dish(id: string, name: string, description = ""): MenuDish {
  return { id, name, description, priceMinor: 100000, imageUrl: null, isAvailable: true };
}

const sections = [
  {
    title: "Мангал",
    data: [
      dish("1", "Стейк Рибай", "Говядина, овощи гриль, фирменный соус"),
      dish("2", "Люля-кебаб", "Баранина, лук, специи"),
    ],
  },
  {
    title: "Холодные закуски",
    data: [dish("3", "Пахлава", "Мёд, грецкий орех")],
  },
];

describe("filterMenuSections", () => {
  it("пустой запрос отдаёт меню целиком, а не пустой список", () => {
    expect(filterMenuSections(sections, "")).toHaveLength(2);
    expect(filterMenuSections(sections, "   ")).toHaveLength(2);
    expect(filterMenuSections(sections, "")[0].data).toHaveLength(2);
  });

  it("находит по названию блюда без учёта регистра", () => {
    const found = filterMenuSections(sections, "рИбАй");
    expect(found).toHaveLength(1);
    expect(found[0].title).toBe("Мангал");
    expect(found[0].data.map((d) => d.id)).toEqual(["1"]);
  });

  it("находит по ИНГРЕДИЕНТУ, то есть по описанию — так подписано поле", () => {
    const found = filterMenuSections(sections, "баранина");
    expect(found.flatMap((s) => s.data).map((d) => d.id)).toEqual(["2"]);
  });

  it("несколько слов соединяются И: находит только блюдо, где есть оба", () => {
    // «соус» есть у рибая, «баранина» — у люля. Ни у кого нет обоих.
    expect(filterMenuSections(sections, "баранина соус")).toEqual([]);
    // А эти два слова живут в одном блюде (название + описание).
    const both = filterMenuSections(sections, "рибай говядина");
    expect(both.flatMap((s) => s.data).map((d) => d.id)).toEqual(["1"]);
  });

  it("раздел, из которого выпали все блюда, исчезает целиком", () => {
    const found = filterMenuSections(sections, "мёд");
    expect(found.map((s) => s.title)).toEqual(["Холодные закуски"]);
  });

  it("название раздела в поиск НЕ входит: «мангал» не вытаскивает весь раздел", () => {
    expect(filterMenuSections(sections, "мангал")).toEqual([]);
  });

  it("ё и е — одна буква, свёртка симметричная", () => {
    // Баг с ревью PR #102: на русской клавиатуре телефона ё нет на основном
    // ряду, а редакция пишет «Мёд, грецкий орех». Запрос «мед» не находил
    // ничего.
    expect(filterMenuSections(sections, "мед").flatMap((s) => s.data).map((d) => d.id)).toEqual([
      "3",
    ]);
    // Обратное направление тоже: «ё» в запросе против «е» в данных.
    const withE = [{ title: "Десерты", data: [dish("9", "Мед горный")] }];
    expect(filterMenuSections(withE, "мёд")).toHaveLength(1);
    // И заглавная Ё.
    expect(filterMenuSections(sections, "МЁД").flatMap((s) => s.data)).toHaveLength(1);
  });

  it("ничего не совпало — пустой список, а не исходное меню", () => {
    expect(filterMenuSections(sections, "суши")).toEqual([]);
  });

  it("не меняет входной массив и порядок внутри раздела", () => {
    const before = JSON.stringify(sections);
    const found = filterMenuSections(sections, "а");
    expect(JSON.stringify(sections)).toBe(before);
    expect(found[0].data.map((d) => d.id)).toEqual(["1", "2"]);
  });
});
