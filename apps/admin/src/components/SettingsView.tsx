"use client";

import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { CapacityModeCard } from "./CapacityModeCard";
import { CuisinesCard } from "./CuisinesCard";
import { PricingCard } from "./PricingCard";
import { SocialLinksCard } from "./SocialLinksCard";
import { TelegramNotificationCard } from "./TelegramNotificationCard";
import { WhatsAppNotificationCard } from "./WhatsAppNotificationCard";

/**
 * «Настройки» — the venue's self-service settings: capacity mode, average
 * check, the venue's cuisines, its social links, and the Telegram chat its booking alerts are delivered to. Each card
 * owns its own load/save; the rest of the booking policy (buffers, lead time,
 * auto-confirm) is editable through the same PATCH but has no agreed UI yet, so
 * it is not faked here.
 */
export function SettingsView() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant!.id;

  return (
    <section className="mx-auto flex max-w-[900px] flex-col gap-xl">
      <h1 className="text-xl font-bold text-text">{t.admin.nav.settings}</h1>
      <CapacityModeCard restaurantId={restaurantId} />
      <PricingCard restaurantId={restaurantId} />
      <CuisinesCard restaurantId={restaurantId} />
      <SocialLinksCard restaurantId={restaurantId} />
      <TelegramNotificationCard restaurantId={restaurantId} />
      <WhatsAppNotificationCard restaurantId={restaurantId} />
    </section>
  );
}
