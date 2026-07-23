import { Image } from "react-native";
import interiorArchwayHall from "../assets/photos/interior-archway-hall.jpg";
import interiorChandelier from "../assets/photos/interior-chandelier.jpg";
import interiorCheers from "../assets/photos/interior-cheers.jpg";
import interiorOpenKitchen from "../assets/photos/interior-open-kitchen.jpg";
import interiorWineTable from "../assets/photos/interior-wine-table.jpg";
import foodGrillSkewers from "../assets/photos/food-grill-skewers.jpg";
import foodPlateTasting from "../assets/photos/food-plate-tasting.jpg";
import foodDessertBerry from "../assets/photos/food-dessert-berry.jpg";
import mapPreview from "../assets/photos/map-preview.jpg";
import type {
  Cuisine,
  MenuHighlight,
  Photo,
  PromoBanner,
  Restaurant,
  RestaurantSummary,
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
  mapPreview,
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

const fullWeek = (opensAt: string, closesAt: string) =>
  (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((weekday) => ({
    weekday,
    opensAt,
    closesAt,
  }));

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
    priceLevel: "$$",
    rating: 4.7,
    reviewsCount: 328,
    address: "ул. Достык, 89",
    addressNote: "Напротив Меги",
    city: "Алматы",
    distanceMeters: 650,
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
    mapImage: photo("mapPreview", "r1-map", "Расположение на карте"),
    promoBanners: banners("r1"),
    menuHighlights: menuHighlights("r1"),
    workingHours: fullWeek("10:00", "23:00"),
    tables: [
      { id: "t1", seats: 2, location: "hall", isAvailableNow: true },
      { id: "t2", seats: 4, location: "terrace", isAvailableNow: true },
      { id: "t3", seats: 6, location: "vip", isAvailableNow: false },
    ],
    description:
      "Современный ресторан с авторской кухней, уютной атмосферой и внимательным сервисом. Идеальное место для встреч, семейных ужинов и особых событий.",
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
    mapImage: photo("mapPreview", "r2-map", "Расположение на карте"),
    promoBanners: banners("r2"),
    menuHighlights: menuHighlights("r2"),
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
    phone: "+7 (707) 222-33-44",
    social: {
      whatsapp: "https://wa.me/77072223344",
    },
    coverPhoto: photo("interiorChandelier", "r3-cover", "Барная стойка суши"),
    photos: [
      photo("foodPlateTasting", "r3-1", "Сеты роллов", categoryFor("foodPlateTasting")),
      photo("interiorOpenKitchen", "r3-2", "Открытая кухня", categoryFor("interiorOpenKitchen")),
    ],
    mapImage: photo("mapPreview", "r3-map", "Расположение на карте"),
    promoBanners: banners("r3"),
    menuHighlights: menuHighlights("r3"),
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
    mapImage: photo("mapPreview", "r4-map", "Расположение на карте"),
    promoBanners: banners("r4"),
    menuHighlights: menuHighlights("r4"),
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

export const recentSearches = ["Грузинская кухня", "Бешбармак", "Merino"];
export const popularSearches = [
  "паназиатская кухня",
  "детская комната",
  "живая музыка",
  "веранда",
];
