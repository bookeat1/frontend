import { Image } from "react-native";
import interiorArchwayHall from "../assets/photos/interior-archway-hall.jpg";
import interiorChandelier from "../assets/photos/interior-chandelier.jpg";
import interiorCheers from "../assets/photos/interior-cheers.jpg";
import interiorOpenKitchen from "../assets/photos/interior-open-kitchen.jpg";
import interiorWineTable from "../assets/photos/interior-wine-table.jpg";
import foodGrillSkewers from "../assets/photos/food-grill-skewers.jpg";
import foodPlateTasting from "../assets/photos/food-plate-tasting.jpg";
import foodDessertBerry from "../assets/photos/food-dessert-berry.jpg";
import type {
  Amenity,
  Cuisine,
  DayOfWeek,
  EventSummary,
  GuideCategory,
  GuideCollection,
  GuideRoute,
  GuideRouteDetail,
  GuideCollectionDetail,
  HomePromo,
  MenuHighlight,
  Photo,
  PromoBanner,
  Restaurant,
  RestaurantStory,
  RestaurantSummary,
  ScheduleDay,
  VenueSchedule,
} from "./types";

/**
 * Real photography exported from the Figma file (fileKey
 * 7rBjjTjp4FbxV9SCJmypWF) via the MCP `download_assets` tool, re-compressed
 * and bundled here as fixture assets for the mock repository.
 */
const assetModules = {
  interiorArchwayHall,
  interiorChandelier,
  interiorCheers,
  interiorOpenKitchen,
  interiorWineTable,
  foodGrillSkewers,
  foodPlateTasting,
  foodDessertBerry,
} as const;

function photo(
  key: keyof typeof assetModules,
  id: string,
  alt: string,
  category?: Photo["category"],
): Photo {
  const resolved = Image.resolveAssetSource(assetModules[key]);
  return {
    id,
    uri: resolved.uri,
    width: resolved.width,
    height: resolved.height,
    alt,
    category,
  };
}

const FOOD_KEYS = new Set<keyof typeof assetModules>([
  "foodGrillSkewers",
  "foodPlateTasting",
  "foodDessertBerry",
]);

function categoryFor(key: keyof typeof assetModules): Photo["category"] {
  return FOOD_KEYS.has(key) ? "food" : "interior";
}

export const cuisines: Cuisine[] = [
  { id: "georgian", name: "Грузинская" },
  { id: "italian", name: "Итальянская" },
  { id: "japanese", name: "Японская" },
  { id: "kazakh", name: "Казахская" },
  { id: "european", name: "Европейская" },
  { id: "asian", name: "Паназиатская" },
];

/**
 * Справочник удобств для мока — те же коды, что у боевого `GET /venue-features`
 * (порядок справочника сохранён).
 */
export const amenities: Amenity[] = [
  { id: "terrace", name: "Терраса" },
  { id: "wifi", name: "Wi-Fi" },
  { id: "parking", name: "Парковка" },
  { id: "live_music", name: "Живая музыка" },
  { id: "hookah", name: "Кальян" },
];

/**
 * Какие удобства проставлены заведениям мока: id заведения → коды.
 *
 * Отдельной картой, а не полем `Restaurant`: приложение удобства заведения
 * нигде не показывает — они нужны ровно для того, чтобы мок фильтровал по ним
 * ЧЕСТНО (и по И, как сервер), а не делал вид. Заведение, которого здесь нет,
 * под фильтр по удобству не попадает — как и на бою, где у половины
 * справочника ноль заведений.
 */
export const restaurantAmenities: Record<string, string[]> = {
  r1: ["terrace", "wifi", "live_music"],
  r2: ["wifi", "hookah"],
  r3: ["terrace"],
};

const ALL_DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

const openDay = (
  dayOfWeek: DayOfWeek,
  opensAt: string,
  closesAt: string,
  closesNextDay = false,
): ScheduleDay => ({ dayOfWeek, isOpen: true, opensAt, closesAt, closesNextDay });

const dayOff = (dayOfWeek: DayOfWeek): ScheduleDay => ({
  dayOfWeek,
  isOpen: false,
  opensAt: null,
  closesAt: null,
  closesNextDay: false,
});

