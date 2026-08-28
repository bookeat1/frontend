"use client";

import type { ReactNode } from "react";

import { t } from "@/lib/i18n";
import { Button } from "./ui/Button";

/** The four-state async pattern shared across screens: loading / empty / error
 * / (success rendered by the caller). Mirrors the mobile app's StateViews. */

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-md rounded-card bg-surface p-huge text-center">
      {children}
    </div>
  );
}

export function LoadingState({ title }: { title?: string }) {
  return (
    <Frame>
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"
      />
      <p className="text-sm text-text-muted" role="status" aria-live="polite">
        {title ?? t.admin.common.loading}
      </p>
    </Frame>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <Frame>
      <p className="text-base font-semibold text-text">{title}</p>
      {description ? <p className="max-w-sm text-sm text-text-muted">{description}</p> : null}
    </Frame>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Frame>
      <p className="text-base font-semibold text-text">{t.admin.common.errorTitle}</p>
      <p className="max-w-md text-sm text-text-muted">
        {message ?? t.admin.common.errorDescription}
      </p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {t.admin.common.retry}
        </Button>
      ) : null}
    </Frame>
  );
}

/**
 * The venue itself is gone from under the screen — 404/403 on the venue, not a
 * bad connection. Deliberately NOT an ErrorState: «Повторить» here repeats a
 * request that can only fail again, and the honest next step is picking another
 * venue. The action is passed in, because "pick another" means the header
 * switcher on a venue screen and nothing at all inside the venue catalog.
 */
export function VenueUnavailableState({
  description,
  onPickAnother,
}: {
  description?: string;
  onPickAnother?: () => void;
}) {
  const copy = t.admin.venueUnavailable;
  return (
    <Frame>
      <p className="text-base font-semibold text-text">{copy.title}</p>
      <p className="max-w-md text-sm text-text-muted" role="alert">
        {description ?? copy.description}
      </p>
      {onPickAnother ? (
        <Button variant="secondary" onClick={onPickAnother}>
          {copy.pick}
        </Button>
      ) : null}
    </Frame>
  );
}
