import React from "react";
import { FavoriteButton } from "../explore/FavoriteButton";
import { ListMediaCard } from "../ListMediaCard";

/**
 * Карточка сохранённого СОБЫТИЯ или АКЦИИ на экране «Избранное».
 *
 * Геометрия — общая `ListMediaCard` (макет 3z0f6dgev4HMwBAHPjTjPo, node
 * 3452:13344): тот же снимок 198 со скруглением 22, то же название ВНУТРИ
 * снимка. Владелец попросил 2026-08-27, чтобы избранное выглядело как
 * страница поиска, и разная высота обложки в одном списке заведений, событий
 * и акций читалась бы как разные виды карточек, а не как разный материал.
 *
 * Отдельный компонент, а не прямой вызов `ListMediaCard` из экрана: здесь
 * живёт сердечко и правило «у события есть теги, у акции бейдж скидки».
 *
 * Ряд чипов-тегов события с карточки УБРАН: в новой вёрстке под снимком нет
 * места — там всё внутри снимка, — а сами теги гость видит на карточке
 * события. Полный набор по-прежнему уходит в метку для скринридера.
 *
 * Полностью controlled: своего состояния сердечка нет, о нём знает вызывающий
 * (хуки useEventFavorite / usePromoFavorite).
 */
export function FavoriteMediaCard({
  title,
  meta,
  coverImageUrl,
  badge,
  favorite,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  /** Одна строка под названием: «16 мая · 13:00» у события, «до 6 сентября» у
   * акции. Пустая строка — строки просто нет. */
  meta: string;
  coverImageUrl: string | null;
  /** Красный бейдж «−30%» поверх снимка (только у акции со скидкой). */
  badge?: string;
  favorite: { isFavorite: boolean; onToggle: () => void };
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <ListMediaCard
      title={title}
      subtitle={meta}
      coverUri={coverImageUrl}
      badge={badge}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      overlay={
        // Сердечко — отдельная кнопка ВНУТРИ карточки-кнопки: тап по нему
        // сохраняет/убирает, тап мимо него открывает карточку.
        <FavoriteButton
          itemName={title}
          isFavorite={favorite.isFavorite}
          onToggle={favorite.onToggle}
          placement="listCard"
        />
      }
    />
  );
}
