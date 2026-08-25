"use client";

import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { CapacityModeCard } from "./CapacityModeCard";
import { CuisinesCard } from "./CuisinesCard";
import { PricingCard } from "./PricingCard";
import { SocialLinksCard } from "./SocialLinksCard";
import { VenueFeaturesCard } from "./VenueFeaturesCard";
import { TelegramNotificationCard } from "./TelegramNotificationCard";
import { WhatsAppRecipientsCard } from "./WhatsAppRecipientsCard";

/**
 * «Настройки» — the venue's self-service settings: capacity mode, average
 * check, the venue's cuisines, its features («Удобства»), its social links, the
 * Telegram chat its booking alerts go to, and — in a single card («Брони в
 * WhatsApp») — every WhatsApp recipient of those alerts: the venue's own number
 * plus the staff who opted in on their personal phone. Each card
 * owns its own load/save; the rest of the booking policy (buffers, lead time,
 * auto-confirm) is editable through the same PATCH but has no agreed UI yet, so
 * it is not faked here.
 */
export function SettingsView() {
  const { restaurant, user } = useAuth();
  const restaurantId = restaurant!.id;

  return (
    <section className="mx-auto flex max-w-[900px] flex-col gap-xl">
      <h1 className="text-xl font-bold text-text">{t.admin.nav.settings}</h1>
      <CapacityModeCard restaurantId={restaurantId} />
      <PricingCard restaurantId={restaurantId} />
      <CuisinesCard restaurantId={restaurantId} />
      <VenueFeaturesCard restaurantId={restaurantId} />
      <SocialLinksCard restaurantId={restaurantId} />
      <TelegramNotificationCard restaurantId={restaurantId} />
      {user ? (
        <WhatsAppRecipientsCard
          restaurantId={restaurantId}
          actorUserId={user.id}
          isPlatformAdmin={user.role === "admin"}
        />
      ) : null}
    </section>
  );
}
