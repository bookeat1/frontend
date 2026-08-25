import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUnreadNotificationsCount } from "../../hooks/useNotifications";
import { useLocale } from "../../lib/locale";
import { IconButton } from "../IconButton";
import { Bell, CalendarBlank, MapPin, User } from "../icons";
import { homeHeaderHeight } from "./home-header-layout";

/**
 * Rebuilt home header (Figma home design, 2026-08-06). Replaces the old promo
 * `HeroCarousel`: a compact dark block that runs under the status bar and
 * holds — the city (top-left), a notification bell (top-right, no badge: the
 * notifications feed endpoint does not exist yet, so there is no real unread
 * count to show and a fabricated one would lie), a large personalised
 * greeting, and a date/guests selector row.
 *
 * The design's dark restaurant photo ships with the app (assets/
 * home-header.jpg — бокал у бархатного занавеса, кадр из макета 3102:11986,
 * заменён 2026-08-25). It is a bundled asset rather than a remote url because
 * the backend still has no home-header image endpoint; the dark fill
 * (`colors.background.header`) stays underneath as the colour the header falls
 * back to while the image decodes. A scrim over the photo keeps the white
 * greeting, city and bell legible on its lighter areas. The screen flips the
 * status bar to light content while this is on screen.
 *
 * Высота блока задана правилом «верхняя безопасная зона + 264»
 * (`homeHeaderHeight`), а не собирается из содержимого, — так в макете.
 *
 * Оба селектора — половинки одной капсулы (макет главной), и оба ведут в
 * `/search`: своего состояния даты и гостей главная не держит, тап просто
 * открывает каталог, где живёт настоящий выбор. Половины при этом РАЗНЫЕ:
 * каждая открывает в каталоге своё колесо (правка владельца 2026-08-24), —
 * поэтому два колбэка, а не один общий «открыть поиск».
 *
 * The bell opens the «Уведомления» screen (`/notifications`) and carries an
 * unread badge fed by the real feed's `unread_count` (B5 Part 2), read from the
 * SAME `["notifications"]` query the screen uses — so the badge and the inbox
 * can never disagree, and it costs no extra request. The badge hides at 0 and,
 * for a signed-out guest, the query is disabled so the count is 0 (no badge).
 */
