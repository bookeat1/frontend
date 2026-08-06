import type { MenuDish } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { formatMoneyMinor } from "../../lib/format";
import { Minus, Plus, X } from "../icons";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * The dish detail sheet (Figma: dish card that slides up from the bottom).
 *
 * Opens on a tap anywhere on a menu row. Shows the dish photo, name,
 * description and price; when the dish can actually be pre-ordered it also
 * carries a quantity stepper and an «Добавить · {total}» button that seeds the
 * booking pre-order with the chosen quantity. A dish that cannot be added (the
 * venue takes no online bookings, the dish is on the stop-list, or it has no
 * price) still opens for reading — the sheet just drops the add controls and
 * shows the same honest note the row does, rather than offering an action that
 * would dead-end.
 */
export function DishDetailSheet({
  dish,
  canAdd,
  onAdd,
  onClose,
}: {
  /** The dish to show, or null when the sheet is closed. */
  dish: MenuDish | null;
  /** Whether this dish can be added to a pre-order (venue + availability + price). */
  canAdd: boolean;
  /** Adds `quantity` of the dish to the pre-order and starts the booking flow. */
  onAdd: (quantity: number) => void;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(1);

  // Every time a new dish opens, start its counter fresh at 1.
  useEffect(() => {
    if (dish) setQuantity(1);
  }, [dish]);

  const visible = dish !== null;
  const totalMinor = dish?.priceMinor != null ? dish.priceMinor * quantity : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />

        {dish ? (
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.media}>
              <PhotoView uri={dish.imageUrl} style={styles.image} decorative placeholderIconSize={40} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.a11y.closeButton}
                onPress={onClose}
                style={styles.closeButton}
              >
                <X size={20} color={colors.text.primary} weight="bold" />
              </Pressable>
            </View>

            <View style={styles.body}>
              <Text style={styles.name}>{dish.name}</Text>
              {dish.description ? (
                <Text style={styles.description}>{dish.description}</Text>
              ) : null}
              <Text style={styles.price}>
                {dish.priceMinor === null
                  ? t.restaurant.menuDishNoPrice
                  : formatMoneyMinor(dish.priceMinor)}
              </Text>

              {!dish.isAvailable ? (
                <Text style={styles.unavailable}>{t.restaurant.menuDishUnavailable}</Text>
              ) : null}

              {canAdd ? (
                <View style={styles.actionRow}>
                  <View style={styles.stepper}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t.restaurant.menuDishQtyLess}
                      onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                      hitSlop={8}
                      style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
                    >
                      <Minus size={18} color={colors.text.primary} weight="bold" />
                    </Pressable>
                    <Text style={styles.quantity}>{quantity}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t.restaurant.menuDishQtyMore}
                      onPress={() => setQuantity((q) => q + 1)}
                      hitSlop={8}
                      style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
                    >
                      <Plus size={18} color={colors.text.primary} weight="bold" />
                    </Pressable>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t.restaurant.menuDishAddPrice(
                      totalMinor != null ? formatMoneyMinor(totalMinor) : "",
                    )}
                    onPress={() => onAdd(quantity)}
                    style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.addLabel}>
                      {t.restaurant.menuDishAddPrice(
                        totalMinor != null ? formatMoneyMinor(totalMinor) : "",
                      )}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    backgroundColor: colors.overlay.dialogScrim,
  },
  sheet: {
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: radius.dialog,
    borderTopRightRadius: radius.dialog,
    paddingBottom: spacing.xxl,
    overflow: "hidden",
  },
  media: {
    margin: spacing.md,
    marginBottom: 0,
  },
  image: {
    width: "100%",
    height: 220,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
  closeButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.surface,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  name: {
    ...typography.titleXl,
    color: colors.text.primary,
  },
  description: {
    ...typography.body,
    color: colors.text.muted,
  },
  price: {
    ...typography.titleCard,
    color: colors.text.strong,
    marginTop: spacing.xs,
  },
  unavailable: {
    ...typography.caption,
    color: colors.text.muted,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border.control,
  },
  stepButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  quantity: {
    ...typography.labelSemiBold,
    color: colors.text.primary,
    minWidth: 20,
    textAlign: "center",
  },
  addButton: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  addLabel: {
    ...typography.labelSemiBold,
    color: colors.text.onBrand,
  },
  pressed: {
    opacity: 0.85,
  },
});
