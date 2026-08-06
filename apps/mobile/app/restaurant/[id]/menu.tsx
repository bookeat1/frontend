import type { MenuDish } from "@bookeat/api";
import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from "react-native";
import type { SectionListData, ViewToken } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../../src/components/FlowHeader";
import { Plus } from "../../../src/components/icons";
import { PhotoView } from "../../../src/components/PhotoView";
import { EmptyState, ErrorState, LoadingState } from "../../../src/components/StateViews";
import { useMenuSections } from "../../../src/hooks/useBooking";
import { useRestaurant } from "../../../src/hooks/useRestaurant";
import { formatMoneyMinor } from "../../../src/lib/format";

const t = getDictionary();

interface Section {
  title: string;
  data: MenuDish[];
}

/**
 * Меню заведения — только чтение.
 *
 * Появился потому, что до сих пор меню можно было увидеть ТОЛЬКО внутри флоу
 * бронирования (`book/menu.tsx`), а кнопка «Посмотреть меню» на экране
 * заведения была отключена: у «Abay» с 200 блюдами меню было недостижимо.
 * Отдельный экран, а не переиспользование того же: тот держит корзину
 * предзаказа в черновике брони, и набранная здесь корзина молча пропала бы.
 *
 * Тот же `useMenuSections`, что и в предзаказе, значит тот же кэш
 * (`["menu-sections", id]`) — открыть меню, вернуться и пойти бронировать
 * стоит одного запроса, а не двух.
 */
export default function RestaurantMenuScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const menu = useMenuSections(id);
  const { data: restaurant } = useRestaurant(id);

  // «+» ведёт в бронь с этим блюдом в предзаказе (макет 918:11820). У заведения
  // без онлайн-брони кнопки нет: она увела бы в тупик — экран брони таких сразу
  // разворачивает на телефон.
  const canPreorder = restaurant?.acceptsOnlineBookings ?? false;

  const sections = useMemo<Section[]>(
    () =>
      (menu.data ?? [])
        .map((section) => ({
          title: section.title || t.restaurant.menuOtherSection,
          data: section.dishes,
        }))
        .filter((section) => section.data.length > 0),
    [menu.data],
  );

  // Заводит флоу брони с блюдом как первой позицией предзаказа. Данные едут
  // параметрами (id/имя/цена уже на карточке) — их подхватывает book/_layout и
  // кладёт в черновик. Цена только для клиентской оценки, серверу не уходит.
  const addToPreorder = useCallback(
    (dish: MenuDish) => {
      router.push({
        pathname: "/restaurant/[id]/book",
        params: {
          id: id ?? "",
          addItemId: dish.id,
          addItemName: dish.name,
          ...(dish.priceMinor !== null ? { addItemPrice: String(dish.priceMinor) } : {}),
        },
      });
    },
    [id, router],
  );

  const renderItem = useCallback(
    ({ item }: { item: MenuDish }) => (
      <DishRow dish={item} onAdd={canPreorder ? () => addToPreorder(item) : undefined} />
    ),
    [addToPreorder, canPreorder],
  );

  // Липкая строка категорий над списком (Мангал · Холодные закуски · …): она
  // подсвечивает раздел, который сейчас вверху списка, и по тапу проматывает к
  // нему. Раздел определяется по самому верхнему видимому элементу списка.
  const listRef = useRef<SectionList<MenuDish, Section>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // sections пересобирается по данным — держим ссылку, чтобы стабильный колбэк
  // видимости всегда сверялся со свежим списком, а не с замыканием на старом.
  const sectionsRef = useRef<Section[]>(sections);
  sectionsRef.current = sections;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 1 }).current;
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const top = viewableItems.find((v) => v.section);
    if (!top?.section) return;
    const title = (top.section as SectionListData<MenuDish, Section>).title;
    const idx = sectionsRef.current.findIndex((s) => s.title === title);
    if (idx >= 0) setActiveIndex(idx);
  }).current;

  // Целевой раздел для промотки: если scrollToLocation срывается на ещё не
  // отрисованном разделе (onScrollToIndexFailed), список подтягивает строки к
  // нему и мы повторяем попытку по этому же индексу.
  const pendingSectionRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const jumpToSection = useCallback((index: number) => {
    setActiveIndex(index);
    pendingSectionRef.current = index;
    retryCountRef.current = 0;
    // itemIndex:0 наводит на заголовок раздела; viewOffset прижимает его под
    // строку категорий, а не под системный статус-бар.
    listRef.current?.scrollToLocation({ sectionIndex: index, itemIndex: 0, viewOffset: 0, animated: true });
  }, []);
  const retryJump = useCallback(() => {
    const index = pendingSectionRef.current;
    if (index === null) return;
    // Дальний раздел ещё не отрисован → scrollToLocation срывается. Даём списку
    // ~130мс домонтировать строки к цели и повторяем; так до 12 раз, чтобы даже
    // самая нижняя категория гарантированно долистывалась и не оставляла
    // подсветку рассинхронной с содержимым. requestAnimationFrame был слишком
    // быстрым — список не успевал отрисоваться между попытками.
    if (retryCountRef.current >= 12) return;
    retryCountRef.current += 1;
    setTimeout(() => {
      listRef.current?.scrollToLocation({ sectionIndex: index, itemIndex: 0, viewOffset: 0, animated: false });
    }, 130);
  }, []);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <FlowHeader title={t.restaurant.menuTitle} onBack={() => router.back()} />
      </SafeAreaView>

      {menu.isPending ? (
        <LoadingState title={t.restaurant.menuLoading} />
      ) : menu.isError ? (
        <ErrorState
          title={t.restaurant.menuErrorTitle}
          description={t.search.errorDescription}
          retryLabel={t.common.retry}
          onRetry={() => void menu.refetch()}
        />
      ) : sections.length === 0 ? (
        <EmptyState title={t.restaurant.menuEmpty} description={t.restaurant.menuPreorderNote} />
      ) : (
        <>
          <CategoryBar
            titles={sections.map((s) => s.title)}
            activeIndex={activeIndex}
            onSelect={jumpToSection}
          />
          <SectionList
            ref={listRef}
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionHeader}>{section.title}</Text>
            )}
            renderSectionFooter={() => <View style={styles.sectionFooter} />}
            ListFooterComponent={<Text style={styles.footerNote}>{t.restaurant.menuPreorderNote}</Text>}
            stickySectionHeadersEnabled
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewable}
            viewabilityConfig={viewabilityConfig}
            // Промотка к разделу без getItemLayout не долетает с первого раза на
            // неизмеренных строках — SectionList подтягивает строки к цели, а мы
            // повторяем прыжок по сохранённому индексу (см. retryJump).
            onScrollToIndexFailed={retryJump}
            // Меню живого заведения — до ~300 блюд: список остаётся оконным.
            initialNumToRender={12}
            windowSize={7}
            removeClippedSubviews
          />
        </>
      )}
    </View>
  );
}