export function HomeHeader({
  greeting,
  city,
  dateValue,
  guestsValue,
  onOpenDate,
  onOpenGuests,
  onOpenNotifications,
  onOpenCity,
}: {
  greeting: string;
  city: string;
  dateValue: string;
  guestsValue: string;
  /** Открыть каталог с раскрытым выбором ДАТЫ. */
  onOpenDate: () => void;
  /** Открыть каталог с раскрытым выбором ЧИСЛА ГОСТЕЙ. */
  onOpenGuests: () => void;
  onOpenNotifications: () => void;
  /** Opens the city picker (same screen the profile uses). */
  onOpenCity: () => void;
}) {
  const { dictionary: t } = useLocale();
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadNotificationsCount();

  return (
    <View
      style={[
        styles.root,
        // `minHeight`, а не `height`: при нормальном размере шрифта содержимое
        // (44 + 16 + до двух строк по 32 + 16 + 48 + отступы = 224) в 264
        // помещается с запасом, и блок ровно такой, как в макете. Но у корня
        // стоит `overflow: "hidden"` ради скруглённого низа фотографии, и на
        // системном увеличении шрифта жёсткая высота срезала бы капсулу даты и
        // гостей. Так блок в этом единственном случае вырастет.
        { paddingTop: insets.top + spacing.lg, minHeight: homeHeaderHeight(insets.top) },
      ]}
    >
      {/* Photo and scrim are decorative layers BEHIND the header's controls —
          hidden from screen readers individually rather than by wrapping the
          block, which would take the city picker, the bell and both pills out
          of the accessibility tree with them. */}
      <Image
        source={require("../../../assets/home-header.jpg")}
        style={styles.photo}
        contentFit="cover"
        // Выравнивание по НИЗУ. Кадр почти квадратный (1627x1517), шапка шире,
        // чем выше, поэтому при `cover` обрезается только верх-низ: на экране
        // 375 из 350 отрисованных точек высоты видно 308, лишние 42 надо
        // откуда-то снять. Бокал с рукой занимает нижние две трети кадра и
        // упирается в самый низ, так что верх (пустой занавес) — единственное,
        // что можно резать: по центру срезало бы основание бокала, по верху —
        // и основание, и кисть. На узком 360 обрезка ещё меньше (~28), бокал
        // цел там тем более.
        contentPosition="bottom"
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View
        style={styles.scrim}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={styles.topRow}>
        <Pressable
          style={({ pressed }) => [styles.city, pressed && styles.cityPressed]}
          accessibilityRole="button"
          accessibilityLabel={t.explore.cityLabel(city)}
          onPress={onOpenCity}
        >
          <MapPin size={24} color={colors.text.onDark} weight="fill" />
          <Text style={styles.cityLabel} numberOfLines={1}>
            {city}
          </Text>
        </Pressable>

        <View style={styles.bellWrap}>
          <IconButton
            icon={Bell}
            tone="onDark"
            accessibilityLabel={t.notifications.bell(unreadCount)}
            onPress={onOpenNotifications}
          />
          {unreadCount > 0 ? (
            // Decorative: the count is already spoken through the bell's own
            // accessibilityLabel, so the badge is hidden from the screen reader
            // and non-interactive (taps go to the button underneath).
            <View
              style={styles.badge}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : null}
        </View>
      </View>

      {/* Long RU first names wrap to a second line instead of pushing the
          header taller in one unreadable line. */}
      <Text style={styles.greeting} numberOfLines={2}>
        {greeting}
      </Text>

      {/* Дата и гости — ОДНА белая капсула, разделённая тонкой линией
          (node 986:8721), а не два отдельных пилла: так в макете главной.
          Пилл со стрелкой (PillSelect) остаётся на экране брони, где он и
          нарисован. */}
      <View style={styles.selectorRow}>
        <Pressable
          style={({ pressed }) => [styles.selector, styles.selectorLeft, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${t.explore.dateSelectorLabel}: ${dateValue}`}
          onPress={onOpenDate}
        >
          <CalendarBlank size={24} color={colors.text.primary} weight="regular" />
          <Text style={styles.selectorValue} numberOfLines={1}>
            {dateValue}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.selector, styles.selectorRight, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${t.explore.guestsSelectorLabel}: ${guestsValue}`}
          onPress={onOpenGuests}
        >
          <User size={24} color={colors.text.primary} weight="regular" />
          <Text style={styles.selectorValue} numberOfLines={1}>
            {guestsValue}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Diameter of the unread badge on the bell. A local layout constant like
 * NotificationRow's ICON_CIRCLE — not a design token, since it exists only
 * here. */
const BADGE_SIZE = 8;

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background.header,
    // The photo is clipped by the same rounded bottom as the block itself.
    overflow: "hidden",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    // The white sheet below overlaps this block's rounded bottom by the same
    // amount the old hero used, so keep room for that overlap.
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    gap: spacing.lg,
  },
  photo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay.headerScrim,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  bellWrap: {
    position: "relative",
    // Кнопка 44pt шире своего значка 24pt, и значок из-за этого отходил от
    // поля страницы на 10pt внутрь, хотя в макете он стоит вплотную. Сдвигаем
    // саму кнопку, тач-таргет при этом остаётся прежним.
    marginRight: -10,
  },
  badge: {
    position: "absolute",
    // Точка непрочитанных, как в макете (node 986:8718): 8pt без числа.
    // Сидит над правым верхом колокольчика и не растягивает тач-таргет 44pt.
    top: 8,
    right: 6,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.brand.primary,
  },
  city: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    flexShrink: 1,
    // A comfortable tap target for the city picker without shifting the layout.
    minHeight: 44,
  },
  cityPressed: {
    opacity: 0.6,
  },
  cityLabel: {
    ...typography.body,
    color: colors.text.onDark,
    flexShrink: 1,
  },
  greeting: {
    ...typography.titleXxl,
    color: colors.text.onDark,
  },
  selectorRow: {
    flexDirection: "row",
    alignItems: "center",
    // Капсула прижата к низу блока: высота теперь фиксирована правилом, и
    // свободное место при коротком приветствии должно оставаться НАД ней, а не
    // висеть под ней, как было бы при раскладке сверху вниз.
    marginTop: "auto",
  },
  selector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: controlHeight.pill,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.surface,
  },
  selectorLeft: {
    borderTopLeftRadius: radius.pill,
    borderBottomLeftRadius: radius.pill,
    // Волосяная линия между половинками — в макете это граница, а не зазор.
    borderRightWidth: 1,
    borderRightColor: colors.background.screen,
  },
  selectorRight: {
    borderTopRightRadius: radius.pill,
    borderBottomRightRadius: radius.pill,
  },
  selectorValue: {
    ...typography.labelMedium,
    color: colors.text.primary,
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
