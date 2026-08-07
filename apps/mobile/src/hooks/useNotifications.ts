/**
 * Guest notifications inbox — the data behind the «Уведомления» screen.
 *
 * Backed by the real feed endpoint (`GET /notifications`, added B5 Part 2):
 * `useNotifications` mirrors `useMyBookings` — a session-gated `useQuery` on
 * `useRepository()`, so an anonymous guest never fires the request (it would be
 * a guaranteed 401) and the screen treats "signed out" as its own state. The
 * `AppNotification` shape and the type→filter mapping match the three chips.
 *
 * v1 reads only the FIRST page (no infinite scroll): the query returns the
 * feed's `nextCursor` so paging is a later additive change, but nothing walks
 * it yet.
 */
import type { AppNotification, NotificationFeed, NotificationType } from "@bookeat/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { useRepository } from "../lib/repository";

// Re-exported so the row component and the screen keep importing the notification
// types from here (their single import site) even though the canonical
// definition now lives in @bookeat/api next to the repository that produces it.
export type { AppNotification, NotificationType };

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

/** The three filter chips. `all` shows everything; `bookings` covers both
 * booking and reminder items; `promos` covers promo items. */
export type NotificationFilter = "all" | "bookings" | "promos";

/** Which notification types each chip admits. Single source of truth so the
 * chip row and the filtering stay in sync. */
export function matchesFilter(type: NotificationType, filter: NotificationFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "bookings":
      return type === "booking" || type === "reminder";
    case "promos":
      return type === "promo";
  }
}

/** Referentially stable empty list, so a loading/signed-out render does not
 * hand the screen a new `[]` on every pass. */
const NO_NOTIFICATIONS: readonly AppNotification[] = [];

export interface UseNotificationsResult {
  notifications: readonly AppNotification[];
  /** Whole-inbox unread total from the server (the home bell badge). 0 while
   * loading or signed out. */
  unreadCount: number;
  isLoading: boolean;
  isError: boolean;
  /** A background re-fetch of an already-loaded list is in flight — drives the
   * pull-to-refresh spinner without flipping the whole screen to `isLoading`. */
  isRefetching: boolean;
  /** Re-reads the feed — wired to the error state's retry and to pull-to-refresh. */
  refetch: () => void;
}

/**
 * The inbox feed. Session-gated like `useMyBookings`/`useFavorites`: disabled
 * until the guest is signed in, so `isLoading` stays false for an anonymous
 * guest and the screen shows its sign-in prompt instead of a spinner.
 */
export function useNotifications(): UseNotificationsResult {
  const repository = useRepository();
  const { status } = useAuth();

  const query = useQuery<NotificationFeed>({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => repository.listNotifications(),
    enabled: status === "signed-in",
    // A booking can be confirmed, a reminder or promo can arrive at any moment,
    // so the inbox is re-read on the way back to the screen — but not on every
    // keystroke elsewhere, hence a short window rather than 0.
    staleTime: 30_000,
  });

  return {
    notifications: query.data?.items ?? NO_NOTIFICATIONS,
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    isRefetching: query.isRefetching,
    refetch: () => {
      void query.refetch();
    },
  };
}

/**
 * Just the unread total, for the home-header bell badge. Reads the SAME
 * `["notifications"]` query as the screen, so the badge and the list can never
 * disagree and the bell costs no extra request.
 */
export function useUnreadNotificationsCount(): number {
  return useNotifications().unreadCount;
}

/** Context carried from onMutate to onError so a failed mark-read can roll the
 * cache back to exactly what it was. */
interface MarkReadContext {
  previous?: NotificationFeed;
}

/**
 * Marks ONE notification read with an optimistic cache update: the row flips to
 * read and the unread count drops immediately, then the server is told. A
 * failure rolls both back; either way the feed is invalidated so the badge and
 * list re-sync with the server's own truth.
 *
 * The token is refreshed before the write (access tokens live ~15 minutes and a
 * guest can sit on the inbox longer). Marking an already-read item is harmless
 * server-side, so a double tap cannot corrupt the count.
 */
export function useMarkNotificationRead() {
  const repository = useRepository();
  const queryClient = useQueryClient();
  const { ensureFreshToken } = useAuth();

  return useMutation<void, unknown, string, MarkReadContext>({
    mutationFn: async (id) => {
      await ensureFreshToken();
      await repository.markNotificationRead(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationFeed>(NOTIFICATIONS_QUERY_KEY);
      if (previous) {
        const wasUnread = previous.items.some((n) => n.id === id && !n.read);
        queryClient.setQueryData<NotificationFeed>(NOTIFICATIONS_QUERY_KEY, {
          ...previous,
          items: previous.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
          unreadCount: wasUnread ? Math.max(0, previous.unreadCount - 1) : previous.unreadCount,
        });
      }
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}

/**
 * Marks the whole inbox read. Optimistically clears every unread flag and the
 * count, rolls back on failure, and invalidates the feed to re-sync. The button
 * that drives it must be hidden/disabled when the count is already 0 — the
 * screen owns that, this hook always issues the request.
 */
export function useMarkAllNotificationsRead() {
  const repository = useRepository();
  const queryClient = useQueryClient();
  const { ensureFreshToken } = useAuth();

  return useMutation<void, unknown, void, MarkReadContext>({
    mutationFn: async () => {
      await ensureFreshToken();
      await repository.markAllNotificationsRead();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationFeed>(NOTIFICATIONS_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<NotificationFeed>(NOTIFICATIONS_QUERY_KEY, {
          ...previous,
          items: previous.items.map((n) => (n.read ? n : { ...n, read: true })),
          unreadCount: 0,
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}
