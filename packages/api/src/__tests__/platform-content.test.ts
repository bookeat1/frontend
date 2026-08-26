import { describe, expect, it } from "vitest";

import { RepositoryError } from "../repository";
import {
  MAX_ACTION_URL_LENGTH,
  classifyPlatformContentFailure,
  validateActionUrl,
} from "../admin/platform-content";

/**
 * Ссылка кнопки события и отказы платформенного контента — договорённость с
 * бэкендом (backend PR #103), поэтому проверяется без DOM.
 *
 * Случаи один в один повторяют `domain.ValidateExternalActionURL`: если правило
 * на сервере поменяется, здесь должно стать красным.
 */
describe("validateActionUrl", () => {
  it("пропускает обычные http и https", () => {
    expect(validateActionUrl("https://ticketon.kz/event/42")).toBeNull();
    expect(validateActionUrl("http://ticketon.kz/event/42")).toBeNull();
    // Регистр схемы сервер тоже принимает: url.Parse её складывает.
    expect(validateActionUrl("HTTPS://ticketon.kz/x")).toBeNull();
    // Пробелы по краям сервер срезает сам.
    expect(validateActionUrl("  https://ticketon.kz/x  ")).toBeNull();
  });

  it("отвергает схемы вне аллоулиста — это исполнение кода на телефоне гостя", () => {
    expect(validateActionUrl("javascript:alert(1)")).toBe("scheme");
    expect(validateActionUrl("data:text/html,<script>")).toBe("scheme");
    expect(validateActionUrl("intent://x")).toBe("scheme");
  });

  it("отвергает бессхемный адрес — гадать про http значит молча понизить ссылку", () => {
    expect(validateActionUrl("book-eat.com/x")).toBe("scheme");
  });

  it("отвергает адрес без хоста", () => {
    expect(validateActionUrl("https:///x")).toBe("no_host");
  });

  it("отвергает логин и пароль внутри адреса", () => {
    expect(validateActionUrl("https://user:pass@ticketon.kz/x")).toBe("credentials");
    expect(validateActionUrl("https://user@ticketon.kz/x")).toBe("credentials");
  });

  it("отвергает пробелы и управляющие символы — так и протаскивают «java\\nscript:»", () => {
    expect(validateActionUrl("https://ticketon.kz/a b")).toBe("whitespace");
    expect(validateActionUrl("java\nscript:alert(1)")).toBe("whitespace");
  });

  it("отвергает пустое поле и ссылку длиннее 2048", () => {
    expect(validateActionUrl("   ")).toBe("empty");
    const long = `https://ticketon.kz/${"a".repeat(MAX_ACTION_URL_LENGTH)}`;
    expect(validateActionUrl(long)).toBe("too_long");
  });
});

describe("classifyPlatformContentFailure", () => {
  it("различает ровно то, что различает сервер", () => {
    const kindOf = (status?: number) =>
      classifyPlatformContentFailure(new RepositoryError("x", undefined, status)).kind;
    expect(kindOf(401)).toBe("unauthorized");
    expect(kindOf(403)).toBe("forbidden");
    expect(kindOf(404)).toBe("not_found");
    expect(kindOf(422)).toBe("refused");
    expect(kindOf(500)).toBe("unknown");
  });

  it("на 5xx и обрыв связи НЕ утверждает, что ничего не сохранилось", () => {
    expect(classifyPlatformContentFailure(new Error("offline")).applied).toBe("unknown");
    expect(
      classifyPlatformContentFailure(new RepositoryError("boom", undefined, 500)).applied,
    ).toBe("unknown");
    // А вот 422 сервер отдаёт до коммита — тут «не применилось» это факт.
    expect(
      classifyPlatformContentFailure(new RepositoryError("nope", undefined, 422)).applied,
    ).toBe(false);
  });
});
