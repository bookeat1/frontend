import { describe, expect, it } from "vitest";
import { mapGuideCollections, mapGuideCollectionDetail } from "../http-mapping";

/**
 * ЧТО ЭТОТ ФАЙЛ ДЕРЖИТ: разделение статей и подборок гастрогида на уровне
 * маппера (2026-08-28).
 *
 * Баг, который видел владелец: раздел «Статьи» на главной вёл на экран
 * гастрогида, потому что это была ОДНА сущность с одной ручкой. Бэкенд развёл
 * их колонкой `kind`, и клиент обязан её читать. Два случая, на которых это
 * ломается тихо:
 *
 *   1. `kind` не пришёл вовсе. Приложение выкатывается РАНЬШЕ сервера, и в
 *      этом окне ответ старой формы обязан читаться как ПОДБОРКА — тем, чем
 *      все восемь опубликованных строк и были. Если бы откат был в «статью»,
 *      весь гастрогид на день переехал бы в чужой раздел.
 *   2. `kind` пришёл незнакомым словом (будущее значение, опечатка на
 *      сервере). Это тоже подборка: статьёй считается РОВНО `"article"`.
 */

describe("kind у подборки гастрогида и статьи", () => {
  it("статьёй считается ровно kind=\"article\"", () => {
    const [article] = mapGuideCollections([{ slug: "almaty-longread", kind: "article" }]);

    expect(article?.kind).toBe("article");
  });

  it("kind=\"collection\" читается как подборка", () => {
    const [collection] = mapGuideCollections([{ slug: "kazakh-cuisine", kind: "collection" }]);

    expect(collection?.kind).toBe("collection");
  });

  it("ответа без kind (сервер ещё не выкачен) достаточно: это подборка", () => {
    const [collection] = mapGuideCollections([{ slug: "kazakh-cuisine" }]);

    expect(collection?.kind).toBe("collection");
  });

  it("пустой и незнакомый kind — тоже подборка, а не статья", () => {
    const mapped = mapGuideCollections([
      { slug: "a", kind: "" },
      { slug: "b", kind: "longread" },
      { slug: "c", kind: "ARTICLE" },
    ]);

    expect(mapped.map((c) => c.kind)).toEqual(["collection", "collection", "collection"]);
  });

  it("деталка несёт тот же kind, что и карточка списка", () => {
    const detail = mapGuideCollectionDetail({
      slug: "almaty-longread",
      kind: "article",
      venues: [{ restaurant_id: "r-1", position: 1, name: "Дареджани" }],
    });

    expect(detail.kind).toBe("article");
    expect(detail.venues.map((v) => v.restaurantId)).toEqual(["r-1"]);
  });
});
