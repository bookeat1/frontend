import type { RestaurantSummary } from "@bookeat/api";
import React from "react";
import { cuisineLine, splitCuisines } from "../lib/cuisine-display";
import { formatPriceRange } from "../lib/format";
import { openStateLabel } from "../lib/schedule";
import { ListMediaCard } from "./ListMediaCard";

interface RestaurantCardProps {
  restaurant: RestaurantSummary;
  onPress: (id: string) => void;
  /**
   * Абсолютно позиционированный элемент ПОВЕРХ снимка — сегодня это сердечко
   * избранного (`FavoriteRestaurantCard`).
   *
   * Слот, а не встроенное сердечко: в каталоге сердечка на карточке нет, и
   * включать его флагом означало бы тянуть запрос избранного на экраны,
   * которым он не нужен.
   */
  photoOverlay?: React.ReactNode;
}

/**
 * Карточка заведения в вертикальном списке (поиск, избранное). Вся геометрия
 * живёт в общей `ListMediaCard` — здесь остаётся только то, что делает
 * карточку карточкой ЗАВЕДЕНИЯ: какие поля идут в название и в подпись.
 *
 * Макет 3z0f6dgev4HMwBAHPjTjPo, node 3452:13344: имя места лежит на снимке,
 * под ним одна строка «Европейская · ₸₸₸ · 500 м».
 *
 * Расстояния («500 м») в подписи НЕТ и не будет, пока нет данных: ни
 * геопозиции гостя, ни расстояния в API. Прошлая версия этой строки считала
 * его из хеша id заведения — такое из приложения уже убирали. Чек
 * подставляется ЦИФРАМИ (правка владельца 2026-08-20), символьная ступень
 * ₸/₸₸/₸₸₸ из макета не используется: заведение без числового диапазона
 * остаётся без цены вовсе, а не показывает её другим языком, чем соседи.
 *
 * Описание в две строки и ряд бордовых чипов (кухни, чек, «Открыто») с
 * карточки ушли вместе со старой вёрсткой: в новом макете под снимком нет
 * места — оно всё внутри снимка. Статус открытости остаётся в
 * accessibilityLabel и на самой карточке заведения.
 */
export function RestaurantCard({ restaurant, onPress, photoOverlay }: RestaurantCardProps) {
  // В подписи — ГЛАВНАЯ кухня, одна: в макете там ровно одно название
  // («Европейская · ₸₸₸ · 500 м»), а строка однострочная. Весь набор,
  // включая непоказанные, уходит в метку для скринридера — так же, как это
  // делал прежний ряд чипов с «+N».
  const primaryCuisine = splitCuisines(restaurant.cuisines, 1).visible[0]?.name ?? "";
  const statusLabel = openStateLabel(restaurant.schedule);
  const price = restaurant.priceRange ? formatPriceRange(restaurant.priceRange) : "";
  // Подпись из того, что реально есть: пустые куски не оставляют висящих
  // разделителей «· ·».
  const subtitle = [primaryCuisine, price].filter(Boolean).join(" · ");

  return (
    <ListMediaCard
      title={restaurant.name}
      titleLines={1}
      subtitle={subtitle}
      coverUri={restaurant.coverPhoto?.uri}
      overlay={photoOverlay}
      onPress={() => onPress(restaurant.id)}
      // Скринридер слышит больше, чем видно глазами, ровно на статус
      // открытости: он был подписью на старой карточке, и терять его при
      // смене вёрстки было бы регрессом доступности.
      accessibilityLabel={[
        restaurant.name,
        cuisineLine(restaurant.cuisines),
        price,
        statusLabel,
      ]
        .filter(Boolean)
        .join(", ")}
    />
  );
}
