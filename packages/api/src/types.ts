export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface WorkingHoursEntry {
  weekday: Weekday;
  /** null = closed that day */
  opensAt: string | null; // "10:00"
  closesAt: string | null; // "23:00"
}

export type PriceLevel = "$" | "$$" | "$$$" | "$$$$";

export interface Photo {
  id: string;
  /** Local require() asset or remote uri, resolved by the caller. */
  uri: string;
  width: number;
  height: number;
  alt: string;
  /** Gallery tab this photo belongs to — matches "Все / Еда / Интерьер"
   * (Figma node 340:2354). Optional so callers that don't need filtering
   * (e.g. the cover photo) can omit it. */
  category?: "food" | "interior";
}

export interface Cuisine {
  id: string;
  name: string;
}

export interface RestaurantTable {
  id: string;
  seats: number;
  location: "hall" | "terrace" | "bar" | "vip";
  isAvailableNow: boolean;
}

/** A promo banner card in the horizontal strip under the Обзор/Фото tabs. */
export interface PromoBanner {
  id: string;
  title: string;
  /** Optional: the backend's promo entity (GET /restaurants/:id/promos) has no
   * image field at all, so a real promo renders as a caption over the brand
   * placeholder background. Present only for the mock fixtures. */
  photo?: Photo;
}

/** A dish shown in the "Популярное в меню" section. */
export interface MenuHighlight {
  id: string;
  name: string;
  description: string;
  /** Pre-formatted display price, e.g. "8 990 ₸" — matches the design, which
   * doesn't localize/format a raw number in the UI layer. */
  price: string;
  photo: Photo;
}

export interface RestaurantSocialLinks {
  website?: string;
  whatsapp?: string;
  instagram?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisines: Cuisine[];
  priceLevel: PriceLevel;
  rating: number; // 0..5
  reviewsCount: number;
  address: string;
  /** Short landmark note shown under the address, e.g. "Напротив Меги". */
  addressNote?: string;
  city: string;
  distanceMeters?: number;
  phone?: string;
  social?: RestaurantSocialLinks;
  coverPhoto: Photo;
  photos: Photo[];
  /** Static map preview shown in the Контакты section. */
  mapImage?: Photo;
  promoBanners: PromoBanner[];
  menuHighlights: MenuHighlight[];
  workingHours: WorkingHoursEntry[];
  tables: RestaurantTable[];
  description: string;
  isOpenNow: boolean;
  isBookable: boolean;
}

export interface RestaurantSummary {
  id: string;
  name: string;
  cuisines: Cuisine[];
  priceLevel: PriceLevel;
  rating: number;
  reviewsCount: number;
  address: string;
  distanceMeters?: number;
  coverPhoto: Photo;
  isOpenNow: boolean;
}

export interface SearchFilters {
  cuisineIds: string[];
  minRating?: number;
  openNowOnly: boolean;
  maxDistanceMeters?: number;
  /** City name exactly as the catalog spells it ("Алматы"/"Астана") — the
   * backend's city filter is an equality match on that enum value, there is
   * no city id. Undefined = every city. */
  city?: string;
  /** Single price tier, pushed server-side. Undefined = every tier. */
  priceLevel?: PriceLevel;
}

export interface SearchQuery {
  text: string;
  filters: SearchFilters;
}

export interface SearchResult {
  query: SearchQuery;
  items: RestaurantSummary[];
  total: number;
}

export const EMPTY_FILTERS: SearchFilters = {
  cuisineIds: [],
  openNowOnly: false,
};