const fullWeek = (opensAt: string, closesAt: string, closesNextDay = false): ScheduleDay[] =>
  ALL_DAYS.map((day) => openDay(day, opensAt, closesAt, closesNextDay));

/** `openNow` в фикстурах — такое же «мнение сервера», как в проде: экраны
 * его только читают. */
const schedule = (openNow: boolean, days: ScheduleDay[]): VenueSchedule => ({
  timezone: "Asia/Almaty",
  openNow,
  days,
});

function banners(restaurantId: string): PromoBanner[] {
  return [
    {
      id: `${restaurantId}-banner-1`,
      title: "Сладкий четверг",
      photo: photo("foodDessertBerry", `${restaurantId}-banner-1`, "Десерт дня"),
    },
    {
      id: `${restaurantId}-banner-2`,
      title: "2 стейка за 8990 ₸",
      photo: photo("foodGrillSkewers", `${restaurantId}-banner-2`, "Стейки на гриле"),
    },
    {
      id: `${restaurantId}-banner-3`,
      title: "Поднимем бокалы",
      photo: photo("interiorCheers", `${restaurantId}-banner-3`, "Гости поднимают бокалы"),
    },
    {
      id: `${restaurantId}-banner-4`,
      title: "Бизнес ланч 4000 ₸",
      photo: photo("foodPlateTasting", `${restaurantId}-banner-4`, "Бизнес-ланч"),
    },
  ];
}

/**
 * Лента «Лучшие позиции». Первое блюдо ОТМЕЧЕНО заведением (`isTopPick`),
 * второе попало добивкой — так офлайн-режим повторяет обе половины серверного
 * правила. У обоих есть цена числом, поэтому в мок-режиме кнопка «Добавить ·
 * итого» на карточке из ленты работает так же, как на живом бэкенде.
 */
function menuHighlights(restaurantId: string): MenuHighlight[] {
  return [
    {
      id: `${restaurantId}-menu-1`,
      name: "Стейк с овощами",
      description: "Говядина, овощи гриль и авторский соус",
      price: "8 990 ₸",
      priceMinor: 899_000,
      isTopPick: true,
      photo: photo("foodGrillSkewers", `${restaurantId}-menu-1`, "Стейк с овощами"),
    },
    {
      id: `${restaurantId}-menu-2`,
      name: "Павлова с ягодами",
      description: "Меренга, крем и сезонные ягоды",
      price: "3 290 ₸",
      priceMinor: 329_000,
      isTopPick: false,
      photo: photo("foodDessertBerry", `${restaurantId}-menu-2`, "Павлова с ягодами"),
    },
  ];
}

/**
 * The mock's promo stories for one venue — a small, ordered set that mirrors
 * the live shape: a couple of captioned cards and one WITHOUT a caption, so the
 * rail's "image-only card" path is exercised offline too. The FIRST card
 * carries an `actionUrl`, so the swipe-up hint and its gesture are visible
 * offline as well; the others have none, which is the common case. The last
 * card is a remote URL rather than a bundled asset so the fullscreen viewer's
 * network image load is exercised as well.
 */
export function restaurantStories(restaurantId: string): RestaurantStory[] {
  return [
    {
      id: `${restaurantId}-story-1`,
      imageUrl: photo("foodDessertBerry", `${restaurantId}-story-1`, "Десерт дня").uri,
      caption: "Сладкий четверг — десерт в подарок",
      sortOrder: 0,
      // История со ссылкой — офлайн-режим тоже показывает подсказку «Смотреть»
      // и свайп вверх.
      actionUrl: "https://book-eat.com/",
    },
    {
      id: `${restaurantId}-story-2`,
      imageUrl: photo("interiorCheers", `${restaurantId}-story-2`, "Вечер в ресторане").uri,
      caption: "Живая музыка каждую пятницу",
      sortOrder: 1,
      actionUrl: null,
    },
    {
      id: `${restaurantId}-story-3`,
      imageUrl: photo("foodGrillSkewers", `${restaurantId}-story-3`, "Стейки на гриле").uri,
      // История без подписи — карточка показывает только фото.
      caption: null,
      sortOrder: 2,
      actionUrl: null,
    },
  ];
}

