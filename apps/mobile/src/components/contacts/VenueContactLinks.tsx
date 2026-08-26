import type { Restaurant } from "@bookeat/api";
import {
  colors,
  controlHeight,
  hitSlop,
  radius,
  spacing,
  typography,
} from "@bookeat/design-tokens";
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

const t = getDictionary();

/**
 * Контакты заведения как НАЖИМАЕМЫЕ элементы: соцсети, адрес, телефон.
 *
 * Одна реализация на все экраны, где показывают контакты, — карточку брони
 * (`booking/ContactsCard`), карточку афиши и карточку акции
 * (`detail/VenueContactsSection`). До этого поведение жило только в брони, а на
 * карточках те же самые телефон и иконки были обычным текстом и `View`:
 * выглядело нажимаемым, не делало ничего.
 *
 * Правила, общие для всех экранов:
 *  - мёртвых контролов нет. Нет сайта — нет и кнопки сайта; нет координат —
 *    адрес остаётся обычной строкой, а не кнопкой, которая никуда не ведёт;
 *  - открытие внешней ссылки не бросает (см. `lib/external-links`): устройство
 *    без браузера или без звонилки — реальная конфигурация, и экран из-за неё
 *    падать не должен;
 *  - у каждого нажимаемого контакта роль и метка, которая говорит ДЕЙСТВИЕ
 *    («Позвонить в заведение»), а не просто называет поле.
 *
 * Отличается между экранами только просвет между иконками: у брони 12,
 * на карточке контента 8 (макет 986:8940). Поэтому `gap` — проп, а не константа.
 */

/**
 * Ряд круглых кнопок-контактов: ТЕЛЕФОН, сайт, WhatsApp, Instagram.
 * `null`, если у заведения нет ни одного.
 *
 * Телефон стоит ПЕРВЫМ и не подписан номером (правка владельца 2026-08-26):
 * раньше он был отдельной строкой под адресом и печатал сам номер текстом.
 * Номер на карточке гость не переписывает и не запоминает — он по нему
 * звонит, и для этого достаточно значка. Освободившаяся строка — это ещё и
 * ~44 pt высоты на каждой из трёх карточек, где блок контактов показан.
 *
 * `VenuePhoneRow` здесь больше НЕТ. Если номер снова понадобится текстом
 * (например, чтобы скопировать), это отдельное решение и отдельный контрол —
 * не возвращать строку молча.
 */
export function VenueContactIcons({
  phone,
  social,
  gap = spacing.md,
}: {
  /** Телефон заведения. Нет номера — нет и кнопки звонка. */
  phone?: string;
  social: Restaurant["social"];
  gap?: number;
}) {
  const { website, whatsapp, instagram } = social ?? {};
  if (!phone && !website && !whatsapp && !instagram) return null;

  return (
    <View style={[styles.socialRow, { gap }]}>
      {phone ? (
        <CircleLink
          icon={Phone}
          // Роль именно «кнопка»: это не переход по ссылке, а звонок.
          role="button"
          label={t.booking.contactPhone}
          onPress={() => void openPhone(phone)}
        />
      ) : null}
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
  );
}

/**
 * Адрес. Нажимается ТОЛЬКО когда есть координаты: без них открывать нечего, и
 * строка остаётся обычным текстом вместо кнопки-пустышки.
 */
export function VenueAddressRow({ restaurant }: { restaurant: Restaurant }) {
  const { address, addressNote, latitude, longitude } = restaurant;
  if (!address) return null;

  const canOpenMap = latitude !== undefined && longitude !== undefined;

  return (
    <ContactRow
      icon={MapPin}
      primary={address}
      secondary={addressNote}
      accessibilityLabel={`${t.booking.openInMaps}: ${address}`}
      accessibilityHint={canOpenMap ? t.booking.openInMapsHint : undefined}
      onPress={
        canOpenMap
          ? () =>
              void openMap({
                latitude,
                longitude,
                label: restaurant.name.trim() || address,
              })
          : undefined
      }
    />
  );
}

function CircleLink({
  icon: Icon,
  label,
  role = "link",
  onPress,
}: {
  icon: React.ComponentType<IconProps>;
  label: string;
  /** «Позвонить» — это действие на устройстве, а не переход по ссылке. */
  role?: "link" | "button";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={role}
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
  accessibilityHint,
  onPress,
}: {
  icon: React.ComponentType<IconProps>;
  primary: string;
  secondary?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <Icon size={24} color={colors.text.primary} weight="regular" />
      {/* flex:1 — длинный адрес «Проспект Аль-Фараби, 77/8, 1 этаж» переносится,
          а не уезжает за край экрана 360pt. */}
      <View style={styles.rowText}>
        <Text style={styles.rowPrimary}>{primary}</Text>
        {secondary ? (
          <Text style={styles.rowSecondary}>{secondary}</Text>
        ) : null}
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
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        styles.rowTappable,
        pressed && styles.pressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  socialRow: {
    flexDirection: "row",
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
