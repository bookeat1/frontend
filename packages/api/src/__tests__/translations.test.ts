import { describe, expect, it } from "vitest";

import {
  buildTranslationPatch,
  classifyTranslationFailure,
  emptyTranslationDraft,
  missingTranslations,
  removedTranslations,
  translationDraftFrom,
  translationsChanged,
} from "../admin/translations";
import { RepositoryError } from "../repository";

/**
 * Переводы контента. Проверяется ГРАНИЦА между тремя состояниями языка, потому
 * что именно она и есть весь смысл частичного формата: «записать», «удалить» и
 * «не трогать» на проводе выглядят по-разному, и перепутать их — значит
 * молча стереть чужой текст.
 */

describe("translationDraftFrom", () => {
  it("берёт только kk и en: русский текст живёт в колонке, а не в карте", () => {
    const draft = translationDraftFrom({ ru: "Скидка", kk: "Жеңілдік", en: "Discount" });
    expect(draft).toEqual({ kk: "Жеңілдік", en: "Discount" });
  });

  it("карты нет — черновик пустой, а не undefined", () => {
    expect(translationDraftFrom()).toEqual(emptyTranslationDraft());
    expect(translationDraftFrom(null)).toEqual({ kk: "", en: "" });
  });
});

describe("buildTranslationPatch — уходят ТОЛЬКО изменённые языки", () => {
  it("тронули казахский — английского в теле нет вовсе", () => {
    const patch = buildTranslationPatch(
      { kk: "Жаңа мәтін", en: "Discount" },
      { kk: "Ескі мәтін", en: "Discount" },
    );
    expect(patch).toEqual({ kk: "Жаңа мәтін" });
    // Ключа `en` нет — сервер оставит английский как есть. Если бы он тут был,
    // сохранение затёрло бы правку, сделанную кем-то другим.
    expect(patch && "en" in patch).toBe(false);
  });

  it("ничего не меняли — ключа поля в теле не будет совсем", () => {
    expect(buildTranslationPatch({ kk: "Жеңілдік", en: "" }, { kk: "Жеңілдік" })).toBeUndefined();
  });

  it("пустое поле у существующего перевода — это null, то есть «удалить»", () => {
    expect(buildTranslationPatch({ kk: "", en: "Discount" }, { kk: "Жеңілдік", en: "Discount" }))
      .toEqual({ kk: null });
  });

  it("пустое поле там, где перевода и не было, ничего не шлёт", () => {
    expect(buildTranslationPatch({ kk: "", en: "" }, {})).toBeUndefined();
    expect(buildTranslationPatch({ kk: "   ", en: "" })).toBeUndefined();
  });

  it("русский в патч не попадает никогда — даже если он лежал в карте", () => {
    const patch = buildTranslationPatch({ kk: "Жаңа", en: "" }, { ru: "Старый", kk: "Ескі" });
    expect(patch).toEqual({ kk: "Жаңа" });
    expect(patch && "ru" in patch).toBe(false);
  });

  it("пробелы по краям срезаются: сервер всё равно читает пробельную строку как пустую", () => {
    expect(buildTranslationPatch({ kk: "  Жеңілдік  ", en: "" }, {})).toEqual({ kk: "Жеңілдік" });
    // «Жеңілдік» уже сохранён — добавленные пробелы не повод для записи.
    expect(buildTranslationPatch({ kk: " Жеңілдік ", en: "" }, { kk: "Жеңілдік" })).toBeUndefined();
  });

  it("создание записи: уходят только заполненные языки", () => {
    expect(buildTranslationPatch({ kk: "Жеңілдік", en: "" })).toEqual({ kk: "Жеңілдік" });
  });
});

describe("что человеку показать до нажатия «Сохранить»", () => {
  it("missingTranslations называет языки без перевода", () => {
    expect(missingTranslations({ kk: "", en: "Discount" })).toEqual(["kk"]);
    expect(missingTranslations({ kk: " ", en: "" })).toEqual(["kk", "en"]);
    expect(missingTranslations({ kk: "Жеңілдік", en: "Discount" })).toEqual([]);
  });

  it("removedTranslations — это языки, которые сохранение УДАЛИТ", () => {
    expect(removedTranslations({ kk: "", en: "Discount" }, { kk: "Жеңілдік", en: "Discount" }))
      .toEqual(["kk"]);
    // Пустое поле там, где перевода не было, ничего не удаляет — и пугать этим
    // нельзя: удаления не произойдёт.
    expect(removedTranslations({ kk: "", en: "" }, {})).toEqual([]);
  });

  it("translationsChanged согласован с патчем", () => {
    expect(translationsChanged({ kk: "Жаңа", en: "" }, { kk: "Ескі" })).toBe(true);
    expect(translationsChanged({ kk: "Ескі", en: "" }, { kk: "Ескі" })).toBe(false);
  });
});

describe("чужие локали старого импорта (ko/zh) — не наше дело", () => {
  it("в черновик они не попадают: кабинет их не правит", () => {
    expect(translationDraftFrom({ ko: "목록", zh: "合集", kk: "Тізім" })).toEqual({
      kk: "Тізім",
      en: "",
    });
  });

  it("в патч они не попадают ни значением, ни удалением", () => {
    // Пустой английский рядом с чужими локалями не должен превратиться в
    // попытку что-то из них стереть.
    const patch = buildTranslationPatch({ kk: "Жаңа", en: "" }, { ko: "목록", zh: "合集" });
    expect(patch).toEqual({ kk: "Жаңа" });
    expect(Object.keys(patch ?? {})).toEqual(["kk"]);
  });

  it("правка только русского текста вообще не рождает патча — чужие языки в покое", () => {
    // Сервер отвергает неподдерживаемый язык с 422, а нетронутые ключи
    // сохраняет сам, поэтому единственно верное поведение — молчать про них.
    expect(buildTranslationPatch({ kk: "", en: "" }, { ko: "목록", zh: "合集" })).toBeUndefined();
  });
});

describe("classifyTranslationFailure", () => {
  it("422 — сервер отказал и НИЧЕГО не записал", () => {
    const failure = classifyTranslationFailure(new RepositoryError("validation failed", undefined, 422));
    expect(failure.kind).toBe("refused");
    expect(failure.applied).toBe(false);
  });

  it("401/403/404 различимы", () => {
    expect(classifyTranslationFailure(new RepositoryError("x", undefined, 401)).kind).toBe(
      "unauthorized",
    );
    expect(classifyTranslationFailure(new RepositoryError("x", undefined, 403)).kind).toBe(
      "forbidden",
    );
    expect(classifyTranslationFailure(new RepositoryError("x", undefined, 404)).kind).toBe(
      "not_found",
    );
  });

  it("обрыв связи и 5xx — «неизвестно, записалось ли», а не «не записалось»", () => {
    expect(classifyTranslationFailure(new Error("network"))).toEqual({
      kind: "unknown",
      applied: "unknown",
    });
    expect(classifyTranslationFailure(new RepositoryError("x", undefined, 500)).applied).toBe(
      "unknown",
    );
  });
});
