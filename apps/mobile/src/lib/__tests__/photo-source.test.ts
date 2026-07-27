/**
 * BUG THIS FILE HOLDS: a venue photo that no longer exists in the bucket left a
 * hole in the app.
 *
 * R2 answers a deleted or mistyped object with a bare `404 text/plain`, which
 * an <Image> cannot read — it can only report "did not load", and nothing in
 * the app listened for that. What the guest got was a coloured rectangle that
 * never became a photo: a card that looks broken, in a list of cards that do
 * not. The venue with no photo at all was worse — the mapper substituted a URL
 * on the third-party host placehold.co, so "no photo" depended on a domain we
 * do not own answering over the guest's connection.
 *
 * Both now resolve to the same locally drawn tile. These are the rules that
 * decide it.
 */
import { describe, expect, it } from "vitest";
import { PHOTO_CACHE_POLICY, resolvePhotoDisplay } from "../photo-source";

const URI = "https://pub-41b6f06fc8e74b6e959cdd6def081e22.r2.dev/restaurants/a/1.webp";
const OTHER = "https://pub-41b6f06fc8e74b6e959cdd6def081e22.r2.dev/restaurants/b/2.webp";

describe("что показывает слот фотографии", () => {
  it("у заведения есть фото и оно ещё не падало — показываем фото", () => {
    expect(resolvePhotoDisplay(URI, null)).toEqual({ kind: "image", uri: URI });
  });

  it("фото не загрузилось — гость видит нейтральную плашку, а не пустоту", () => {
    expect(resolvePhotoDisplay(URI, URI)).toEqual({ kind: "placeholder", reason: "failed" });
  });

  it("упавшее фото больше не запрашивается: тот же адрес остаётся плашкой", () => {
    // Иначе получается цикл: onError → перерисовка → снова запрос → onError,
    // и трафик гостя уходит в бесконечный повтор 404.
    const first = resolvePhotoDisplay(URI, URI);
    const second = resolvePhotoDisplay(URI, URI);
    expect(first).toEqual(second);
    expect(second.kind).toBe("placeholder");
  });

  it("в переиспользованной строке списка новое фото получает свой шанс", () => {
    // FlatList отдаёт ту же строку следующему заведению. Память об упавшем
    // адресе привязана к адресу, а не к строке, поэтому соседнее заведение не
    // наследует чужой отказ.
    expect(resolvePhotoDisplay(OTHER, URI)).toEqual({ kind: "image", uri: OTHER });
  });

  it("фото нет вовсе — та же плашка, но причина другая", () => {
    expect(resolvePhotoDisplay(undefined, null)).toEqual({ kind: "placeholder", reason: "absent" });
    expect(resolvePhotoDisplay(null, null)).toEqual({ kind: "placeholder", reason: "absent" });
  });

  it("пустая строка — это «фото нет», а не адрес", () => {
    // Так выглядит незаполненная колонка после JSON и маппера. Отдать "" в
    // <Image> — гарантированный молчаливый отказ.
    expect(resolvePhotoDisplay("", null)).toEqual({ kind: "placeholder", reason: "absent" });
    expect(resolvePhotoDisplay("   ", null)).toEqual({ kind: "placeholder", reason: "absent" });
  });

  it("случайные пробелы вокруг адреса не делают из него другой адрес", () => {
    // Важно ровно потому, что «упавший адрес» сравнивается строкой.
    expect(resolvePhotoDisplay(` ${URI} `, URI)).toEqual({ kind: "placeholder", reason: "failed" });
  });

  it("кэш — память И диск, иначе список перечитывает фото при каждой прокрутке", () => {
    // По умолчанию expo-image кэширует только на диск: значение здесь и есть
    // весь смысл этой задачи, поэтому оно закреплено тестом.
    expect(PHOTO_CACHE_POLICY).toBe("memory-disk");
  });
});
