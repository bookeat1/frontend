import type { AppUpdateDecision } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import { describe, expect, it } from "vitest";
import {
  pickPrompt,
  resolveServerText,
  restartUpdatePrompt,
  storeUpdatePrompt,
} from "../app-update";

/**
 * Правила окна «Доступна новая версия», записанные так, чтобы их нельзя было
 * потерять при следующей правке. Главное из них — молчание по умолчанию:
 * окно, которое не пускает гостя дальше, не должно появляться ни из ошибки,
 * ни из неполного ответа сервера.
 */

const t = getDictionary();

const STORE = "https://apps.apple.com/app/id6757542577";

describe("resolveServerText", () => {
  it("берёт текст выбранного языка", () => {
    expect(resolveServerText({ ru: "Русский", en: "English" }, "en", "запас")).toBe("English");
  });

  it("падает на русский, когда языка в политике нет", () => {
    // У приложения восемь языков, у политики три — корейский сюда не доедет.
    expect(resolveServerText({ ru: "Русский", en: "English" }, "ko", "запас")).toBe("Русский");
  });

  it("падает на словарь приложения, когда сервер не прислал текста вовсе", () => {
    expect(resolveServerText(undefined, "ru", "запас")).toBe("запас");
  });

  it("пустой перевод считает отсутствующим, а не текстом", () => {
    // Иначе очищенное в панели поле дало бы окно без заголовка.
    expect(resolveServerText({ en: "   ", ru: "Русский" }, "en", "запас")).toBe("Русский");
    expect(resolveServerText({ ru: "" }, "ru", "запас")).toBe("запас");
  });
});

describe("storeUpdatePrompt", () => {
  it("«none» — окна нет", () => {
    expect(storeUpdatePrompt({ action: "none" }, "ru", t)).toBeNull();
  });

  it("«recommended» — окно закрываемое, текст с сервера", () => {
    const decision: AppUpdateDecision = {
      action: "recommended",
      storeUrl: STORE,
      title: { ru: "Заголовок с сервера" },
      message: { ru: "Сообщение с сервера" },
    };
    const prompt = storeUpdatePrompt(decision, "ru", t);
    expect(prompt).toEqual({
      kind: "store",
      title: "Заголовок с сервера",
      message: "Сообщение с сервера",
      blocking: false,
      storeUrl: STORE,
    });
  });

  it("«required» — окно неснимаемое", () => {
    const prompt = storeUpdatePrompt({ action: "required", storeUrl: STORE }, "ru", t);
    expect(prompt?.blocking).toBe(true);
  });

  it("без текстов сервера подставляет разные строки для мягкого и жёсткого режима", () => {
    const soft = storeUpdatePrompt({ action: "recommended", storeUrl: STORE }, "ru", t);
    const hard = storeUpdatePrompt({ action: "required", storeUrl: STORE }, "ru", t);
    expect(soft?.title).toBe(t.appUpdate.title);
    expect(hard?.title).toBe(t.appUpdate.requiredTitle);
    expect(soft?.message).not.toBe(hard?.message);
  });

  it("без ссылки на магазин молчит даже в жёстком режиме", () => {
    // Иначе гость получил бы окно без единого выхода: кнопка ведёт в никуда,
    // а закрыть его нельзя. Пустая строка — то же самое, что отсутствие.
    expect(storeUpdatePrompt({ action: "required" }, "ru", t)).toBeNull();
    expect(storeUpdatePrompt({ action: "required", storeUrl: "   " }, "ru", t)).toBeNull();
  });
});

describe("restartUpdatePrompt", () => {
  it("всегда закрываемое и без ссылки на магазин", () => {
    const prompt = restartUpdatePrompt(t);
    expect(prompt.kind).toBe("restart");
    expect(prompt.blocking).toBe(false);
    expect(prompt.storeUrl).toBeUndefined();
  });
});

describe("pickPrompt", () => {
  it("магазин важнее перезапуска", () => {
    // Обновление по воздуху не довозит нативную часть, поэтому перезапуск не
    // решает того, из-за чего сервер просит новую сборку.
    const store = storeUpdatePrompt({ action: "recommended", storeUrl: STORE }, "ru", t);
    expect(pickPrompt(store, restartUpdatePrompt(t))?.kind).toBe("store");
  });

  it("без ответа сервера остаётся перезапуск", () => {
    expect(pickPrompt(null, restartUpdatePrompt(t))?.kind).toBe("restart");
  });

  it("когда нечего показать — null", () => {
    expect(pickPrompt(null, null)).toBeNull();
  });
});
