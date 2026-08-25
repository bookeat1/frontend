import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpRestaurantRepository } from "../http-repository";
import { mapRestaurantSummary, type ApiRestaurant } from "../http-mapping";
import { EMPTY_FILTERS } from "../types";

/**
 * Переезд приложения на СПРАВОЧНИК кухонь (`GET /cuisines`, выложен на бой
 * 2026-08-25).
 *
 * Что было до него: список кухонь собирался дедупом одной страницы каталога.
 * Он зависел от того, какие заведения попали в первую сотню, тянул в ряд
 * «Выберите кухню» типы заведения («Винный бар») и требовал заплатки-списка,
 * чтобы их оттуда убрать. Значением фильтра был casefold русского текста, и
 * сервер сравнивал его С УЧЁТОМ регистра — поэтому один чип отправлял все
 * найденные написания сразу.
 *
 * Что проверяется здесь — ровно то, что при таком переезде ломается тихо:
 * состав и ПОРЯДОК списка, форма значения фильтра, и то, что заведение без
 * кухонь остаётся живым.
 *
 * Формы ответов сверены с боем (curl, 2026-08-25).
 */

const BASE_URL = "https://api.example.test/api/v1";

function repository() {
  return new HttpRestaurantRepository({ baseUrl: BASE_URL, getToken: () => "token" });
}

