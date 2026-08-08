import { RepositoryError } from "@bookeat/api";
import React from "react";
import { openSupport, SUPPORT_CONTACT_URL } from "../lib/external-links";
import { useLocale } from "../lib/locale";
import { Warning, WifiSlash, Wrench } from "./icons";
import { ErrorState, type StateAction } from "./StateViews";

/**
 * The one place a failed data fetch becomes an on-screen error state.
 *
 * A fetch can fail three ways the guest experiences differently, so it must
 * NOT collapse into a single "что-то пошло не так":
 *
 *   - OFFLINE — the request never reached the server (no network / timeout,
 *     `RepositoryError.isOffline`). WifiSlash + a retry that refetches; the
 *     guest can act (turn on Wi-Fi) and try again.
 *   - MAINTENANCE — the server answered HTTP 503 (`isMaintenance`). Wrench +
 *     «Написать в поддержку»; retrying now is pointless, so no retry button.
 *   - GENERIC — any other server error. Warning + «Написать в поддержку».
 *
 * The classification lives on `RepositoryError` (packages/api) so it is shared
 * and unit-tested; this component only maps the three cases to the template.
 * A non-RepositoryError (should not happen for repository calls) falls through
 * to GENERIC — the safe default.
 *
 * `«Написать в поддержку»` is only rendered when a real support contact is
 * wired: `SUPPORT_CONTACT_URL` is currently `undefined` (no support channel
 * yet — a WhatsApp bot is planned later), so the maintenance/generic states
 * show just icon + title + description with NO dead link. The moment the
 * constant is filled in external-links.ts the link reappears automatically,
 * with no change here. The retry path (offline) stays functional regardless.
 */
export function DataErrorState({
  error,
  onRetry,
  compact,
}: {
  error: unknown;
  onRetry: () => void;
  compact?: boolean;
}) {
  const { dictionary: t } = useLocale();

  // No support destination configured → don't render a dead link at all.
  const supportAction: StateAction | undefined = SUPPORT_CONTACT_URL
    ? { label: t.states.writeSupport, onPress: () => void openSupport(), variant: "link" }
    : undefined;

  if (error instanceof RepositoryError && error.isOffline) {
    return (
      <ErrorState
        compact={compact}
        icon={WifiSlash}
        title={t.states.offlineTitle}
        description={t.states.offlineDescription}
        action={{ label: t.common.retry, onPress: onRetry, variant: "button" }}
      />
    );
  }

  if (error instanceof RepositoryError && error.isMaintenance) {
    return (
      <ErrorState
        compact={compact}
        icon={Wrench}
        title={t.states.maintenanceTitle}
        description={t.states.maintenanceDescription}
        action={supportAction}
      />
    );
  }

  return (
    <ErrorState
      compact={compact}
      icon={Warning}
      title={t.states.failedTitle}
      description={t.states.failedDescription}
      action={supportAction}
    />
  );
}
