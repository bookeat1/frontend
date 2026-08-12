import type { MyRestaurant } from "@bookeat/api/admin";

import type { TokenStorage } from "./token-store";

/**
 * Choosing a venue out of a long list — the search and the "recent" memory the
 * switcher and the post-login picker both need.
 *
 * This exists because a superadmin is staff at EVERY venue: the list is a
 * hundred rows long, and a hundred rows with no search is a wall, not a choice.
 * Kept as pure functions over a storage handle so they are testable without a
 * browser, the same shape token-store already uses.
 */

/** Recent venue ids, newest first. Five is what fits in the switcher without
 * turning the "recent" block into a second full list. */
export const RECENT_LIMIT = 5;

const RECENT_KEY = "bookeat.admin.recent_restaurants";

/** Normalizes a name or a query for comparison: case-insensitive, and «ё» is
 * folded to «е» — a venue typed one way must be findable typed the other. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").trim();
}

/**
 * The venues matching `query`, in the list's own order. A blank query returns
 * everything (the field is a filter, not a gate), and a query that matches
 * nothing returns [] so the caller can say so instead of showing the full list
 * as if nothing was typed.
 *
 * Matches on the venue NAME only: the list carries a role chip too, but
 * "администратор" matching a hundred venues is not a search result.
 */
export function filterVenues<T extends { name: string }>(venues: T[], query: string): T[] {
  const q = normalize(query);
  if (!q) return venues;
  return venues.filter((v) => normalize(v.name).includes(q));
}

export function readRecentVenueIds(storage: TokenStorage | null): string[] {
  const raw = storage?.getItem(RECENT_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id !== "").slice(0, RECENT_LIMIT);
  } catch {
    // A hand-edited or half-written value is "no history", never a crash on
    // the way into the panel.
    return [];
  }
}

/** Records a visit: the id moves to the front, duplicates collapse, the tail
 * beyond RECENT_LIMIT is dropped. Returns the new list so a caller can use it
 * without re-reading storage. */
export function rememberVenue(storage: TokenStorage | null, id: string): string[] {
  if (!id) return readRecentVenueIds(storage);
  const next = [id, ...readRecentVenueIds(storage).filter((existing) => existing !== id)].slice(
    0,
    RECENT_LIMIT,
  );
  try {
    storage?.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (Safari private mode): the panel still works,
    // it just forgets. Never a failed venue switch.
  }
  return next;
}

/** Drops the history — called on logout, so the next person on a shared
 * machine does not inherit someone else's venues. */
export function clearRecentVenues(storage: TokenStorage | null): void {
  try {
    storage?.removeItem(RECENT_KEY);
  } catch {
    // Same as above: forgetting to forget must not break signing out.
  }
}

/**
 * The recent venues as rows of `venues`, newest first, skipping ids the caller
 * no longer manages (staff removed from a team, venue deleted). The CURRENT
 * venue is excluded: it is already named in the switcher's own button, and
 * repeating it as a shortcut to itself wastes the shortest row.
 */
export function recentVenues<T extends MyRestaurant>(
  venues: T[],
  recentIds: string[],
  currentId: string | null,
): T[] {
  const byID = new Map(venues.map((v) => [v.id, v]));
  const out: T[] = [];
  for (const id of recentIds) {
    if (id === currentId) continue;
    const venue = byID.get(id);
    if (venue) out.push(venue);
  }
  return out;
}
