import type { Cuisine, Photo, Restaurant, RestaurantSummary } from "./types";

/**
 * Placeholder photography. The task asked to pull real assets via Figma's
 * download_assets, but Figma MCP tools were not available in this session
 * (see project report). These are deterministic picsum.photos seeds used
 * only so the mock layer has something to render — replace with the real
 * exported assets before shipping.
 */
function photo(seed: string, w = 800, h = 600, alt = ""): Photo {
  return {
    id: seed,
    uri: `https://picsum.photos/seed/${seed}/${w}/${h}`,
    width: w,
    height: h,
    alt,
  };
}

export const cuisines: Cuisine[] = [
  { id: "georgian", name: "Грузинская" },
  { id: "italian", name: "Итальянская" },
  { id: "japanese", name: "Японская" },
  { id: "kazakh", name: "Казахская" },
  { id: "european", name: "Европейская" },
  { id: "asian", name: "Паназиатская" },
];

const fullWeek = (opensAt: string, closesAt: string) =>
  (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((weekday) => ({
    weekday,
    opensAt,
    closesAt,
  }));

export const restaurants: Restaurant[] = [
  {
    id: "r1",
    name: "Дастархан у Розы Ахметовны",
    cuisines: [cuisines[3], cuisines[4]],
    priceLevel: "$$",
    rating: 4.7,
    reviewsCount: 328,
    address: "ул. Достык, 89",
    city: "Алматы",
    distanceMeters: 650,
    coverPhoto: photo("r1-cover", 800, 600, "Зал ресторана Дастархан"),
    photos: [
      photo("r1-1", 800, 600, "Интерьер зала"),
      photo("r1-2", 800, 600, "Терраса"),
      photo("r1-3", 800, 600, "Блюдо: бешбармак"),
      photo("r1-4", 800, 600, "Блюдо: баурсаки"),
      photo("r1-5", 800, 600, "Барная стойка"),
    ],
    workingHours: fullWeek("10:00", "23:00"),
    tables: [
      { id: "t1", seats: 2, location: "hall", isAvailableNow: true },
      { id: "t2", seats: 4, location: "terrace", isAvailableNow: true },
      { id: "t3", seats: 6, location: "vip", isAvailableNow: false },
    ],
    description:
      "Семейный ресторан казахской кухни с домашней атмосферой и большими порциями для всей семьи.",
    isOpenNow: true,
    isBookable: true,
  },
  {
    id: "r2",
    name: "Trattoria Buonissimo на Розыбакиева",
    cuisines: [cuisines[1]],
    priceLevel: "$$$",
    rating: 4.4,
    reviewsCount: 156,
    address: "ул. Розыбакиева, 247",
    city: "Алматы",
    distanceMeters: 1200,
    coverPhoto: photo("r2-cover", 800, 600, "Зал траттории"),
    photos: [
      photo("r2-1", 800, 600, "Пицца на дровах"),
      photo("r2-2", 800, 600, "Терраса с видом на горы"),
      photo("r2-3", 800, 600, "Паста ручной работы"),
    ],
    workingHours: fullWeek("11:00", "00:00"),
    tables: [
      { id: "t1", seats: 2, location: "hall", isAvailableNow: true },
      { id: "t2", seats: 4, location: "hall", isAvailableNow: true },
    ],
    description: "Итальянская кухня, дровяная печь и терраса с видом на горы.",
    isOpenNow: true,
    isBookable: true,
  },
  {
    id: "r3",
    name: "Sakura Sushi & Ramen Bar",
    cuisines: [cuisines[2], cuisines[5]],
    priceLevel: "$$",
    rating: 4.2,
    reviewsCount: 89,
    address: "пр. Абая, 52/2",
    city: "Алматы",
    distanceMeters: 2400,
    coverPhoto: photo("r3-cover", 800, 600, "Барная стойка суши"),
    photos: [
      photo("r3-1", 800, 600, "Сеты роллов"),
      photo("r3-2", 800, 600, "Рамен"),
    ],
    workingHours: fullWeek("11:00", "22:00"),
    tables: [{ id: "t1", seats: 2, location: "bar", isAvailableNow: false }],
    description: "Аутентичный рамен и суши-бар в самом центре города.",
    isOpenNow: false,
    isBookable: true,
  },
  {
    id: "r4",
    name: "Fusion Rooftop на очень-очень длинной улице имени Абылай хана",
    cuisines: [cuisines[4], cuisines[5]],
    priceLevel: "$$$$",
    rating: 4.9,
    reviewsCount: 412,
    address: "ул. Абылай хана, 123, 18 этаж",
    city: "Алматы",
    distanceMeters: 3100,
    coverPhoto: photo("r4-cover", 800, 600, "Крыша ресторана вечером"),
    photos: [
      photo("r4-1", 800, 600, "Панорама города"),
      photo("r4-2", 800, 600, "Дегустационное меню"),
      photo("r4-3", 800, 600, "Бар на крыше"),
      photo("r4-4", 800, 600, "Закат с террасы"),
    ],
    workingHours: fullWeek("18:00", "02:00"),
    tables: [
      { id: "t1", seats: 2, location: "terrace", isAvailableNow: true },
      { id: "t2", seats: 8, location: "vip", isAvailableNow: true },
    ],
    description:
      "Ресторан на крыше с панорамным видом на город и авторской fusion-кухней.",
    isOpenNow: true,
    isBookable: true,
  },
];

export function toSummary(r: Restaurant): RestaurantSummary {
  return {
    id: r.id,
    name: r.name,
    cuisines: r.cuisines,
    priceLevel: r.priceLevel,
    rating: r.rating,
    reviewsCount: r.reviewsCount,
    address: r.address,
    distanceMeters: r.distanceMeters,
    coverPhoto: r.coverPhoto,
    isOpenNow: r.isOpenNow,
  };
}

export const recentSearches = ["суши", "терраса", "бизнес-ланч"];
export const popularSearches = [
  "паназиатская кухня",
  "детская комната",
  "живая музыка",
  "веранда",
];
