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
 * узнает без пересборки.
 *
 * Пока у гостя нет своего выбора (ничего не сохранено в localStorage, а
 * геолокация не запрашивается и не подключена — см. ADR-016) — сайт открывает
 * `DEFAULT_CITY`. Это НЕ `cities[0]`: сервер отдаёт `["Астана","Алматы"]`
 * (порядок enum на бэкенде, не алфавит и не популярность), так что «первый в
 * ответе» тихо был Астаной. Дефолт — константа, а не порядок ответа сервера.
 */
const STORAGE_KEY = "bookeat.web.city";

/**
 * Город по умолчанию, пока гость не выбрал свой (и геолокация не сработала —
 * её сегодня нет, см. ADR-016 «Город гостя»). Показывается сразу, не дожидаясь
 * ответа `GET /cities`: значение — канонический enum бэкенда, а не догадка,
 * так что пустое состояние на время загрузки не нужно.
 */
const DEFAULT_CITY = "Алматы";

interface CityContextValue {
  /**
   * `DEFAULT_CITY` («Алматы»), пока гость не выбрал город сам. `undefined`
   * бывает только переходно: в localStorage есть сохранённый выбор, но ответ
   * `GET /cities` для его проверки ещё не пришёл.
   */
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
  // пустые списки без единого объяснения. Поэтому сохранённый выбор ждёт
  // ответа `GET /cities` для проверки. Дефолт же (гость ничего не выбирал)
  // не ждёт ничего — `DEFAULT_CITY` не гипотеза, которую надо сверять, а
  // константа, зашитая наравне с бэкендовым enum.
  const city = useMemo(() => {
    if (stored) {
      if (cities.length === 0) return undefined;
      return cities.includes(stored) ? stored : DEFAULT_CITY;
    }
    return cities.length === 0 || cities.includes(DEFAULT_CITY) ? DEFAULT_CITY : cities[0];
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
