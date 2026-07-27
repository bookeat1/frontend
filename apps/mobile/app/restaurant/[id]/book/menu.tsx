import type { MenuDish } from "@bookeat/api";
import { colors, controlHeight, hitSlop, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../../../src/components/FlowHeader";
import { Minus, Plus } from "../../../../src/components/icons";
import { PhotoView } from "../../../../src/components/PhotoView";
import { PrimaryButton } from "../../../../src/components/PrimaryButton";
import { EmptyState, ErrorState, LoadingState } from "../../../../src/components/StateViews";
import { useMenuSections } from "../../../../src/hooks/useBooking";
import { estimatePreorderTotalMinor, useBookingDraft } from "../../../../src/lib/booking-draft";
import { formatMoneyMinor } from "../../../../src/lib/format";

const t = getDictionary();

interface Section {
  title: string;
  data: MenuDish[];
}

/**
 * Pre-order: pick dishes before arriving.
 *
 * A real venue's menu is ~300 dishes across ~30 categories, so this is a
 * SectionList (windowed) and never a ScrollView with 300 children — the
 * latter mounts every row on open and janks badly on a mid-range Android.
 *
 * Nothing is sent from here. The cart lives in the booking draft and is
 * attached AFTER the booking exists, because `PUT /bookings/:id/preorder` is
 * booking-scoped. That endpoint also prices every line from the venue's own
 * menu, so the totals on this screen are explicitly labelled an estimate.
 */
export default function PreorderMenuScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const draft = useBookingDraft();
  const menu = useMenuSections(id);

  const quantities = useMemo(
    () => new Map(draft.preorder.map((line) => [line.menuItemId, line.quantity])),
    [draft.preorder],
  );

  const sections = useMemo<Section[]>(
    () =>
      (menu.data ?? [])
        .map((section) => ({
          title: section.title || t.booking.preorderOther,
          data: section.dishes,
        }))
        .filter((section) => section.data.length > 0),
    [menu.data],
  );

  const total = estimatePreorderTotalMinor(draft.preorder);
  const count = draft.preorder.reduce((sum, line) => sum + line.quantity, 0);

  const setQuantity = useCallback(
    (dish: MenuDish, quantity: number) => {
      draft.setPreorderQuantity(
        { menuItemId: dish.id, name: dish.name, priceMinor: dish.priceMinor },
        quantity,
      );
    },
    [draft],
  );

  const renderItem = useCallback(
    ({ item }: { item: MenuDish }) => (
      <DishRow
        dish={item}
        quantity={quantities.get(item.id) ?? 0}
        onChange={(quantity) => setQuantity(item, quantity)}
      />
    ),
    [quantities, setQuantity],
  );

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader
          title={t.booking.preorderTitle}
          onBack={() => router.back()}
          trailing={
            count > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.booking.preorderClear}
                onPress={draft.clearPreorder}
                style={styles.clearButton}
              >
                <Text style={styles.clearLabel}>{t.booking.preorderClear}</Text>
              </Pressable>
            ) : undefined
          }
        />
      </SafeAreaView>

      {menu.isPending ? (
        <LoadingState title={t.booking.preorderLoading} />
      ) : menu.isError ? (
        <ErrorState
          title={t.booking.preorderErrorTitle}
          description={t.search.errorDescription}
          retryLabel={t.common.retry}
          onRetry={() => void menu.refetch()}
        />
      ) : sections.length === 0 ? (
        <EmptyState
          title={t.booking.preorderEmptyTitle}
          description={t.booking.preorderEmptyDescription}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          // Each category is a white card on the grey screen (see the design
          // render): the header carries the top corners, this footer the bottom
          // ones plus the 8pt gap to the next card.
          renderSectionFooter={() => <View style={styles.sectionFooter} />}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          // Keeps memory bounded on a 300-item menu; the row height varies
          // (two-line names), so no getItemLayout — measuring wrongly is worse
          // than letting the list measure itself.
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews
        />
      )}

      <SafeAreaView edges={["bottom"]} style={styles.footerSafeArea}>
        <View style={styles.footer}>
          {count > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t.booking.preorderTotalEstimate}</Text>
              <Text style={styles.totalValue}>
                {total === undefined ? t.booking.preorderNoPrice : formatMoneyMinor(total)}
              </Text>
            </View>
          ) : null}
          <PrimaryButton size="lg" label={t.booking.preorderDone} onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * One dish. An unavailable dish (venue stop list) and an unpriced one are
 * both shown but not addable — hiding them would make a guest who saw the
 * dish on the venue screen think the app lost it.
 */
