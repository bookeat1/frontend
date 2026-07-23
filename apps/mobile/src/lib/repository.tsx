import { createRestaurantRepository, type RestaurantRepository } from "@bookeat/api";
import React, { createContext, useContext, useMemo } from "react";

/**
 * Dependency-injection seam for data access. Screens never import a concrete
 * repository directly — they call useRepository(). Which implementation is
 * live is decided once, here: createRestaurantRepository returns the real
 * HTTP-backed repository when EXPO_PUBLIC_API_URL is set, otherwise the mock
 * (so the app keeps running with zero backend setup, as before).
 */
const RepositoryContext = createContext<RestaurantRepository | null>(null);

export function RepositoryProvider({ children }: { children: React.ReactNode }) {
  const repository = useMemo<RestaurantRepository>(
    () => createRestaurantRepository(process.env.EXPO_PUBLIC_API_URL),
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
