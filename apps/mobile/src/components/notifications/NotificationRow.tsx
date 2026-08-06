import { colors, spacing, typography } from "@bookeat/design-tokens";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocale } from "../../lib/locale";
import { formatNotificationTimestamp } from "../../lib/format";
import type { AppNotification, NotificationType } from "../../hooks/useNotifications";
import { Bell, ForkKnife, Percent, type IconProps } from "../icons";

/** Leading glyph per type (Figma notifications render, 2026-08-06): a booking
 * carries the fork/utensils icon, a reminder the bell, a promo the percent. */
const ICON_BY_TYPE: Record<NotificationType, React.ComponentType<IconProps>> = {
  booking: ForkKnife,
  reminder: Bell,
  promo: Percent,
};

/**
 * One row of the «Уведомления» inbox: a leading circular tinted icon, a bold
 * title, a 1–3 line body, a muted relative-time line, and — for unread items —
 * a small brand-red dot on the right.
 *
 * The tint circle is the neutral chip fill with a brand-red glyph: the design
 * draws a pale-red circle, but there is no token for that hue and inventing one
 * (or bending `status.negativeSurface`, which means "cancelled") would be worse
 * than a documented, honest reuse. The red glyph carries the accent the render
 * intends. Swap the circle to a real token the day the design ships a spec.
 *
 * Long Russian titles wrap to two lines; the body is capped at three so one
 * verbose notification cannot push the whole list around.
 */
export function NotificationRow({ notification }: { notification: AppNotification }) {
  const { dictionary: t } = useLocale();
  const Icon = ICON_BY_TYPE[notification.type];
  const when = formatNotificationTimestamp(notification.createdAt, {
    today: t.notifications.today,
    yesterday: t.notifications.yesterday,
  });

  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={t.notifications.card(notification.title, when, !notification.read)}
    >
      <View style={styles.iconCircle}>
        <Icon size={20} color={colors.brand.primary} weight="fill" />
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {notification.title}
        </Text>
        <Text style={styles.body} numberOfLines={3}>
          {notification.body}
        </Text>
        <Text style={styles.timestamp}>{when}</Text>
      </View>

      {notification.read ? null : <View style={styles.unreadDot} />}
    </View>
  );
}

const ICON_CIRCLE = 40;
const UNREAD_DOT = 8;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: ICON_CIRCLE,
    height: ICON_CIRCLE,
    borderRadius: ICON_CIRCLE / 2,
    backgroundColor: colors.background.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.titleSm,
    color: colors.text.primary,
  },
  body: {
    ...typography.body,
    color: colors.text.primary,
  },
  timestamp: {
    ...typography.caption,
    color: colors.text.muted,
  },
  unreadDot: {
    width: UNREAD_DOT,
    height: UNREAD_DOT,
    borderRadius: UNREAD_DOT / 2,
    backgroundColor: colors.brand.primary,
    marginTop: spacing.sm,
  },
});
