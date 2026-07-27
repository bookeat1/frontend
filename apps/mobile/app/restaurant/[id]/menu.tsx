import type { MenuDish } from "@bookeat/api";
import { colors, controlHeight, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlowHeader } from "../../../src/components/FlowHeader";
import { PhotoView } from "../../../src/components/PhotoView";
import { EmptyState, ErrorState, LoadingState } from "../../../src/components/StateViews";
import { useMenuSections } from "../../../src/hooks/useBooking";
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

  const renderItem = useCallback(({ item }: { item: MenuDish }) => <DishRow dish={item} />, []);

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
        <SectionList
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
          // Меню живого заведения — до ~300 блюд: список остаётся оконным.
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

/**
 * Одно блюдо. Блюдо из стоп-листа показываем с пометкой, а не прячем: гость,
 * увидевший его на экране заведения и не нашедший в меню, решит, что приложение
 * потеряло данные. Фото у живых блюд нет ни у одного — вместо картинки
 * осознанная плашка, как в ленте «Из меню».
 */
const DishRow = React.memo(function DishRow({ dish }: { dish: MenuDish }) {
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
  },
  dishImage: {
    width: "100%",
    height: "100%",
    borderRadius: radius.card,
    backgroundColor: colors.background.chip,
  },
});
