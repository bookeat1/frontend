"use client";

import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { CapacityModeCard } from "./CapacityModeCard";

/**
 * «Настройки» — today exactly one thing: the venue's capacity mode. The rest
 * of the booking policy (buffers, lead time, auto-confirm) is editable through
 * the same PATCH but has no agreed UI yet, so it is not faked here.
 */
export function SettingsView() {
  const { restaurant } = useAuth();
  const restaurantId = restaurant!.id;

  return (
    <section className="mx-auto flex max-w-[900px] flex-col gap-xl">
      <h1 className="text-xl font-bold text-text">{t.admin.nav.settings}</h1>
      <CapacityModeCard restaurantId={restaurantId} />
    </section>
  );
}