/**
 * Cross-venue promotions for the offline mock (`GET /feed?city=…`, promo items
 * — see RestaurantRepository.getPromotions).
 *
 * Built as a FUNCTION of the current time so the campaign windows stay in the
 * future, the same reason `upcomingEvents` is a function. `city` is filtered on
 * the HOST venue's city, mirroring the live feed's required `city` param. One
 * promo deliberately has NO `discountPercent` (null) so the "no badge" path is
 * exercisable with no backend.
 */
export function homePromotions(city?: string, now: Date = new Date()): HomePromo[] {
  const at = (days: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };
  const promos: (HomePromo & { city: string })[] = [
    {
      id: "promo-1",
      restaurantId: restaurants[0].id,
      restaurantName: restaurants[0].name,
      title: "−30% на завтраки",
      description: "Скидка на всё меню завтраков до полудня.",
      startsAt: at(0),
      endsAt: at(14),
      coverImageUrl: photo("foodDessertBerry", "promo-1-cover", "Завтраки").uri,
      // Галерея БЕЗ обложки — карточка рисует ленту «обложка + эти».
      images: [
        photo("interiorOpenKitchen", "promo-1-g1", "Завтраки").uri,
        photo("foodGrillSkewers", "promo-1-g2", "Завтраки").uri,
      ],
      discountPercent: 30,
      city: restaurants[0].city,
    },
    {
      id: "promo-2",
      restaurantId: restaurants[1].id,
      restaurantName: restaurants[1].name,
      // Промо без процента — карточка показывает фото без красного бейджа.
      title: "Дегустационный сет вечера",
      description: "Специальное предложение по будням.",
      startsAt: at(0),
      endsAt: at(7),
      coverImageUrl: photo("interiorWineTable", "promo-2-cover", "Дегустация").uri,
      // Акция без галереи — экран показывает одну обложку, без точек.
      images: [],
      discountPercent: null,
      city: restaurants[1].city,
    },
  ];
  return promos
    .filter((p) => (city ? p.city === city : true))
    .map(({ city: _city, ...promo }) => promo);
}

/**
 * GASTROGUIDE collections for the offline mock — the guest-facing «Статьи».
 * Deliberately mirrors the live shape's edges so the UI states can be exercised
 * with no backend: one collection WITHOUT a subtitle and WITHOUT a cover (null),
 * and a venue block WITHOUT a note (the block hides its description line). There
 * is no author anywhere — the byline is a UI constant.
 *
 * ОБЕ СУЩНОСТИ ЛЕЖАТ В ОДНОМ СПИСКЕ, как и на бэкенде (одна таблица, колонка
 * `kind`): подборки гастрогида (`kind: "collection"`, с рубриками) и статьи
 * (`kind: "article"`, БЕЗ рубрик). Разводят их не данные, а две ручки — см.
 * `guideCollections()` и `articles()`. Мок держит и то и другое, иначе офлайн
 * невозможно увидеть, что разделение вообще работает.
 */
