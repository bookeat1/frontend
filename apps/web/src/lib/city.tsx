"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { isApiConfigured, repository } from "@web/lib/api";

/**
 * Выбранный город.
 *
 * Список городов приходит с сервера (`GET /cities`), а не зашит в код: сегодня
 * это «Астана» и «Алматы», завтра владелец добавит третий, и сайт про него
 * узнает без пересборки. Пока список не приехал, города нет вовсе — и блоки
 * главной, которым он обязателен (`/restaurants/picks`, `/feed`), честно
 * показывают загрузку вместо выдачи по наугад выбранному городу.
 */
const STORAGE_KEY = "bookeat.web.city";

interface CityContextValue {
  /** undefined, пока список городов не загружен. */
  city: string | undefined;
  setCity: (city: string) => void;
  cities: string[];
  isLoading: boolean;
  isError: boolean;
}

const CityContext = createContext<CityContextValue>({
  city: undefined,
  setCity: () => {},
  cities: [],
  isLoading: false,
  isError: false,
});

export function CityProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<string | undefined>(undefined);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setStored(saved);
  }, []);

  const citiesQuery = useQuery({
    queryKey: ["cities"],
    queryFn: () => repository.getCities(),
    enabled: isApiConfigured,
    // Список городов меняется раз в квартал — держим его дольше обычного,
    // чтобы переход между страницами не дёргал сеть.
    staleTime: 10 * 60_000,
  });

  const cities = useMemo(() => citiesQuery.data ?? [], [citiesQuery.data]);

  // Сохранённый город учитывается, только если он ЕСТЬ в ответе сервера:
  // город могли переименовать или снять, и тогда все запросы с ним вернули бы
  // пустые списки без единого объяснения.
  const city = useMemo(() => {
    if (cities.length === 0) return undefined;
    return stored && cities.includes(stored) ? stored : cities[0];
  }, [cities, stored]);

  const setCity = useCallback((next: string) => {
    setStored(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<CityContextValue>(
    () => ({
      city,
      setCity,
      cities,
      isLoading: citiesQuery.isPending && isApiConfigured,
      isError: citiesQuery.isError,
    }),
    [city, setCity, cities, citiesQuery.isPending, citiesQuery.isError],
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity(): CityContextValue {
  return useContext(CityContext);
}
