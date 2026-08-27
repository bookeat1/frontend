import type { HomePromo } from "@bookeat/api";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { formatDayMonth } from "../../lib/format";
import { ListMediaCard } from "../ListMediaCard";

const t = getDictionary();

/**
 * Карточка списка «Акции».
 *
 * Геометрия — общая `ListMediaCard` (макет 3z0f6dgev4HMwBAHPjTjPo, node
 * 3452:13344), та же, что на странице поиска и в избранном: снимок 198 со
 * скруглением 22, название ВНУТРИ снимка, под ним строка «заведение · срок».
 * Владелец попросил 2026-08-27 привести листинги к виду страницы поиска.
 *
 * Своё у акции ровно одно — плашка «−N%» в левом верхнем углу, когда лента
 * прислала скидку. Она приходит в общую карточку пропом `badge`, а не второй
 * вёрсткой.
 */
export function PromotionListCard({
  promo,
  onPress,
}: {
  promo: HomePromo;
  onPress: (promoId: string) => void;
}) {
  const endsAt = new Date(promo.endsAt);
  const until = Number.isNaN(endsAt.getTime()) ? "" : t.promotions.until(formatDayMonth(endsAt));
  const subtitle = t.promotions.subtitle([promo.restaurantName.trim(), until]);

  return (
    <ListMediaCard
      title={promo.title}
      subtitle={subtitle}
      coverUri={promo.coverImageUrl}
      badge={
        promo.discountPercent !== null ? t.explore.promoDiscount(promo.discountPercent) : undefined
      }
      onPress={() => onPress(promo.id)}
      accessibilityLabel={t.promotions.card(promo.title, promo.restaurantName.trim())}
    />
  );
}
