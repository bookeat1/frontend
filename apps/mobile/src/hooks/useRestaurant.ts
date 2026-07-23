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
