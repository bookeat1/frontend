import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMoneyMinor } from "../../lib/format";
import type { DishCardItem } from "../../lib/dish-card";
import { useSheetAnimation } from "../../lib/sheet-animation";
import { Minus, Plus, X } from "../icons";
import { PhotoView } from "../PhotoView";

const t = getDictionary();

/**
 * Карточка блюда — нижняя шторка (Figma: карточка блюда, выезжающая снизу).
 *
 * Открывается по тапу по строке меню и по карточке в ленте «Популярное в
 * меню». Показывает фото, название, ПОЛНОЕ описание, цену и — когда блюда
 * сейчас нет — честную пометку об этом. Смысл карточки именно в описании: в
 * ленте и в строке меню оно обрезано на второй-третьей строке («Нежный
 * запеченный баклажан с прохладным в…»), и прочитать его целиком было негде.
 * Поэтому текст лежит в ScrollView, а сама шторка ограничена по высоте: длинное
 * описание прокручивается внутри карточки, а не обрезается второй раз.
 *
 * Фото есть далеко не у всех блюд (на бою 2026-08-24 — у 811 из 2376). Блюдо
 * без фото рисуется БЕЗ пустой плашки на пол-экрана: карточка просто начинается
 * с названия. Плашка «фото нет» размером с фотографию читалась бы как
 * незагрузившаяся картинка, а не как осознанное «фотографии нет» — на маленькой
 * плитке в ленте она уместна, на 220 точках в шторке уже нет.
 *
 * Действие («Добавить · N ₸» со счётчиком количества) появляется ТОЛЬКО там,
 * где предзаказ реально можно набрать и где известна цена числом, — это экран
 * меню заведения. В ленте «Популярное в меню» внутри флоу брони карточка
 * читательская: цена там приходит уже готовой строкой, считать «цена ×
 * количество» не из чего, а предзаказ в этом флоу набирается отдельным экраном
 * с полным меню и итогом. Кнопка, которая иногда невозможна, хуже, чем её
 * отсутствие.
 */
export function DishDetailSheet({
  dish,
  canAdd,
  onAdd,
  onClose,
}: {
  /** Блюдо, которое показываем, или null — шторка закрыта. */
  dish: DishCardItem | null;
  /**
   * Можно ли добавить это блюдо в предзаказ (заведение принимает онлайн-бронь,
   * блюдо в наличии и у него есть цена ЧИСЛОМ). false — карточка только для
   * чтения, без счётчика и без кнопки.
   */
  canAdd: boolean;
  /** Кладёт `quantity` штук блюда в предзаказ. Не зовётся при `canAdd={false}`. */
  onAdd: (quantity: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const visible = dish !== null;
  const { mounted, progress, translateY } = useSheetAnimation(visible);
  const [quantity, setQuantity] = useState(1);

  // Последнее показанное блюдо. Закрытие анимируется ~200 мс, а `dish`
  // становится null в первый же кадр — без этой памяти панель на время
  // отъезда опустела бы, и вместо «карточка уехала вниз» гость видел бы
  // «карточка мигнула пустотой и уехала».
  const lastDish = useRef<DishCardItem | null>(dish);
  if (dish !== null) lastDish.current = dish;
  const shown = dish ?? lastDish.current;

  // Открыли новое блюдо — счётчик начинается с единицы, а не с остатка от
  // прошлого. Зависимость по ИДЕНТИФИКАТОРУ, а не по объекту: экран меню
  // собирает `DishCardItem` на лету, и на объекте счётчик сбрасывался бы на
  // каждом перерисовывании, то есть кнопкой «+» нельзя было бы досчитать до
  // двух.
  const openedDishId = dish?.id ?? null;
  useEffect(() => {
    if (openedDishId !== null) setQuantity(1);
  }, [openedDishId]);

  // Пока шторка доигрывает закрытие, `dish` уже null, а панель ещё в дереве —
  // рисовать в ней нечего.
  if (!mounted || !shown) return null;

  const totalMinor = shown.priceMinor != null ? shown.priceMinor * quantity : null;
  const addLabel = t.restaurant.menuDishAddPrice(
    totalMinor != null ? formatMoneyMinor(totalMinor) : "",
  );

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            // Кнопка и хвост описания не должны уезжать под системную полосу.
            { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] },
          ]}
          accessibilityViewIsModal
          testID="dish-card-sheet"
        >
          {/* Крестик стоит в собственной строке, а не поверх фотографии: у
              блюда без фото ему было бы не на чем лежать, а у блюда с тёмным
              фото он терялся. */}
          <View style={styles.header}>
            <View style={styles.grabber} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.a11y.closeButton}
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <X size={20} color={colors.text.primary} weight="bold" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            // Длинное описание — единственная причина, по которой карточка
            // вообще открывается: оно должно доскролливаться до конца.
            bounces={false}
          >
            {shown.imageUrl ? (
              <PhotoView
                uri={shown.imageUrl}
                style={styles.image}
                decorative
              />
            ) : null}

            <Text style={styles.name}>{shown.name}</Text>
            {shown.description ? <Text style={styles.description}>{shown.description}</Text> : null}
            <Text style={styles.price}>
              {shown.priceLabel === null ? t.restaurant.menuDishNoPrice : shown.priceLabel}
            </Text>
            {!shown.isAvailable ? (
              <Text style={styles.unavailable}>{t.restaurant.menuDishUnavailable}</Text>
            ) : null}
          </ScrollView>

          {/* Действие живёт ВНЕ прокрутки: до него нельзя «не долистать». */}
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
                accessibilityLabel={addLabel}
                onPress={() => onAdd(quantity)}
                style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              >
                <Text style={styles.addLabel}>{addLabel}</Text>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
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
    // Потолок высоты — иначе блюдо с длинным описанием растянуло бы шторку на
    // весь экран и она перестала бы читаться как карточка поверх него.
    maxHeight: "85%",
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: radius.dialog,
    borderTopRightRadius: radius.dialog,
    overflow: "hidden",
  },
  header: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: "center",
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.control,
  },
  closeButton: {
    position: "absolute",
    right: spacing.md,
    top: spacing.xs,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.chip,
  },
  // flexShrink, а не flex:1 — короткая карточка остаётся низкой, длинная
  // упирается в потолок высоты и дальше прокручивается.
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  image: {
    width: "100%",
    height: 220,
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
    marginBottom: spacing.xs,
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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
