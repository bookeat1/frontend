import { useQuery } from "@tanstack/react-query";
import { useRepository } from "../lib/repository";

export function useRestaurant(id: string | undefined) {
  const repository = useRepository();
  return useQuery({
    queryKey: ["restaurant", id],
    queryFn: () => {
      if (!id) throw new Error("Missing restaurant id");
      return repository.getRestaurant(id);
    },
    enabled: Boolean(id),
  });
}

/**
 * The card-sized view of one venue. Used where a screen needs only the name /
 * photo (the bookings list): it is ONE request, while `useRestaurant` fans out
 * to four to build the detail screen.
 *
 * Its own cache key on purpose — the two answers have different shapes, and
 * sharing a key would let the cheap read evict the expensive one.
 */
export function useRestaurantSummary(id: string | undefined) {
  const repository = useRepository();
  return useQuery({
    queryKey: ["restaurant-summary", id],
    queryFn: () => {
      if (!id) throw new Error("Missing restaurant id");
      return repository.getRestaurantSummary(id);
    },
    enabled: Boolean(id),
    // The catalog changes on an editorial timescale; a venue's name is not
    // worth re-reading every time a list scrolls back into view.
    staleTime: 5 * 60_000,
  });
}
