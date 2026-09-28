import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CheckCircle } from "../../../src/components/icons";
import { PhotoView } from "../../../src/components/PhotoView";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { RouteSheet } from "../../../src/components/booking/RouteSheet";
import { LoadingState } from "../../../src/components/StateViews";
import { useBooking, useMenuSections, usePreorder } from "../../../src/hooks/useBooking";
import { formatMoneyMinor } from "../../../src/lib/format";

const t = getDictionary();

/** Диаметр кружка-иконки — Figma 5390:8698/8773 («Success»); цвет — существующая
 * пара `status.positiveText`/`positiveSurface`. */
const ICON_SIZE = 64;
const PHOTO_SIZE = 72;

/**
 * Шторка «Предзаказ оплачен» — Figma узел 5390:8698. Приходит сюда ТОЛЬКО из
 * `payment.tsx` через `router.replace`, когда `useKaspiPaymentFlow` сообщил
 * `phase === "paid"`. Строки блюд: название, описание (2 строки), цена —
 * слева; справа фото с круглым бейджем количества. Фото и описание
 * `PreorderLine` не несёт — берутся из меню заведения по `menuItemId`; пока
 * меню грузится или не загрузилось, строка честно рисуется без описания и с
 * нейтральной плашкой «нет фото» (меню не должно ломать чек).
 */
export default function PaymentSuccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const booking = useBooking(id);
  const preorder = usePreorder(id);
  const menu = useMenuSections(booking.data?.restaurantId);

  const dishById = React.useMemo(() => {
    const map = new Map<string, { description: string; imageUrl: string | null }>();
    for (const section of menu.data ?? []) {
      for (const dish of section.dishes) {
        map.set(dish.id, { description: dish.description, imageUrl: dish.imageUrl });
      }
    }
    return map;
  }, [menu.data]);

  const goToBooking = React.useCallback(() => {
    router.replace({ pathname: "/booking/[id]", params: { id: id ?? "" } });
  }, [router, id]);

  if (booking.isPending || preorder.isPending) {
    return (
      <RouteSheet onClose={goToBooking} closeLabel={t.common.close}>
        <View style={styles.loading}>
          <LoadingState title={t.booking.bookingLoading} />
        </View>
      </RouteSheet>
    );
  }

  return (
    <RouteSheet
      onClose={goToBooking}
      closeLabel={t.common.close}
      footer={<PrimaryButton label={t.booking.paymentSuccessAction} size="lg" onPress={goToBooking} />}
    >
      <View style={styles.header}>
        <View style={styles.iconCircle} accessibilityElementsHidden>
          <CheckCircle size={40} color={colors.status.positiveText} weight="fill" />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {t.booking.paymentPaidTitle}
        </Text>
        <Text style={styles.subtitle}>{t.booking.paymentSuccessSubtitle}</Text>
      </View>

      {(preorder.data?.items ?? []).map((item) => {
        const dish = item.menuItemId ? dishById.get(item.menuItemId) : undefined;
        const description = dish?.description.trim();
        return (
          <View key={item.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowName} numberOfLines={2}>
                {item.name}
              </Text>
              {description ? (
                <Text style={styles.rowDescription} numberOfLines={2}>
                  {description}
                </Text>
              ) : null}
              <Text style={styles.rowPrice}>{formatMoneyMinor(item.totalMinor)}</Text>
            </View>
            <View style={styles.photoWrap}>
              <PhotoView
                uri={dish?.imageUrl}
                style={styles.photo}
                size="tile"
                decorative
                placeholderIconSize={24}
              />
              <View style={styles.badge} accessibilityLabel={`× ${item.quantity}`}>
                <Text style={styles.badgeText}>{item.quantity}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </RouteSheet>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 240,
  },
  header: {
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    backgroundColor: colors.status.positiveSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.titleLg,
    color: colors.text.primary,
    textAlign: "center",
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  rowName: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
  },
  rowDescription: {
    ...typography.caption,
    color: colors.text.muted,
  },
  rowPrice: {
    ...typography.body,
    color: colors.text.primary,
  },
  photoWrap: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: radius.card,
  },
  badge: {
    position: "absolute",
    right: spacing.xs,
    bottom: spacing.xs,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: spacing.xs,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    ...typography.caption,
    color: colors.text.onDark,
  },
});