/**
 * Липкая горизонтальная строка категорий над меню. Активный чип подсвечен и
 * подтягивается в видимую область, чтобы при длинном списке категорий текущая
 * не пряталась за краем. По тапу — проматывает список к разделу.
 */
function CategoryBar({
  titles,
  activeIndex,
  onSelect,
}: {
  titles: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  // Позиция каждого чипа по X — чтобы domкрутить активный в область видимости.
  const offsets = useRef<number[]>([]);

  const centerActive = useCallback(() => {
    const x = offsets.current[activeIndex];
    if (x !== undefined) scrollRef.current?.scrollTo({ x: Math.max(0, x - spacing.lg), animated: true });
  }, [activeIndex]);

  // Прокрутка меню меняет активную категорию — подтягиваем её чип в вид.
  useEffect(() => {
    centerActive();
  }, [centerActive]);

  return (
    <View style={styles.categoryBar}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.categoryBarContent}
      >
        {titles.map((title, index) => {
          const active = index === activeIndex;
          return (
            <Pressable
              key={`${title}-${index}`}
              onLayout={(e) => {
                offsets.current[index] = e.nativeEvent.layout.x;
                if (active) centerActive();
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(index)}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
            >
              <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]} numberOfLines={1}>
                {title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * Одно блюдо. Блюдо из стоп-листа показываем с пометкой, а не прячем: гость,
 * увидевший его на экране заведения и не нашедший в меню, решит, что приложение
 * потеряло данные. Фото у живых блюд нет ни у одного — вместо картинки
 * осознанная плашка, как в ленте «Из меню».
 */
const DishRow = React.memo(function DishRow({
  dish,
  onAdd,
}: {
  dish: MenuDish;
  /** Есть только когда заведение принимает онлайн-бронь; блюдо из стоп-листа
   * или без цены добавить всё равно нельзя — заказать его заранее не выйдет. */
  onAdd?: () => void;
}) {
  const addable = onAdd && dish.isAvailable && dish.priceMinor !== null;
  return (
    <View style={styles.dish}>
      <View style={styles.dishText}>
        <Text style={[styles.dishName, !dish.isAvailable && styles.dishMuted]} numberOfLines={2}>
          {dish.name}
        </Text>
        {dish.description ? (
          <Text style={styles.dishDescription} numberOfLines={3}>
            {dish.description}
          </Text>
        ) : null}
        <Text style={[styles.dishPrice, !dish.isAvailable && styles.dishMuted]}>
          {dish.priceMinor === null
            ? t.restaurant.menuDishNoPrice
            : formatMoneyMinor(dish.priceMinor)}
        </Text>
        {!dish.isAvailable ? (
          <Text style={styles.dishUnavailable}>{t.restaurant.menuDishUnavailable}</Text>
        ) : null}
      </View>

      <View style={styles.dishPhoto}>
        {/* Та же плашка, что и на карточке блюда, — одна на всё приложение. */}
        <PhotoView uri={dish.imageUrl} style={styles.dishImage} decorative placeholderIconSize={24} />
        {/* Белый кружок с плюсом на нижнем крае фото (макет 918:11849). 32pt
            видимого круга + 8 hitSlop перекрывают правило 44pt. */}
        {addable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t.booking.dishAdd}: ${dish.name}`}
            onPress={onAdd}
            hitSlop={8}
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          >
            <Plus size={20} color={colors.text.primary} weight="bold" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.screen,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  listContent: {
    paddingBottom: spacing.xxxl,
  },
  categoryBar: {
    backgroundColor: colors.background.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  categoryBarContent: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.background.chip,
  },
  categoryChipActive: {
    backgroundColor: colors.brand.primary,
  },
  categoryChipText: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  categoryChipTextActive: {
    color: colors.text.onDark,
  },
  sectionHeader: {
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
  footerNote: {
    ...typography.caption,
    color: colors.text.muted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  dish: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.background.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  // flex:1 — длинные русские названия переносятся, а не выдавливают плашку с
  // фото за край 360-пиксельного экрана.
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
  dishMuted: {
    color: colors.text.muted,
  },
  dishUnavailable: {
    ...typography.caption,
    color: colors.text.muted,
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
  // Тот же «+», что и на экране предзаказа (book/menu.tsx): белый круг с тенью
  // на нижнем крае фото.
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
  addButtonPressed: {
    opacity: 0.7,
  },
});
