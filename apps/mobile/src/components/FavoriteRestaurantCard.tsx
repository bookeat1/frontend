import type { RestaurantSummary } from "@bookeat/api";
import React from "react";
import { FavoriteButton } from "./explore/FavoriteButton";
import { useRestaurantFavorite } from "../hooks/useFavorites";
import { RestaurantCard } from "./RestaurantCard";

/**
 * Карточка заведения с сердечком избранного (макет 3452:13344, правка владельца
 * 2026-08-20 «добавлена кнопка избранная»).
 *
 * Отдельный компонент, а не флаг у `RestaurantCard`: сама карточка остаётся
 * тупой и не знает ни про запросы, ни про сессию, а сердечку нужен хук
 * избранного. Так карточку по-прежнему можно рисовать там, где избранное не
 * нужно вовсе, и это не тянет за собой запрос.
 *
 * Запрос один на экран: `useRestaurantFavorite` читает общий кэш
 * `["favorites"]`, поэтому двадцать карточек в списке не делают двадцати
 * запросов.
 */
export function FavoriteRestaurantCard({
  restaurant,
  onPress,
}: {
  restaurant: RestaurantSummary;
  onPress: (id: string) => void;
}) {
  const favorite = useRestaurantFavorite(restaurant.id);

  return (
    <RestaurantCard
      restaurant={restaurant}
      onPress={onPress}
      photoOverlay={
        <FavoriteButton
          itemName={restaurant.name}
          isFavorite={favorite.isFavorite}
          onToggle={favorite.toggle}
          placement="listCard"
        />
      }
    />
  );
}
