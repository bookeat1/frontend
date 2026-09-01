import { brandPageLayout, colors, spacing } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { RefreshControl, ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import { OceanClosingSection } from "./OceanClosingSection";
import { OceanDishesSection } from "./OceanDishesSection";
import { OceanHero } from "./OceanHero";
import { OceanMapSection } from "./OceanMapSection";
import { OceanPointsSection } from "./OceanPointsSection";
import { OceanStorySection } from "./OceanStorySection";
import { useOceanBasketVenues } from "./use-ocean-basket-venues";

const t = getDictionary();

/**
 * ФИРМЕННАЯ СТРАНИЦА OCEAN BASKET — макет 3z0f6dgev4HMwBAHPjTjPo,
 * node 3424:3927 («Ocean Basket / Mobile / 390»), маршрут `/brand/ocean-basket`.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ЭКРАН, А НЕ ПРАВКА `GuideCollectionScreen`. Тот экран
 * обслуживает ЛЮБУЮ подборку гастрогида и любую статью: он рисует ровно то,
 * что отдаёт ручка (`title`, `subtitle`, `description`, обложка, заведения).
 * Здесь же три четверти содержимого — фирменное и зашитое: графика шапки,
 * блюда с ценами, главы истории, блок инстаграма. Уместить это в общий экран
 * значило бы либо показывать пустые блоки всем остальным подборкам, либо
 * завести в общем экране ветку «если слаг ocean-basket» — то есть спрятать
 * второй экран внутри первого. Поэтому экран отдельный, а общий путь не
 * тронут ни строкой.
 *
 * ЧТО ЗДЕСЬ ЖИВОЕ. Ровно одно: карточки точек и переход с них на экран
 * заведения (`GET /restaurants/search?q=Ocean Basket`, см.
 * `useOceanBasketVenues`). Всё остальное — вёрстка по макету и словарь.
 *
 * ЧЕТЫРЕ СОСТОЯНИЯ есть у той самой одной секции — «Все точки»
 * (`OceanPointsSection`). У страницы целиком их нет и быть не может: она
 * лежит в сборке и рисуется без сети.
 *
 * ГДЕ КОД РАСХОДИТСЯ С МАКЕТОМ (полный список, каждый пункт с причиной):
 *
 *   • НЕТ строки «Тапните блюдо — оформим предзаказ к столу» (node
 *     3441:12382) и блюда не нажимаются: у зашитого блюда нет
 *     `menu_item_id`, а предзаказ в приложении начинается с брони заведения.
 *     Обещание, которого не выполнить, хуже отсутствующей строки.
 *   • НЕТ сердечка в шапке (node 3427:12227): избранное на бэкенде знает
 *     заведения, события и акции, но не страницы бренда.
 *   • Плашка «WELCOME DRINK» НИЧЕГО НЕ ДЕЛАЕТ, «Подробнее» у неё нет, а
 *     значка акции нет на карточках точек (узлы 3425:3942 и 3441:12296):
 *     решение владельца 2026-09-01 — «оставляй её картинкой без обещания».
 *     Акции welcome drink нет в данных, у брони нет признака напитка,
 *     заведение о ней не знает и ничего за неё не получает.
 *   • Кнопка «Забронировать» ПРОКРУЧИВАЕТ к списку точек: бронировать вместо
 *     гостя одну из трёх точек страница не вправе.
 *   • Раскрываются НЕ ВСЕ главы истории — только те, у которых в макете
 *     написан текст (первая). Разбор — в `OceanStorySection`.
 *   • Внутренние блоки макета нарисованы шириной 350 и 364 при листе 358
 *     (то есть с полями 16 слева и 24 справа) — это разъезд самого макета;
 *     в коде все блоки идут по колонке листа, поля 16 с обеих сторон.
 */
export function OceanBasketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const query = useOceanBasketVenues();
  const { refreshing, onRefresh } = usePullToRefresh(() => query.refetch());

  const scrollRef = useRef<ScrollView>(null);
  // Куда прокручивать по «Забронировать». Меряется разметкой, а не считается
  // по числам макета: высота шапки зависит от безопасной зоны, а высота
  // карты — от ширины экрана.
  const [pointsOffset, setPointsOffset] = useState<number | null>(null);

  const openVenue = useCallback(
    (restaurantId: string) => router.push(`/restaurant/${restaurantId}`),
    [router],
  );

  const scrollToPoints = useCallback(() => {
    if (pointsOffset === null) return;
    scrollRef.current?.scrollTo({ y: Math.max(pointsOffset - spacing.lg, 0), animated: true });
  }, [pointsOffset]);

  const share = useCallback(async () => {
    try {
      await Share.share({ message: `Ocean Basket — ${t.explore.articleAuthorDefault}` });
    } catch {
      // Гость закрыл шторку или система отказала — это не ошибка, о которой
      // стоит сообщать.
    }
  }, []);

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.lg) }}
        // Обновлять имеет смысл ровно одно — список точек; остальное лежит в
        // сборке.
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <OceanHero onBack={() => router.back()} onShare={() => void share()} />

        <View style={styles.content}>
          <OceanMapSection />

          <View onLayout={(event) => setPointsOffset(event.nativeEvent.layout.y)}>
            <OceanPointsSection
              query={query}
              contentPadding={brandPageLayout.contentPaddingHorizontal}
              onOpenVenue={openVenue}
            />
          </View>

          <OceanDishesSection contentPadding={brandPageLayout.contentPaddingHorizontal} />

          <OceanStorySection />

          <OceanClosingSection onBook={scrollToPoints} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Тёплый кремовый лист страницы (#FCF7EC, node 3424:3927) — тот же, что у
    // общей страницы подборки.
    backgroundColor: colors.brand2.sheet,
  },
  content: {
    paddingHorizontal: brandPageLayout.contentPaddingHorizontal,
    paddingVertical: brandPageLayout.contentPaddingVertical,
    gap: brandPageLayout.sectionGap,
  },
});
