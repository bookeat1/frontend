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
 *
 * SECOND THING THIS FILE HOLDS: a slot now asks for a RESIZED copy of the
 * photo, not the upload original, and falls back to the original when that
 * copy has not been generated yet. That fallback is not a nicety — the address
 * of a derivative is computed, never looked up, so it can legitimately name an
 * object that does not exist. Without the fallback, every photo uploaded after
 * the last backfill run would be a hole.
 */
import { describe, expect, it } from "vitest";
import {
  PHOTO_BUCKET_BASE,
  PHOTO_CACHE_POLICY,
  derivedPhotoUri,
  photoCandidates,
  resolvePhotoDisplay,
} from "../photo-source";

const URI = `${PHOTO_BUCKET_BASE}restaurants/a/1.webp`;
const OTHER = `${PHOTO_BUCKET_BASE}restaurants/b/2.webp`;

/** The resized copy the app asks for first, and the original behind it. */
const TILE = `${PHOTO_BUCKET_BASE}derived/w640/restaurants/a/1.webp.jpg`;
const FULL = `${PHOTO_BUCKET_BASE}derived/w1280/restaurants/a/1.webp.jpg`;

/** Not our bucket: a static map our own API renders. Must be used as given. */
const FOREIGN = "https://api.book-eat.com/v1/static-map?lat=43.2&lon=76.9";

describe("что показывает слот фотографии", () => {
  it("у заведения есть фото и оно ещё не падало — показываем фото", () => {
    // Теперь это уменьшенная копия, а не оригинал: ровно ради этого всё и делалось.
    expect(resolvePhotoDisplay(URI, [])).toEqual({ kind: "image", uri: FULL });
  });

  it("фото не загрузилось — гость видит нейтральную плашку, а не пустоту", () => {
    // «Не загрузилось» — это когда не осталось ни одного адреса: ни копии, ни оригинала.
    expect(resolvePhotoDisplay(URI, [FULL, URI])).toEqual({
      kind: "placeholder",
      reason: "failed",
    });
  });

  it("упавшее фото больше не запрашивается: тот же адрес остаётся плашкой", () => {
    // Иначе получается цикл: onError → перерисовка → снова запрос → onError,
    // и трафик гостя уходит в бесконечный повтор 404.
    const first = resolvePhotoDisplay(URI, [FULL, URI]);
    const second = resolvePhotoDisplay(URI, [FULL, URI]);
    expect(first).toEqual(second);
    expect(second.kind).toBe("placeholder");
  });

  it("в переиспользованной строке списка новое фото получает свой шанс", () => {
    // FlatList отдаёт ту же строку следующему заведению. Память об упавшем
    // адресе привязана к адресу, а не к строке, поэтому соседнее заведение не
    // наследует чужой отказ.
    expect(resolvePhotoDisplay(OTHER, [FULL, URI])).toEqual({
      kind: "image",
      uri: `${PHOTO_BUCKET_BASE}derived/w1280/restaurants/b/2.webp.jpg`,
    });
  });

  it("фото нет вовсе — та же плашка, но причина другая", () => {
    expect(resolvePhotoDisplay(undefined, [])).toEqual({ kind: "placeholder", reason: "absent" });
    expect(resolvePhotoDisplay(null, [])).toEqual({ kind: "placeholder", reason: "absent" });
  });

  it("пустая строка — это «фото нет», а не адрес", () => {
    // Так выглядит незаполненная колонка после JSON и маппера. Отдать "" в
    // <Image> — гарантированный молчаливый отказ.
    expect(resolvePhotoDisplay("", [])).toEqual({ kind: "placeholder", reason: "absent" });
    expect(resolvePhotoDisplay("   ", [])).toEqual({ kind: "placeholder", reason: "absent" });
  });

  it("случайные пробелы вокруг адреса не делают из него другой адрес", () => {
    // Важно ровно потому, что «упавший адрес» сравнивается строкой.
    expect(resolvePhotoDisplay(` ${URI} `, [FULL, URI])).toEqual({
      kind: "placeholder",
      reason: "failed",
    });
  });

  it("кэш — память И диск, иначе список перечитывает фото при каждой прокрутке", () => {
    // По умолчанию expo-image кэширует только на диск: значение здесь и есть
    // весь смысл этой задачи, поэтому оно закреплено тестом.
    expect(PHOTO_CACHE_POLICY).toBe("memory-disk");
  });
});