function guideCollectionsData(): GuideCollectionDetail[] {
  return [
  {
    slug: "romantic-dinners",
    kind: "collection",
    title: "Где провести романтический ужин",
    subtitle: "Пять мест для особенного вечера",
    description:
      "Панорамные крыши, приглушённый свет и авторские сеты — подборка ресторанов, куда стоит прийти вдвоём.",
    coverImageUrl: photo("interiorWineTable", "guide-1-cover", "Романтический ужин").uri,
    venueCount: 2,
    categorySlugs: ["evropeyskaya", "avtorskaya"],
    venues: [
      {
        restaurantId: restaurants[3].id,
        name: restaurants[3].name,
        note: "Панорама города с 18 этажа и fusion-меню от шефа — лучший стол у окна на закате.",
        address: restaurants[3].address,
        cuisineType: restaurants[3].cuisines[0]?.name ?? "",
        city: restaurants[3].city,
        priceCategory: restaurants[3].priceLevel,
        imageUrl: restaurants[3].coverPhoto?.uri ?? null,
        instagram: restaurants[3].social?.instagram ?? "",
        // Блок с событием — та самая форма из макета: заголовок, описание и
        // лента фотографий над адресом заведения.
        highlight: {
          kind: "event",
          id: "e1",
          title: "Ужин с шефом: сезонное меню",
          description: "Сет из шести подач, шеф выходит к каждому столу.",
          startsAt: "",
          coverImageUrl: photo("foodPlateTasting", "guide-h1-cover", "Ужин с шефом").uri,
          images: [
            photo("interiorOpenKitchen", "guide-h1-g1", "Ужин с шефом").uri,
            photo("interiorChandelier", "guide-h1-g2", "Ужин с шефом").uri,
          ],
        },
      },
      {
        restaurantId: restaurants[0].id,
        name: restaurants[0].name,
        // Заведение без редакционной заметки — блок скрывает строку описания.
        note: "",
        address: restaurants[0].address,
        cuisineType: restaurants[0].cuisines[0]?.name ?? "",
        city: restaurants[0].city,
        priceCategory: restaurants[0].priceLevel,
        imageUrl: restaurants[0].coverPhoto?.uri ?? null,
        // Без инстаграма и без события — блок остаётся простой карточкой
        // заведения, и строка внизу показывает один адрес.
        instagram: "",
        highlight: null,
      },
    ],
  },
  {
    slug: "family-brunch",
    kind: "collection",
    // Подборка без подзаголовка и без обложки — карточка показывает плейсхолдер.
    title: "Семейный бранч по выходным",
    subtitle: "",
    description:
      "Просторные залы, детское меню и неспешные завтраки до полудня — куда пойти всей семьёй в субботу.",
    coverImageUrl: null,
    venueCount: 1,
    categorySlugs: ["italyanskaya"],
    venues: [
      {
        restaurantId: restaurants[1].id,
        name: restaurants[1].name,
        note: "Дровяная печь, терраса с видом на горы и большие столы для компании.",
        address: restaurants[1].address,
        cuisineType: restaurants[1].cuisines[0]?.name ?? "",
        city: restaurants[1].city,
        priceCategory: restaurants[1].priceLevel,
        imageUrl: restaurants[1].coverPhoto?.uri ?? null,
        instagram: restaurants[1].social?.instagram ?? "",
        highlight: {
          kind: "promo",
          id: "promo-1",
          title: "−30% на завтраки",
          description: "Скидка на всё меню завтраков до полудня.",
          startsAt: "",
          coverImageUrl: photo("foodDessertBerry", "guide-h2-cover", "Завтраки").uri,
          images: [photo("foodGrillSkewers", "guide-h2-g1", "Завтраки").uri],
        },
      },
    ],
  },
  {
    // СТАТЬЯ: рубрик нет вовсе (сервер отвергает статью с рубриками 422), и
    // открывается она по `/articles/:slug`, а не с экрана гастрогида.
    slug: "almaty-longread",
    kind: "article",
    title: "Сейчас Алматы ест невероятно хорошо",
    subtitle: "Редакционный лонгрид",
    description:
      "Город за пять лет прошёл путь от одинаковых интерьеров до собственной кухни — рассказываем, где это видно за столом.",
    coverImageUrl: photo("interiorChandelier", "article-1-cover", "Алматы ест хорошо").uri,
    venueCount: 1,
    categorySlugs: [],
    venues: [
      {
        restaurantId: restaurants[2].id,
        name: restaurants[2].name,
        note: "Здесь начали жарить на углях местную рыбу — и с этого всё пошло.",
        address: restaurants[2].address,
        cuisineType: restaurants[2].cuisines[0]?.name ?? "",
        city: restaurants[2].city,
        priceCategory: restaurants[2].priceLevel,
        imageUrl: restaurants[2].coverPhoto?.uri ?? null,
        instagram: restaurants[2].social?.instagram ?? "",
        highlight: null,
      },
    ],
  },
  {
    // Статья БЕЗ обложки и БЕЗ заведений — экран показывает текст и замыкающий
    // блок, а карточка в списке рисует плашку «фото нет».
    slug: "coffee-manifest",
    kind: "article",
    title: "Манифест третьей волны",
    subtitle: "",
    description:
      "Почему кофейни перестали спорить о зерне и начали спорить о воде.",
    coverImageUrl: null,
    venueCount: 0,
    categorySlugs: [],
    venues: [],
  },
  ];
}

