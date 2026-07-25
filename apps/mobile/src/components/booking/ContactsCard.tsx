import type { Restaurant } from "@bookeat/api";
import { colors, controlHeight, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  openInstagram,
  openMap,
  openPhone,
  openWebsite,
  openWhatsApp,
} from "../../lib/external-links";
import {
  GlobeSimple,
  InstagramLogo,
  MapPin,
  Phone,
  WhatsappLogo,
  type IconProps,
} from "../icons";
import { BookingCard } from "./BookingCard";
import { MapPreview } from "./MapPreview";

const t = getDictionary();

/**
 * "Контакты" on the Reservation detail screen (Figma node 488:9876): a row of
 * circular icon buttons, then the address row, the phone row and the map
 * preview.
 *
 * Nothing here is rendered as a dead control. A venue with no website gets no
 * globe button at all rather than a button that does nothing — on the live
 * catalog `social_links` is frequently null, so this is the common case, not
 * an edge one. If the venue has no contacts whatsoever the card itself is not
 * rendered (decided by the caller via `hasAnyContact`).
 */
export function hasAnyContact(restaurant: Restaurant): boolean {
  return Boolean(
    restaurant.social?.website ||
      restaurant.social?.whatsapp ||
      restaurant.social?.instagram ||
      restaurant.address ||
      restaurant.phone ||
      (restaurant.latitude !== undefined && restaurant.longitude !== undefined),
  );
}

export function ContactsCard({ restaurant }: { restaurant: Restaurant }) {
  const { website, whatsapp, instagram } = restaurant.social ?? {};
  const hasSocial = Boolean(website || whatsapp || instagram);
  const phone = restaurant.phone;
  const { latitude, longitude } = restaurant;

  return (
    <BookingCard title={t.booking.contactsTitle}>
      {hasSocial ? (
        <View style={styles.socialRow}>
          {website ? (
            <CircleLink
              icon={GlobeSimple}
              label={t.booking.contactWebsite}
              onPress={() => void openWebsite(website)}
            />
          ) : null}
          {whatsapp ? (
            <CircleLink
              icon={WhatsappLogo}
              label={t.booking.contactWhatsapp}
              onPress={() => void openWhatsApp(whatsapp)}
            />
          ) : null}
          {instagram ? (
            <CircleLink
              icon={InstagramLogo}
              label={t.booking.contactInstagram}
              onPress={() => void openInstagram(instagram)}
            />
          ) : null}
        </View>
      ) : null}

      {restaurant.address ? (
        <ContactRow
          icon={MapPin}
          primary={restaurant.address}
          secondary={restaurant.addressNote}
          accessibilityLabel={`${t.booking.openInMaps}: ${restaurant.address}`}
          // Tappable only when there is somewhere to go: with no coordinates
          // this stays a plain row instead of a button that does nothing.
          onPress={
            latitude !== undefined && longitude !== undefined
              ? () =>
                  void openMap({
                    latitude,
                    longitude,
                    label: restaurant.name.trim() || restaurant.address,
                  })
              : undefined
          }
        />
      ) : null}

      {phone ? (
        <ContactRow
          icon={Phone}
          primary={phone}
          secondary={t.restaurant.phoneLabel}
          accessibilityLabel={`${t.restaurant.phoneLabel}: ${phone}`}
          onPress={() => void openPhone(phone)}
        />
      ) : null}

      <MapPreview restaurant={restaurant} />
    </BookingCard>
  );
}

function CircleLink({
  icon: Icon,
  label,
  onPress,
}: {
  icon: React.ComponentType<IconProps>;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
    >
      <Icon size={24} color={colors.text.primary} weight="regular" />
    </Pressable>
  );
}

function ContactRow({
  icon: Icon,
  primary,
  secondary,
  accessibilityLabel,
  onPress,
}: {
  icon: React.ComponentType<IconProps>;
  primary: string;
  secondary?: string;
  accessibilityLabel?: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <Icon size={24} color={colors.text.primary} weight="regular" />
      {/* flex:1 so "Проспект Аль-Фараби, 77/8, 1 этаж" wraps instead of
          running off a 360px screen. */}
      <View style={styles.rowText}>
        <Text style={styles.rowPrimary}>{primary}</Text>
        {secondary ? <Text style={styles.rowSecondary}>{secondary}</Text> : null}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? primary}
      onPress={onPress}
      style={({ pressed }) => [styles.row, styles.rowTappable, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  socialRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  circle: {
    width: controlHeight.contactIcon,
    height: controlHeight.contactIcon,
    borderRadius: radius.pill,
    backgroundColor: colors.background.socialIcon,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowTappable: {
    minHeight: hitSlop.minTouchTarget,
  },
  rowText: {
    flex: 1,
  },
  rowPrimary: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  rowSecondary: {
    ...typography.caption,
    color: colors.text.muted,
  },
  pressed: {
    opacity: 0.7,
  },
});