const DishRow = React.memo(function DishRow({
  dish,
  quantity,
  onChange,
}: {
  dish: MenuDish;
  quantity: number;
  onChange: (quantity: number) => void;
}) {
  const addable = dish.isAvailable && dish.priceMinor !== null;
  return (
    <View style={styles.dish}>
      <View style={styles.dishText}>
        <Text style={styles.dishName} numberOfLines={2}>
          {dish.name}
        </Text>
        {dish.description ? (
          <Text style={styles.dishDescription} numberOfLines={2}>
            {dish.description}
          </Text>
        ) : null}
        <Text style={styles.dishPrice}>
          {dish.priceMinor === null
            ? t.booking.preorderNoPrice
            : formatMoneyMinor(dish.priceMinor)}
        </Text>
        {!dish.isAvailable ? (
          <Text style={styles.dishUnavailable}>{t.booking.preorderUnavailable}</Text>
        ) : null}
      </View>

      {/* Photo on the right with the add / quantity control floating over its
          lower edge, as in the design render. */}
      <View style={styles.dishPhoto}>
        <PhotoView uri={dish.imageUrl} style={styles.dishImage} decorative placeholderIconSize={24} />

        {addable ? (
          quantity > 0 ? (
            <View style={styles.quantityControl}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.booking.dishRemove}: ${dish.name}`}
                onPress={() => onChange(quantity - 1)}
                hitSlop={8}
                style={styles.quantityButton}
              >
                <Minus size={18} color={colors.text.primary} weight="bold" />
              </Pressable>
              <Text style={styles.quantityValue}>{quantity}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.booking.dishAdd}: ${dish.name}`}
                onPress={() => onChange(quantity + 1)}
                hitSlop={8}
                style={styles.quantityButton}
              >
                <Plus size={18} color={colors.text.primary} weight="bold" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t.booking.dishAdd}: ${dish.name}`}
              onPress={() => onChange(1)}
              hitSlop={8}
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            >
              <Plus size={20} color={colors.text.primary} weight="bold" />
            </Pressable>
          )
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Grey behind the per-category white cards.
    backgroundColor: colors.background.screen,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  clearButton: {
    minHeight: hitSlop.minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  clearLabel: {
    ...typography.labelMedium,
    color: colors.brand.primary,
  },
  listContent: {
    paddingBottom: spacing.xxxl,
  },
  sectionHeader: {
    // Category name is the big bold title in the design, not the 16pt one.
    ...typography.titleLg,
    color: colors.text.primary,
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  sectionFooter: {
    height: spacing.lg,
    backgroundColor: colors.background.surface,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    marginBottom: spacing.sm,
  },
  dish: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.background.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  dishPhoto: {
    width: controlHeight.dishPhotoWidth,
    height: controlHeight.dishPhotoHeight,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  dishImage: {
    width: "100%",
    height: "100%",
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  // flex:1 is what makes long Russian dish names wrap instead of pushing the
  // add button off a 360px screen.
  dishText: {
    flex: 1,
    gap: spacing.xxs,
  },
  dishName: {
    ...typography.itemName,
    color: colors.text.strong,
  },
  dishDescription: {
    ...typography.caption,
    color: colors.text.muted,
  },
  dishPrice: {
    ...typography.labelSemiBold,
    color: colors.text.strong,
  },
  dishUnavailable: {
    ...typography.caption,
    color: colors.brand.primary,
  },
  // White circle with a dark plus sitting on the photo (design render), not a
  // red circle beside the text. 32pt of visible circle + 8 of hitSlop clears
  // the 44pt touch-target rule.
  addButton: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.sm,
    width: spacing.xxxl,
    height: spacing.xxxl,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.surface,
    shadowColor: colors.overlay.footerShadow,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  pressed: {
    opacity: 0.7,
  },
  quantityControl: {
    position: "absolute",
    bottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.background.surface,
    shadowColor: colors.overlay.footerShadow,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  quantityButton: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityValue: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
    minWidth: 20,
    textAlign: "center",
  },
  footerSafeArea: {
    backgroundColor: colors.background.surface,
    shadowColor: colors.overlay.footerShadow,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 16,
    elevation: 8,
  },
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  totalValue: {
    ...typography.titleMd,
    color: colors.text.primary,
  },
});