/**
 * Рубрики гастрогида для офлайн-мока. Слаги совпадают с `categorySlugs`
 * подборок выше — иначе сетка рубрик в моке вела бы в пустоту, а на живом
 * бэкенде связь именно такая. Третья рубрика намеренно НЕ помечает ни одну
 * подборку: так видно поведение плитки, за которой ничего не стоит.
 *
 * На проде эта ручка отдаёт пустой список (рубрик не завели) — мок держит
 * данные, чтобы сетку вообще можно было увидеть без бэкенда.
 */
export function guideCategories(): GuideCategory[] {
  return [
    { slug: "evropeyskaya", title: "Европейская", position: 1 },
    { slug: "italyanskaya", title: "Итальянская", position: 2 },
    { slug: "avtorskaya", title: "Авторская", position: 3 },
    { slug: "zavtraki", title: "Завтраки", position: 4 },
  ];
}

/** Подборки гастрогида (только карточки, без заведений), как
 * `GET /gastroguide/collections` — ТОЛЬКО `kind: "collection"`. */
export function guideCollections(): GuideCollection[] {
  return guideCollectionsData()
    .filter((c) => c.kind === "collection")
    .map(({ venues: _venues, ...card }) => card);
}

/** Статьи, как `GET /articles` — ТОЛЬКО `kind: "article"`. Отдельная функция,
 * а не параметр: экран статей и экран гастрогида не должны уметь показать
 * содержимое друг друга даже случайно. */
export function articles(): GuideCollection[] {
  return guideCollectionsData()
    .filter((c) => c.kind === "article")
    .map(({ venues: _venues, ...card }) => card);
}

/** Одна запись со своими заведениями, как `GET /gastroguide/collections/:slug`
 * и `GET /articles/:slug`.
 *
 * ВИД ЗДЕСЬ НЕ ПРОВЕРЯЕТСЯ НАРОЧНО — обе живые ручки резолвят любой слаг
 * (слаг уникален глобально), чтобы старые ссылки не отвечали 404. `undefined`
 * на неизвестный слаг, чтобы мок-репозиторий отдал тот же 404, что и сервер. */
export function guideCollection(slug: string): GuideCollectionDetail | undefined {
  return guideCollectionsData().find((c) => c.slug === slug);
}

/**
 * Гастропрогулки для офлайн-режима и тестов. Взяты с боевых данных
 * («Классический тур по Алматы»), чтобы мок и живая ручка вели себя одинаково:
 * есть точка-заведение с карточкой, точка-заведение БЕЗ карточки (заведение
 * погашено) и обычное место. Именно на этих трёх случаях и ветвится экран.
 */
function guideRoutesData(): GuideRouteDetail[] {
  return [
    {
      slug: "classic-almaty-tour",
      title: "Классический тур по Алматы",
      description: "Однодневный маршрут по знаковым гастрономическим точкам города.",
      coverImageUrl: null,
      durationLabel: "1 день · 3 точки",
      pointCount: 3,
      points: [
        {
          id: "p1",
          position: 1,
          kind: "restaurant",
          title: "Утро: Daily Coffee",
          description: "Старт дня с чашки спешелти в самом сердце города.",
          photoUrl: null,
          address: "Абылайхана 147",
          venue: {
            id: "r1",
            name: "Daily Coffee",
            address: "Абылайхана 147",
            cuisineType: "Кофейня",
            city: "Алматы",
            priceCategory: "₸₸",
            imageUrl: null,
          },
        },
        {
          id: "p2",
          position: 2,
          kind: "place",
          title: "Прогулка: Парк 28 панфиловцев",
          description: "Зелёное сердце города и Вознесенский собор.",
          photoUrl: null,
          address: "ул. Гоголя",
          venue: null,
        },
        {
          id: "p3",
          position: 3,
          kind: "restaurant",
          title: "Ужин: закрытое заведение",
          description: "Заведение погасили в каталоге, остановка осталась.",
          photoUrl: null,
          address: "ул. Омаровой, 35а",
          venue: null,
        },
      ],
    },
  ];
}