/** Ловит каждый ушедший URL и отвечает заранее заданным телом. */
function stubFetch(body: (url: string) => unknown): { urls: string[] } {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      return new Response(JSON.stringify({ data: body(url) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return { urls };
}

/** Ответ `GET /cuisines` в боевой форме: нарочно НЕ по порядку и с одной
 * скрытой записью. */
const DICTIONARY = [
  {
    id: "1770b802-586d-51cf-8349-272758c6ae9f",
    code: "kazakh",
    name: "Казахская",
    name_i18n: { ru: "Казахская", en: "Kazakh" },
    display_order: 40,
    is_active: true,
  },
  {
    id: "a02af5dd-9899-563c-997c-f07b8fde8aee",
    code: "european",
    name: "Европейская",
    image_url: "https://cdn.example.test/cuisines/european.png",
    display_order: 10,
    is_active: true,
  },
  {
    id: "9de2530f-a6c3-587e-baeb-718c739319ec",
    code: "japanese",
    name: "Японская",
    display_order: 140,
    is_active: false,
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("список кухонь берётся из справочника", () => {
  it("читает /cuisines и не трогает каталог заведений", async () => {
    const captured = stubFetch(() => DICTIONARY);

    await repository().getCuisines();

    expect(captured.urls).toHaveLength(1);
    expect(captured.urls[0]).toContain("/cuisines");
    // Ровно то, ради чего переезд: ряд кухонь больше не зависит от того, какие
    // заведения попали в первую страницу каталога.
    expect(captured.urls[0]).not.toContain("/restaurants");
  });

  it("держит порядок справочника, а не алфавит", async () => {
    stubFetch(() => DICTIONARY);

    const cuisines = await repository().getCuisines();

    // display_order 10 у «Европейской» и 40 у «Казахской» — по алфавиту было
    // бы наоборот, и порядок ряда на главной задавала бы не платформа.
    expect(cuisines.map((c) => c.id)).toEqual(["european", "kazakh"]);
  });

  it("скрытую кухню не показывает: фильтром по ней сервер всё равно не даст выдачи", async () => {
    stubFetch(() => DICTIONARY);

    const cuisines = await repository().getCuisines();

    expect(cuisines.map((c) => c.id)).not.toContain("japanese");
  });

  it("значение фильтра — код справочника, картинка — ссылка из него", async () => {
    stubFetch(() => DICTIONARY);

    const [european] = await repository().getCuisines();

    expect(european).toEqual({
      id: "european",
      name: "Европейская",
      imageUrl: "https://cdn.example.test/cuisines/european.png",
    });
  });

  it("ссылка на картинку уходит в экран КАК ЕСТЬ, из любого хранилища", async () => {
    // Владелец загрузил картинки через кабинет, и они легли не туда, где
    // лежали исходные файлы: `pub-e2b6…/uploads/<год>/<месяц>/<хеш>.png`
    // вместо `pub-41b6…/cuisines/<code>.png` (проверено на бою 2026-08-25).
    // Клиент не имеет права ничего достраивать в этом адресе — иначе смена
    // бакета в кабинете тихо гасит все кружки на главной.
    const uploaded =
      "https://pub-e2b611d914ba467681c122ebf5883067.r2.dev/uploads/2026/08/1766ba92011ead3ec5e7b8bab2df2e97.png";
    stubFetch(() => [{ ...DICTIONARY[1], image_url: uploaded }]);

    const [cuisine] = await repository().getCuisines();

    expect(cuisine.imageUrl).toBe(uploaded);
  });

  it("кухня без картинки приходит без поля — это НЕ ошибка, а сегодняшний бой", async () => {
    stubFetch(() => DICTIONARY);

    const kazakh = (await repository().getCuisines()).find((c) => c.id === "kazakh");

    // На бою 2026-08-25 `image_url` не прислан НИ У ОДНОЙ из 14 кухонь.
    // Круг в таком случае берёт снимок, вшитый в сборку (cuisine-photos.ts).
    expect(kazakh?.imageUrl).toBeUndefined();
  });
});

describe("фильтр поиска по нескольким кухням", () => {
  it("отправляет коды одним параметром через запятую", async () => {
    const captured = stubFetch(() => ({ items: [], total: 0 }));

    await repository().searchRestaurants({
      text: "",
      filters: { ...EMPTY_FILTERS, cuisineIds: ["european", "kazakh"] },
    });

    const search = captured.urls.find((u) => u.includes("/restaurants/search")) ?? "";
    // Именно так это понимает сервер: список ORится, регистр не важен
    // (проверено на бою — `?cuisine=european,kazakh` даёт 15 при 13 и 2).
    expect(new URL(search).searchParams.get("cuisine")).toBe("european,kazakh");
  });

  it("не ходит за каталогом, чтобы «развернуть написания» — это больше не нужно", async () => {
    const captured = stubFetch(() => ({ items: [], total: 0 }));

    await repository().searchRestaurants({
      text: "",
      filters: { ...EMPTY_FILTERS, cuisineIds: ["european"] },
    });

    expect(captured.urls).toHaveLength(1);
  });

  it("без выбранных кухонь параметра нет вовсе", async () => {
    const captured = stubFetch(() => ({ items: [], total: 0 }));

    await repository().searchRestaurants({ text: "", filters: EMPTY_FILTERS });

    const search = captured.urls.find((u) => u.includes("/restaurants/search")) ?? "";
    expect(new URL(search).searchParams.has("cuisine")).toBe(false);
  });
});

/** Заведение в форме, которую отдаёт бой; лишние поля мапперу не мешают. */
function venue(over: Partial<ApiRestaurant> = {}): ApiRestaurant {
  return {
    id: "r-1",
    category_id: null,
    name: "Aiza Esentai",
    description: "",
    cuisine_type: "",
    address: "",
    opening_hours: "",
    city: "Алматы",
    price_category: "₸₸₸",
    email: "",
    phone: "",
    latitude: null,
    longitude: null,
    ...over,
  } as ApiRestaurant;
}

describe("кухни заведения", () => {
  it("читает ВЕСЬ набор из справочника, а не одну строку", () => {
    const summary = mapRestaurantSummary(
      venue({
        // Сервер собирает старую строку из набора — на неё смотреть нельзя,
        // «Европейская, Грузинская» это две кухни, а не одна с запятой.
        cuisine_type: "Европейская, Грузинская",
        cuisines: [
          { id: "u-1", code: "european", name: "Европейская" },
          { id: "u-2", code: "georgian", name: "Грузинская" },
        ],
      }),
    );

    expect(summary.cuisines).toEqual([
      { id: "european", name: "Европейская" },
      { id: "georgian", name: "Грузинская" },
    ]);
  });

  it("порядок набора сохраняется: нулевая позиция — главная кухня заведения", () => {
    const summary = mapRestaurantSummary(
      venue({
        cuisines: [
          { id: "u-2", code: "georgian", name: "Грузинская" },
          { id: "u-1", code: "european", name: "Европейская" },
        ],
      }),
    );

    expect(summary.cuisines[0].id).toBe("georgian");
  });

  it("заведению без набора остаётся старая строка — оно не теряет кухню", () => {
    // Так выглядит сборка, которая читает заведение, кому набор ещё не
    // проставили. Сервер понимает и такое значение фильтра.
    const summary = mapRestaurantSummary(venue({ cuisine_type: "Винный бар" }));

    expect(summary.cuisines).toEqual([{ id: "винный бар", name: "Винный бар" }]);
  });

  it("заведение без кухонь ВООБЩЕ — законное состояние, а не поломка", () => {
    // На бою 2026-08-25 это «Agora wine and deli»: `cuisines` в ответе нет.
    const summary = mapRestaurantSummary(venue({ cuisine_type: "", cuisines: null }));

    expect(summary.cuisines).toEqual([]);
    expect(summary.name).toBe("Aiza Esentai");
  });
});
