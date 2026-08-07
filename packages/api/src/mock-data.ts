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
  Cuisine,
  DayOfWeek,
  EventSummary,
  MenuHighlight,
  Photo,
  PromoBanner,
  Restaurant,
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

function menuHighlights(restaurantId: string): MenuHighlight[] {
  return [
    {
      id: `${restaurantId}-menu-1`,
      name: "Стейк с овощами",
      description: "Говядина, овощи гриль и авторский соус",
      price: "8 990 ₸",
      photo: photo("foodGrillSkewers", `${restaurantId}-menu-1`, "Стейк с овощами"),
    },
    {
      id: `${restaurantId}-menu-2`,
      name: "Павлова с ягодами",
      description: "Меренга, крем и сезонные ягоды",
      price: "3 290 ₸",
      photo: photo("foodDessertBerry", `${restaurantId}-menu-2`, "Павлова с ягодами"),
    },
  ];
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
 * Note there are no tags/categories here either — the backend has none, so
 * inventing them in the mock would let a card be built against a field that
 * cannot exist in production.
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
      ticketed: true,
      ticketPriceMinor: 1_800_000,
      capacity: 24,
      ticketsRefundable: true,
      ticketRefundCutoffMinutes: 1440,
      restaurant: host(0),
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
      ticketed: true,
      ticketPriceMinor: 950_000,
      capacity: null,
      ticketsRefundable: false,
      ticketRefundCutoffMinutes: 0,
      restaurant: host(1),
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
      ticketed: false,
      ticketPriceMinor: null,
      capacity: null,
      ticketsRefundable: false,
      ticketRefundCutoffMinutes: 0,
      restaurant: host(2),
    },
  ];
}