describe("какой файл запрашиваем вместо оригинала", () => {
  it("маленькая плитка просит копию 640, полноэкранная — 1280", () => {
    // 180pt (карточка блюда) на экране 3x — это 540 реальных пикселей, их
    // закрывает 640. Самый широкий телефон ~430pt, это 1290 — закрывает 1280.
    expect(derivedPhotoUri(URI, "tile")).toBe(TILE);
    expect(derivedPhotoUri(URI, "full")).toBe(FULL);
  });

  it("адрес копии считается из адреса оригинала, без запроса к серверу", () => {
    // Именно поэтому не нужна ни колонка в базе, ни миграция: это чистая функция.
    expect(derivedPhotoUri(URI, "tile")).toBe(derivedPhotoUri(URI, "tile"));
  });

  it("расширение добавляется, а не заменяется", () => {
    // .jpg и .png в одной папке — разные файлы. Если менять расширение, они
    // схлопнутся в один адрес копии, и гость увидит чужое фото.
    const a = derivedPhotoUri(`${PHOTO_BUCKET_BASE}menu/x/dish.jpg`, "tile");
    const b = derivedPhotoUri(`${PHOTO_BUCKET_BASE}menu/x/dish.png`, "tile");
    expect(a).not.toBe(b);
    expect(a).toContain("dish.jpg.jpg");
  });

  it("чужой хост не трогаем", () => {
    // Статическая карта с нашего API или картинка со старого сайта: там нет
    // никаких копий, и попытка их запросить — гарантированный 404 плюс лишний
    // круг запросов.
    expect(derivedPhotoUri(FOREIGN, "tile")).toBeNull();
    expect(derivedPhotoUri("https://placehold.co/600x400", "full")).toBeNull();
  });

  it("копию нельзя уменьшить ещё раз", () => {
    // Иначе адрес, один раз прошедший через эту функцию, уехал бы в derived/derived/.
    expect(derivedPhotoUri(TILE, "tile")).toBeNull();
    expect(derivedPhotoUri(FULL, "tile")).toBeNull();
  });

  it("адрес с query-параметром не превращаем в путь внутри бакета", () => {
    expect(derivedPhotoUri(`${URI}?token=abc`, "tile")).toBeNull();
  });
});

describe("что делать, если уменьшенной копии ещё нет", () => {
  it("после отказа копии показываем оригинал, а не дырку", () => {
    // Копии генерируются пачкой; фото, загруженное после последнего прогона,
    // копии ещё не имеет. Гость этого знать не должен.
    expect(resolvePhotoDisplay(URI, [FULL])).toEqual({ kind: "image", uri: URI });
  });

  it("оригинал всегда последний в очереди адресов", () => {
    expect(photoCandidates(URI, "full")).toEqual([FULL, URI]);
    expect(photoCandidates(URI, "tile")).toEqual([TILE, URI]);
  });

  it("у чужого хоста единственный адрес — он сам", () => {
    expect(photoCandidates(FOREIGN, "tile")).toEqual([FOREIGN]);
    expect(resolvePhotoDisplay(FOREIGN, [], "tile")).toEqual({ kind: "image", uri: FOREIGN });
  });

  it("цепочка заканчивается: после отказа обоих адресов — плашка, а не новый круг", () => {
    // Если бы помнили только последний упавший адрес, копия и оригинал
    // бесконечно уступали бы очередь друг другу.
    expect(resolvePhotoDisplay(URI, [FULL, URI]).kind).toBe("placeholder");
    expect(resolvePhotoDisplay(URI, [URI, FULL]).kind).toBe("placeholder");
  });

  it("отказ оригинала не заставляет заново просить копию", () => {
    expect(resolvePhotoDisplay(URI, [URI])).toEqual({ kind: "image", uri: FULL });
  });
});
