import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable } from "react-native";
import { CardStrip } from "./CardStrip";
import { PromoCard } from "./PromoCard";
import { SectionCard, SectionHeader } from "./SectionCard";
import { useExplorePromotions } from "./use-explore-data";

const t = getDictionary();

/**
 * «Акции» — horizontal promo strip with discount badges.
 *
 * Tapping a tile opens that promo's card; the header chevron opens the full
 * «Акции» list — the same pair «Афиша» has.
 *
 * GRACEFUL EMPTY STATE: there is no live global promotions endpoint yet
 * (`useExplorePromotions` returns [] with a TODO), so this renders NOTHING —
 * not a header, not an empty block. The moment the hook returns real promos the
 * section appears with no other change. It owns its own `SectionCard`, so an
 * empty promo list leaves NO white block behind in the screen's stack.
 */
export function PromotionsSection({
  onSeeAll,
  onOpenPromotion,
}: {
  onSeeAll: () => void;
  onOpenPromotion: (promoId: string) => void;
}) {
  const promotions = useExplorePromotions();

  if (promotions.length === 0) {
    return null;
  }

  return (
    <SectionCard>
      <SectionHeader title={t.explore.promotionsTitle} onSeeAll={onSeeAll} />
      <CardStrip
        data={promotions}
        keyExtractor={(promo) => promo.id}
        accessibilityLabel={t.explore.promotionsTitle}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.promotions.card(item.title, item.subtitle)}
            onPress={() => onOpenPromotion(item.id)}
            style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
          >
            <PromoCard promo={item} />
          </Pressable>
        )}
      />
    </SectionCard>
  );
}
