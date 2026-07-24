"use client";

import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { usePushNotifications } from "@/lib/use-push";

import { Button } from "./ui/Button";

/**
 * Header control that turns browser push notifications for new bookings on/off
 * for the currently-selected restaurant. Covers all states:
 *   unsupported / denied / disabled(enable) / enabled(disable) / error / loading.
 *
 * Deliberately compact so it survives the 360px header; the long RU copy is
 * kept for wide screens and collapsed to an icon + title on narrow ones.
 */
export function PushToggle() {
  const { restaurant } = useAuth();
  const { status, busy, error, enable, disable } = usePushNotifications(restaurant?.id ?? null);

  if (status === "loading") return null;

  if (status === "unsupported") {
    return (
      <span
        className="hidden max-w-[220px] items-center gap-xs text-[12px] text-text-muted lg:inline-flex"
        title={t.admin.push.unsupported}
      >
        <BellIcon muted />
        <span className="truncate">{t.admin.push.unsupported}</span>
      </span>
    );
  }

  if (status === "denied") {
    return (
      <span
        className="inline-flex max-w-[220px] items-center gap-xs text-[12px] text-text-muted"
        title={t.admin.push.deniedHint}
        role="status"
      >
        <BellIcon muted />
        <span className="hidden truncate sm:inline">{t.admin.push.denied}</span>
      </span>
    );
  }

  const enabled = status === "enabled";

  return (
    <div className="flex items-center gap-sm">
      <Button
        type="button"
        size="sm"
        variant={enabled ? "secondary" : "primary"}
        loading={busy}
        disabled={busy || !restaurant?.id}
        onClick={() => void (enabled ? disable() : enable())}
        // Idempotent-by-design: double-clicks are harmless (subscribe/getSubscription
        // reuse an existing subscription; the register call is an upsert).
        aria-pressed={enabled}
        title={enabled ? t.admin.push.enabled : t.admin.push.hint}
      >
        <BellIcon on={enabled} />
        <span className="hidden sm:inline">
          {busy
            ? enabled
              ? t.admin.push.disabling
              : t.admin.push.enabling
            : enabled
              ? t.admin.push.disable
              : t.admin.push.enable}
        </span>
      </Button>
      {status === "error" && error ? (
        <span role="alert" className="hidden max-w-[200px] truncate text-[12px] text-brand md:inline">
          {t.admin.push.error}
        </span>
      ) : null}
    </div>
  );
}

function BellIcon({ on = false, muted = false }: { on?: boolean; muted?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={muted ? "opacity-70" : undefined}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      {on ? <circle cx="18" cy="6" r="3" fill="currentColor" stroke="none" /> : null}
    </svg>
  );
}
