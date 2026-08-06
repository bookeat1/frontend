import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { CardStrip } from "./CardStrip";
import { PromoCard } from "./PromoCard";
import { SectionCard, SectionHeader } from "./SectionCard";
import { useExplorePromotions } from "./use-explore-data";

const t = getDictionary();

/**
 * «Акции» — horizontal promo strip with discount badges.
 *
 * GRACEFUL EMPTY STATE: there is no live global promotions endpoint yet
 * (`useExplorePromotions` returns [] with a TODO), so this renders NOTHING —
 * not a header, not an empty block. The moment the hook returns real promos the
 * section appears with no other change. It owns its own `SectionCard`, so an
 * empty promo list leaves NO white block behind in the screen's stack.
 */
export function PromotionsSection() {
  const promotions = useExplorePromotions();

  if (promotions.length === 0) {
    return null;
  }

  return (
    <SectionCard>
      <SectionHeader title={t.explore.promotionsTitle} />
      <CardStrip
        data={promotions}
        keyExtractor={(promo) => promo.id}
        accessibilityLabel={t.explore.promotionsTitle}
        renderItem={({ item }) => <PromoCard promo={item} />}
      />
    </SectionCard>
  );
}
