import { describe, expect, it } from "vitest";

import {
  SOCIAL_LINK_TYPES,
  isKnownSocialLinkType,
  normalizeSocialLink,
  parseSocialLinkRows,
  sameSocialLinks,
} from "../admin/social-links";

/**
 * Что здесь на самом деле проверяется: в приложении из каждой такой строки
 * вырастает кнопка. Кнопка, ведущая в никуда, хуже отсутствующей — гость
 * нажимает и упирается в пустой экран, а заведение об этом не узнаёт. Поэтому
 * ник превращается в ссылку, номер — в wa.me, а всё, из чего ссылку не собрать,
 * не уходит на сервер вовсе.
 */
describe("normalizeSocialLink", () => {
  it("собирает ссылку из ника Instagram — так его вставляют чаще всего", () => {
    expect(normalizeSocialLink("instagram", "@yurta.almaty")).toEqual({
      ok: true,
      url: "https://instagram.com/yurta.almaty",
    });
    expect(normalizeSocialLink("instagram", "yurta.almaty")).toEqual({
      ok: true,
      url: "https://instagram.com/yurta.almaty",
    });
    expect(normalizeSocialLink("instagram", "instagram.com/yurta.almaty/")).toEqual({
      ok: true,
      url: "https://instagram.com/yurta.almaty",
    });
  });

  it("срезает у скопированной ссылки хвост со меткой того, кто копировал", () => {
    expect(
      normalizeSocialLink("instagram", "https://www.instagram.com/yurta.almaty?igsh=MXY5"),
    ).toEqual({ ok: true, url: "https://instagram.com/yurta.almaty" });
  });

  it("не принимает за Instagram то, что им не является", () => {
    expect(normalizeSocialLink("instagram", "напишите нам в инсту")).toEqual({
      ok: false,
      error: "bad_instagram",
    });
    expect(normalizeSocialLink("instagram", "https://facebook.com/yurta")).toEqual({
      ok: false,
      error: "bad_instagram",
    });
  });

  it("превращает набранный как угодно номер в ссылку wa.me", () => {
    expect(normalizeSocialLink("whatsapp", "+7 707 000 00 00")).toEqual({
      ok: true,
      url: "https://wa.me/77070000000",
    });
    expect(normalizeSocialLink("whatsapp", "8 (707) 000-00-00")).toEqual({
      ok: true,
      url: "https://wa.me/87070000000",
    });
  });

  it("оставляет готовую ссылку WhatsApp как есть, а огрызок номера отвергает", () => {
    expect(normalizeSocialLink("whatsapp", "https://wa.me/77070000000")).toEqual({
      ok: true,
      url: "https://wa.me/77070000000",
    });
    expect(normalizeSocialLink("whatsapp", "707")).toEqual({ ok: false, error: "bad_whatsapp" });
  });

  it("дописывает схему голому адресу сайта: без неё это относительный путь", () => {
    expect(normalizeSocialLink("website", "yurta.kz")).toEqual({
      ok: true,
      url: "https://yurta.kz",
    });
    expect(normalizeSocialLink("website", "https://yurta.kz/menu")).toEqual({
      ok: true,
      url: "https://yurta.kz/menu",
    });
  });

  it("не считает ссылкой текст без домена", () => {
    expect(normalizeSocialLink("website", "наш сайт")).toEqual({ ok: false, error: "not_a_link" });
    expect(normalizeSocialLink("website", "yurta")).toEqual({ ok: false, error: "not_a_link" });
    expect(normalizeSocialLink("website", "")).toEqual({ ok: false, error: "not_a_link" });
  });

  it("незнакомый вид из старых данных обрабатывает как обычную ссылку", () => {
    expect(normalizeSocialLink("facebook", "facebook.com/yurta")).toEqual({
      ok: true,
      url: "https://facebook.com/yurta",
    });
  });
});

describe("parseSocialLinkRows", () => {
  it("выбрасывает строки с пустым адресом — это «добавил и передумал»", () => {
    expect(
      parseSocialLinkRows([
        { type: "instagram", url: "@yurta.almaty" },
        { type: "website", url: "   " },
      ]),
    ).toEqual({ ok: true, links: [{ type: "instagram", url: "https://instagram.com/yurta.almaty" }] });
  });

  it("пустой набор — это «стереть все ссылки», а не ошибка", () => {
    expect(parseSocialLinkRows([])).toEqual({ ok: true, links: [] });
    expect(parseSocialLinkRows([{ type: "website", url: "" }])).toEqual({ ok: true, links: [] });
  });

  it("показывает НОМЕР строки с ошибкой, чтобы чинить было что-то конкретное", () => {
    expect(
      parseSocialLinkRows([
        { type: "instagram", url: "@yurta.almaty" },
        { type: "website", url: "наш сайт" },
      ]),
    ).toEqual({ ok: false, index: 1, error: "not_a_link" });
  });

  it("запрещает две ссылки одного вида: вторую приложение всё равно не покажет", () => {
    expect(
      parseSocialLinkRows([
        { type: "instagram", url: "@one" },
        { type: "instagram", url: "@two" },
      ]),
    ).toEqual({ ok: false, index: 1, error: "duplicate_type" });
  });

  it("сохраняет порядок строк — он же порядок кнопок в карточке", () => {
    const result = parseSocialLinkRows([
      { type: "website", url: "yurta.kz" },
      { type: "instagram", url: "@yurta.almaty" },
    ]);
    expect(result.ok && result.links.map((l) => l.type)).toEqual(["website", "instagram"]);
  });
});

describe("виды ссылок", () => {
  it("совпадают с теми, что читает приложение (http-mapping: website/whatsapp/instagram)", () => {
    expect([...SOCIAL_LINK_TYPES].sort()).toEqual(["instagram", "website", "whatsapp"]);
    expect(isKnownSocialLinkType("instagram")).toBe(true);
    expect(isKnownSocialLinkType("Instagram")).toBe(false);
    expect(isKnownSocialLinkType("facebook")).toBe(false);
  });
});

describe("sameSocialLinks", () => {
  it("различает набор по составу и по порядку", () => {
    const a = [{ type: "instagram", url: "https://instagram.com/x" }];
    expect(sameSocialLinks(a, [{ type: "instagram", url: "https://instagram.com/x" }])).toBe(true);
    expect(sameSocialLinks(a, [{ type: "website", url: "https://instagram.com/x" }])).toBe(false);
    expect(sameSocialLinks(a, [])).toBe(false);
  });
});
