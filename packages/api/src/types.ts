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

export interface Restaurant {
  id: string;
  name: string;
  cuisines: Cuisine[];
  priceLevel: PriceLevel;
  rating: number; // 0..5
  reviewsCount: number;
  address: string;
  city: string;
  distanceMeters?: number;
  coverPhoto: Photo;
  photos: Photo[];
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
