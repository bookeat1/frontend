import { MockRestaurantRepository, type RestaurantRepository } from "@bookeat/api";
import React, { createContext, useContext, useMemo } from "react";

/**
 * Dependency-injection seam for data access. Screens never import
 * MockRestaurantRepository directly — they call useRepository(). Swapping
 * the mock for a real HTTP-backed implementation later means changing the
 * `value` passed to this provider once, here, and nowhere else.
 */
const RepositoryContext = createContext<RestaurantRepository | null>(null);

export function RepositoryProvider({ children }: { children: React.ReactNode }) {
  const repository = useMemo<RestaurantRepository>(
    () => new MockRestaurantRepository({ latencyMs: 600 }),
    [],
  );

  return (
    <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>
  );
}

export function useRepository(): RestaurantRepository {
  const repository = useContext(RepositoryContext);
  if (!repository) {
    throw new Error("useRepository must be used within a RepositoryProvider");
  }
  return repository;
}
