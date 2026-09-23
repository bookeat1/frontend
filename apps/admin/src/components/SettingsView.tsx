"use client";

import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { CapacityModeCard } from "./CapacityModeCard";
import { CuisinesCard } from "./CuisinesCard";
import { KwaakaLinkCard } from "./KwaakaLinkCard";
import { PricingCard } from "./PricingCard";
import { SocialLinksCard } from "./SocialLinksCard";
import { VenueFeaturesCard } from "./VenueFeaturesCard";
import { PaymentAcceptanceCard } from "./PaymentAcceptanceCard";
import { TelegramNotificationCard } from "./TelegramNotificationCard";
import { WhatsAppNotificationCard } from "./WhatsAppNotificationCard";

/**
 * «Настройки» — the venue's self-service settings: capacity mode, average
 * check, the venue's cuisines, its features («Удобства»), its social links, the
 * Telegram chat and the WhatsApp number its booking alerts go to, plus «Приём
 * оплаты» and «Kwaaka POS» for a superadmin (which company in our Kaspi
 * service this venue's money lands on, and which Kwaaka warehouse/menu this
 * venue syncs from). Each card owns its own load/save; the rest of the booking policy (buffers, lead time,
 * auto-confirm) is editable through the same PATCH but has no agreed UI yet, so
 * it is not faked here.
 */
export function SettingsView() {
  const { restaurant, user } = useAuth();
  const restaurantId = restaurant!.id;
  // «Приём оплаты» и «Kwaaka POS» показываем только суперадмину: бэкенд
  // вырезает эти поля из ответа и из PATCH для не-админа (как is_premium/
  // display_order), у управляющего они ответят 403 или просто не сохранятся,
  // а карточка, которая умеет только ругаться, хуже её отсутствия.
  const isSuperadmin = user?.role === "admin";

  return (
    <section className="mx-auto flex max-w-[900px] flex-col gap-xl">
      <h1 className="text-xl font-bold text-text">{t.admin.nav.settings}</h1>
      <CapacityModeCard restaurantId={restaurantId} />
      <PricingCard restaurantId={restaurantId} />
      <CuisinesCard restaurantId={restaurantId} />
      <VenueFeaturesCard restaurantId={restaurantId} />
      <SocialLinksCard restaurantId={restaurantId} />
      {isSuperadmin ? <PaymentAcceptanceCard restaurantId={restaurantId} /> : null}
      {isSuperadmin ? <KwaakaLinkCard restaurantId={restaurantId} /> : null}
      <TelegramNotificationCard restaurantId={restaurantId} />
      <WhatsAppNotificationCard restaurantId={restaurantId} />
    </section>
  );
}