/** Карточки маршрутов, как их отдаёт `GET /gastroguide/routes`. */
export function guideRoutes(): GuideRoute[] {
  return guideRoutesData().map(({ points: _points, ...card }) => card);
}

/** Один маршрут с остановками; `undefined` для неизвестного слага, чтобы мок
 * отвечал 404 так же, как живая ручка. */
export function guideRoute(slug: string): GuideRouteDetail | undefined {
  return guideRoutesData().find((r) => r.slug === slug);
}

export const restaurants: Restaurant[] = [
  {
    id: "r1",
    name: "Дастархан у Розы Ахметовны",
    cuisines: [cuisines[3], cuisines[4]],
    priceLevel: "₸₸",
    // Числовой диапазон есть — карточка и деталка покажут «4 000–9 000 ₸».
    priceRange: { min: 4000, max: 9000 },
    rating: 4.7,
    reviewsCount: 328,
    address: "ул. Достык, 89",
    addressNote: "Напротив Меги",
    city: "Алматы",
    phone: "+7 (707) 547-47-47",
    social: {
      website: "https://dastarkhan.example.kz",
      whatsapp: "https://wa.me/77075474747",
      instagram: "https://instagram.com/dastarkhan.example",
    },
    coverPhoto: photo("interiorWineTable", "r1-cover", "Зал ресторана Дастархан"),
    photos: [
      photo("interiorArchwayHall", "r1-1", "Интерьер зала", categoryFor("interiorArchwayHall")),
      photo("interiorChandelier", "r1-2", "Люстра в зале", categoryFor("interiorChandelier")),
      photo("foodGrillSkewers", "r1-3", "Блюдо: бешбармак на углях", categoryFor("foodGrillSkewers")),
      photo("foodPlateTasting", "r1-4", "Блюдо: дегустационная тарелка", categoryFor("foodPlateTasting")),
      photo("interiorCheers", "r1-5", "Гости поднимают бокалы", categoryFor("interiorCheers")),
    ],
    promoBanners: banners("r1"),
    menuHighlights: menuHighlights("r1"),
    openingHoursText: "Ежедневно 10:00–23:00",
    schedule: schedule(true, fullWeek("10:00", "23:00")),
    tables: [
      { id: "t1", seats: 2, location: "hall", isAvailableNow: true },
      { id: "t2", seats: 4, location: "terrace", isAvailableNow: true },
      { id: "t3", seats: 6, location: "vip", isAvailableNow: false },
    ],
    description:
      "Современный ресторан с авторской кухней, уютной атмосферой и внимательным сервисом. Идеальное место для встреч, семейных ужинов и особых событий.",
    acceptsOnlineBookings: true,
    // Единственное заведение макета, у которого «подключён» приём оплаты: в
    // офлайн-режиме должны быть видны ОБА исхода — и бронь с кнопкой Kaspi, и
    // бронь без неё.
    acceptsOnlinePayment: true,
  },
  {
    id: "r2",
    name: "Trattoria Buonissimo на Розыбакиева",
    cuisines: [cuisines[1]],
    priceLevel: "₸₸₸",
    rating: 4.4,
    reviewsCount: 156,
    address: "ул. Розыбакиева, 247",
    city: "Алматы",
    phone: "+7 (707) 111-22-33",
    social: {
      instagram: "https://instagram.com/buonissimo.example",
    },
    coverPhoto: photo("interiorOpenKitchen", "r2-cover", "Открытая кухня траттории"),
    photos: [
      photo("foodGrillSkewers", "r2-1", "Стейк на гриле", categoryFor("foodGrillSkewers")),
      photo("interiorArchwayHall", "r2-2", "Зал с видом на арку", categoryFor("interiorArchwayHall")),
      photo("foodPlateTasting", "r2-3", "Паста ручной работы", categoryFor("foodPlateTasting")),
    ],
    promoBanners: banners("r2"),
    menuHighlights: menuHighlights("r2"),
    openingHoursText: "Ежедневно 11:00–00:00",
    // Закрытие ровно в полночь — тот самый случай, который нельзя рисовать как
    // «работает час»: 11:00 → 00:00 следующего дня.
    schedule: schedule(true, fullWeek("11:00", "00:00", true)),
    tables: [
      { id: "t1", seats: 2, location: "hall", isAvailableNow: true },
      { id: "t2", seats: 4, location: "hall", isAvailableNow: true },
    ],
    description: "Итальянская кухня, дровяная печь и терраса с видом на горы.",
    acceptsOnlineBookings: true,
    acceptsOnlinePayment: false,
  },
  {
    id: "r3",
    name: "Sakura Sushi & Ramen Bar",
    cuisines: [cuisines[2], cuisines[5]],
    priceLevel: "₸₸",
    rating: 4.2,
    reviewsCount: 89,
    address: "пр. Абая, 52/2",
    city: "Алматы",
    phone: "+7 (707) 222-33-44",
    social: {
      whatsapp: "https://wa.me/77072223344",
    },
    coverPhoto: photo("interiorChandelier", "r3-cover", "Барная стойка суши"),
    photos: [
      photo("foodPlateTasting", "r3-1", "Сеты роллов", categoryFor("foodPlateTasting")),
      photo("interiorOpenKitchen", "r3-2", "Открытая кухня", categoryFor("interiorOpenKitchen")),
    ],
    promoBanners: banners("r3"),
    menuHighlights: menuHighlights("r3"),
    openingHoursText: "Ежедневно 11:00–22:00",
    // Часов в системе нет вообще — как у «THE ME’ET» в живом каталоге. Это
    // «неизвестно», и экраны обязаны рисовать его именно так, а не «закрыто».
    schedule: null,
    tables: [{ id: "t1", seats: 2, location: "bar", isAvailableNow: false }],
    description: "Аутентичный рамен и суши-бар в самом центре города.",
    // Онлайн-брони нет — фикстура для состояния «столик только по телефону».
    acceptsOnlineBookings: false,
    acceptsOnlinePayment: false,
  },
  {
    id: "r4",
    name: "Fusion Rooftop на очень-очень длинной улице имени Абылай хана",
    cuisines: [cuisines[4], cuisines[5]],
    priceLevel: "₸₸₸₸",
    // Пятизначные границы — проверка группировки разрядов «25 000–60 000 ₸».
    priceRange: { min: 25000, max: 60000 },
    rating: 4.9,
    reviewsCount: 412,
    address: "ул. Абылай хана, 123, 18 этаж",
    city: "Алматы",
    phone: "+7 (707) 333-44-55",
    social: {
      website: "https://fusionrooftop.example.kz",
      instagram: "https://instagram.com/fusionrooftop.example",
      whatsapp: "https://wa.me/77073334455",
    },
    coverPhoto: photo("interiorArchwayHall", "r4-cover", "Крыша ресторана вечером"),
    photos: [
      photo("interiorChandelier", "r4-1", "Панорама зала", categoryFor("interiorChandelier")),
      photo("foodPlateTasting", "r4-2", "Дегустационное меню", categoryFor("foodPlateTasting")),
      photo("interiorCheers", "r4-3", "Бар на крыше", categoryFor("interiorCheers")),
      photo("foodDessertBerry", "r4-4", "Десерт дня", categoryFor("foodDessertBerry")),
    ],
    promoBanners: banners("r4"),
    menuHighlights: menuHighlights("r4"),
    openingHoursText: "Ежедневно 18:00–02:00",
    // Смешанная неделя: работа за полночь, настоящий выходной (понедельник) и
    // ОТСУТСТВУЮЩИЙ вторник — про вторник сервер ничего не сказал, и это не
    // выходной. Все три состояния должны различаться на экране.
    schedule: schedule(false, [
      openDay(0, "18:00", "02:00", true),
      dayOff(1),
      openDay(3, "18:00", "02:00", true),
      openDay(4, "18:00", "02:00", true),
      openDay(5, "18:00", "03:00", true),
      openDay(6, "18:00", "03:00", true),
    ]),
    tables: [
      { id: "t1", seats: 2, location: "terrace", isAvailableNow: true },
      { id: "t2", seats: 8, location: "vip", isAvailableNow: true },
    ],
    description:
      "Ресторан на крыше с панорамным видом на город и авторской fusion-кухней.",
    acceptsOnlineBookings: true,
    acceptsOnlinePayment: false,
  },
];

export function toSummary(r: Restaurant): RestaurantSummary {
  return {
    id: r.id,
    name: r.name,
    cuisines: r.cuisines,
    priceLevel: r.priceLevel,
    priceRange: r.priceRange,
    rating: r.rating,
    reviewsCount: r.reviewsCount,
    address: r.address,
    city: r.city,
    description: r.description,
    coverPhoto: r.coverPhoto,
    schedule: r.schedule,
    acceptsOnlineBookings: r.acceptsOnlineBookings,
  };
}


/**
 * Upcoming events for the offline mock (`GET /events` — see
 * RestaurantRepository.listUpcomingEvents).
 *
 * Built as a FUNCTION of the current time rather than a frozen array: the real
 * endpoint only ever returns events that have not finished yet, so a fixture
 * with hard-coded 2026 dates would quietly become an empty list and make the
 * mock stop matching the contract it exists to stand in for.
 *
 * Each event carries a couple of `tags` — the backend now returns them (always
 * an array, `[]` when none), so the offline mock shows the chip row too. One
 * event is left with `[]` on purpose, to exercise the hidden-when-empty branch.
 */
export function upcomingEvents(now: Date = new Date()): EventSummary[] {
  const at = (days: number, hour: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const host = (index: number): EventSummary["restaurant"] => {
    const r = restaurants[index];
    return { id: r.id, name: r.name, city: r.city };
  };

  return [
    {
      id: "e1",
      restaurantId: restaurants[0].id,
      title: "Ужин с шефом: сезонное меню",
      description: "Сет из шести подач, шеф выходит к каждому столу.",
      startsAt: at(2, 19),
      endsAt: at(2, 22),
      venue: "Основной зал",
      coverImageUrl: photo("foodPlateTasting", "e1-cover", "Ужин с шефом").uri,
      // Галерея БЕЗ обложки, в порядке редактора.
      images: [
        photo("interiorOpenKitchen", "e1-g1", "Ужин с шефом").uri,
        photo("interiorChandelier", "e1-g2", "Ужин с шефом").uri,
      ],
      ticketed: true,
      ticketPriceMinor: 1_800_000,
      capacity: 24,
      ticketsRefundable: true,
      ticketRefundCutoffMinutes: 1440,
      restaurant: host(0),
      tags: ["Сет-меню", "Ужин"],
      // Разовое событие: серии нет, ключ сердечка — собственный id.
      recurrenceId: null,
    },
    {
      id: "e2",
      restaurantId: restaurants[1].id,
      title: "Винный вечер",
      description: "Шесть образцов из Грузии и Испании, дегустация вслепую.",
      startsAt: at(5, 20),
      endsAt: at(5, 23),
      venue: "",
      coverImageUrl: photo("interiorWineTable", "e2-cover", "Винный вечер").uri,
      images: [photo("interiorCheers", "e2-g1", "Винный вечер").uri],
      ticketed: true,
      ticketPriceMinor: 950_000,
      capacity: null,
      ticketsRefundable: false,
      ticketRefundCutoffMinutes: 0,
      restaurant: host(1),
      tags: ["Дегустация", "Вино"],
      recurrenceId: null,
    },
    {
      id: "e3",
      restaurantId: restaurants[2].id,
      title: "Бранч выходного дня",
      description: "Живая музыка и меню бранча до трёх часов дня.",
      startsAt: at(9, 12),
      endsAt: at(9, 16),
      venue: "Веранда",
      // Deliberately without a cover: the real payload omits
      // `cover_image_url` for venues that uploaded none, and the card has to
      // survive that.
      coverImageUrl: null,
      // Ни обложки, ни галереи — экран показывает плейсхолдер.
      images: [],
      ticketed: false,
      ticketPriceMinor: null,
      capacity: null,
      ticketsRefundable: false,
      ticketRefundCutoffMinutes: 0,
      restaurant: host(2),
      // Left empty on purpose — exercises the hidden-when-empty chip row.
      tags: [],
      // Повторяющийся бранч: специально с серией — сердечко на такой карточке
      // сравнивается по recurrenceId, и офлайн-мок это упражняет.
      recurrenceId: "rec-brunch",
    },
  ];
}
