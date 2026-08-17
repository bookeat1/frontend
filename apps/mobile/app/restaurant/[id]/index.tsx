import type { Restaurant } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Export, GlobeSimple, Heart, InstagramLogo, MapPin, Phone, WhatsappLogo, ArrowLeft } from "../../../src/components/icons";
import { IconButton } from "../../../src/components/IconButton";
import { useRestaurantFavorite } from "../../../src/hooks/useFavorites";
import { MapPreview } from "../../../src/components/booking/MapPreview";
import { MenuItemCard } from "../../../src/components/MenuItemCard";
import { PhotoView } from "../../../src/components/PhotoView";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { SegmentedTabs } from "../../../src/components/SegmentedTabs";
import { StoriesRail } from "../../../src/components/restaurant/StoriesRail";
import { ErrorState, LoadingState } from "../../../src/components/StateViews";
import { VenueScheduleCard } from "../../../src/components/VenueScheduleCard";
import { useRestaurant } from "../../../src/hooks/useRestaurant";
import { openPhone } from "../../../src/lib/external-links";
import { formatPriceRange } from "../../../src/lib/format";
import { openStateLabel } from "../../../src/lib/schedule";
import { trackEvent } from "../../../src/lib/analytics";

const t = getDictionary();

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: restaurant, isLoading, isError, refetch } = useRestaurant(id);
  // То же самое сердечко, что на карточках Explore: один запрос ["favorites"]
  // на весь экран, гость без сессии уезжает на вход, состояние приходит с
  // сервера. Раньше здесь стоял onPress={() => {}}.
  const favorite = useRestaurantFavorite(id ?? "");

  // `restaurant_open` once per venue id: keyed on the route param, not the
  // fetched payload, so it fires as soon as the screen has an id (a re-render
  // from favorite/query state does not re-count the same open).
  useEffect(() => {
    if (id) trackEvent("restaurant_open", { restaurant_id: id });
  }, [id]);

  /**
   * «Поделиться» — системный Share. Ссылки на заведение в вебе у продукта нет,
   * поэтому делимся тем, что существует: название и адрес. Придумывать
   * https://book-eat.com/r/<id> было бы ссылкой в никуда.
   */
  const share = async (name: string, address: string) => {
    try {
      await Share.share({ message: t.restaurant.shareText(name, address) });
    } catch {
      // Гость закрыл системный лист или платформа отказала — это не ошибка,
      // о которой ему нужно рассказывать.
    }
  };

  return (
    <View style={styles.root}>
      {isLoading ? (
        <SafeAreaView style={styles.loadingSafeArea}>
          <LoadingState title={t.common.loading} />
        </SafeAreaView>
      ) : isError || !restaurant ? (
        // Шапка с «назад» — и в ветке ошибки тоже: без неё 404 или обрыв сети
        // оставлял гостя на экране, с которого есть только «Повторить».
        <SafeAreaView style={styles.loadingSafeArea}>
          <View style={styles.header}>
            <IconButton
              icon={ArrowLeft}
              accessibilityLabel={t.a11y.backButton}
              onPress={() => router.back()}
            />
          </View>
          <ErrorState
            title={t.search.errorTitle}
            description={t.search.errorDescription}
            action={{ label: t.common.retry, onPress: () => refetch(), variant: "button" }}
          />
        </SafeAreaView>
      ) : (
        <>
          <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
            <View style={styles.header}>
              <IconButton icon={ArrowLeft} accessibilityLabel={t.a11y.backButton} onPress={() => router.back()} />
              <View style={styles.headerRightGroup}>
                <IconButton
                  icon={Heart}
                  accessibilityLabel={
                    favorite.isFavorite
                      ? t.restaurant.favoriteRemove(restaurant.name)
                      : t.restaurant.favoriteAdd(restaurant.name)
                  }
                  selected={favorite.isFavorite}
                  onPress={favorite.toggle}
                />
                <IconButton
                  icon={Export}
                  accessibilityLabel={t.a11y.shareButton}
                  onPress={() => void share(restaurant.name, restaurant.address)}
                />
              </View>
            </View>
          </SafeAreaView>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.coverContainer}>
              {/* Обложка — самое тяжёлое фото экрана и первое, что видит
                  гость: грузим её с высоким приоритетом, а пока она едет,
                  стоит нейтральная плашка нужного размера, поэтому ничего
                  под ней не прыгает. */}
              <PhotoView
                uri={restaurant.coverPhoto?.uri}
                alt={restaurant.coverPhoto?.alt}
                style={styles.cover}
                transition={200}
                priority="high"
                placeholderIconSize={40}
              />
            </View>

            <View style={styles.summary}>
              <Text style={styles.name}>{restaurant.name}</Text>
              {/* Адрес в каталоге бывает пустым — тогда строки просто нет.
                  Расстояния здесь больше нет вообще: раньше рядом с адресом
                  стояло «· 3.4 км», посчитанное из хеша id. */}
              {restaurant.address ? (
                <Text style={styles.addressLine}>{restaurant.address}</Text>
              ) : null}
              {favorite.failed ? (
                <Text style={styles.favoriteFailed} accessibilityRole="alert">
                  {t.restaurant.favoriteFailed}
                </Text>
              ) : null}
              <View style={styles.chipsRow}>
                {/* Ровно то, что сказал сервер: «Открыто» / «Закрыто» /
                    «Часы работы не указаны». Раньше здесь было «Открыто до
                    24:00», собранное из свободного текста и часов телефона. */}
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{openStateLabel(restaurant.schedule)}</Text>
                </View>
                <View style={styles.chip}>
                  {/* Числовой диапазон среднего чека, если бэкенд его прислал;
                      иначе — символьная ступень (₸/₸₸/₸₸₸). Тот же чип и стиль. */}
                  <Text style={styles.chipText}>
                    {restaurant.priceRange
                      ? formatPriceRange(restaurant.priceRange)
                      : restaurant.priceLevel}
                  </Text>
                </View>
                {/* Рейтинг показываем только когда отзывы реально есть:
                    «0,0» у заведения без отзывов читается как плохая оценка. */}
                {restaurant.reviewsCount > 0 ? (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>
                      {`${t.restaurant.rating(restaurant.rating)} · ${t.restaurant.reviewsCount(restaurant.reviewsCount)}`}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.section}>
              <SegmentedTabs
                labels={[t.restaurant.tabOverview, t.restaurant.tabPhotos]}
                // Вкладка «Фото» — это переход на отдельный экран, а не
                // переключение содержимого. Поэтому активной здесь всегда
                // остаётся «Обзор»: иначе после возврата назад подсветка
                // висела бы на «Фото», хотя на экране обзор.
                activeIndex={0}
                onChange={(index) => {
                  if (index === 1) router.push(`/restaurant/${restaurant.id}/photos`);
                }}
              />

              {/* Только истории. Лента акций отсюда убрана по решению
                  владельца (17.08.2026): две ленты подряд читались как одна
                  разъехавшаяся, а акции заведения гость и так видит на главной.
                  Лента сама себя прячет, когда историй нет или запрос упал. */}
              <StoriesRail restaurantId={restaurant.id} />

              <View style={styles.textBlock}>
                <Text style={styles.sectionTitle}>{t.restaurant.about}</Text>
                <Text style={styles.description}>{restaurant.description}</Text>
              </View>

              {/* Полная неделя с сервера: выходные помечены, работа за
                  полночь читается, сегодняшняя строка выделена, неизвестный
                  день выглядит неизвестным. */}
              <VenueScheduleCard
                schedule={restaurant.schedule}
                openingHoursText={restaurant.openingHoursText}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.restaurant.menuHighlights}</Text>
              <ScrollableMenu
                items={restaurant.menuHighlights}
                onOpenDish={(dishId) =>
                  router.push({
                    pathname: "/restaurant/[id]/menu",
                    params: { id: restaurant.id, dish: dishId },
                  })
                }
              />
              {/* Кнопка ведёт на отдельный экран меню — только чтение, без
                  корзины. Раньше она была disabled, потому что единственный
                  экран меню жил внутри флоу брони и складывал блюда в его
                  черновик; в результате у заведения с 200 блюдами меню нельзя
                  было открыть вообще. */}
              <PrimaryButton
                label={t.restaurant.viewMenu}
                variant="secondary"
                onPress={() => router.push(`/restaurant/${restaurant.id}/menu`)}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.restaurant.contacts}</Text>
              <View style={styles.socialRow}>
                {restaurant.social?.website ? (
                  <View style={styles.socialIcon}>
                    <GlobeSimple size={24} color={colors.text.primary} weight="regular" />
                  </View>
                ) : null}
                {restaurant.social?.whatsapp ? (
                  <View style={styles.socialIcon}>
                    <WhatsappLogo size={24} color={colors.text.primary} weight="regular" />
                  </View>
                ) : null}
                {restaurant.social?.instagram ? (
                  <View style={styles.socialIcon}>
                    <InstagramLogo size={24} color={colors.text.primary} weight="regular" />
                  </View>
                ) : null}
              </View>

              {restaurant.address ? (
                <View style={styles.contactRow}>
                  <MapPin size={24} color={colors.text.primary} weight="regular" />
                  <View style={styles.contactText}>
                    <Text style={styles.contactPrimary}>{restaurant.address}</Text>
                    {restaurant.addressNote ? (
                      <Text style={styles.contactSecondary}>{restaurant.addressNote}</Text>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {restaurant.phone ? (
                <View style={styles.contactRow}>
                  <Phone size={24} color={colors.text.primary} weight="regular" />
                  <View style={styles.contactText}>
                    <Text style={styles.contactPrimary}>{restaurant.phone}</Text>
                    <Text style={styles.contactSecondary}>{t.restaurant.phoneLabel}</Text>
                  </View>
                </View>
              ) : null}

              {/* Тот же блок карты, что и на экране брони: server-rendered
                  превью с тапом в приложение карт. Раньше здесь висела
                  картинка-заглушка с placehold.co и НАРИСОВАННАЯ булавка —
                  оба ушли: булавку рисует сам провайдер на настоящей карте,
                  вторая была бы вторым маркером не в том месте. */}
              <MapPreview restaurant={restaurant} />
            </View>
          </ScrollView>

          <SafeAreaView edges={["bottom"]} style={styles.footerSafeArea}>
            <View style={styles.footer}>
              {/* Дизайн: единственная красная кнопка «Забронировать столик».
                  Телефонный запасной вариант и неактивное состояние ушли вместе
                  с блоком «онлайн-бронь здесь не работает» — их в макете нет. */}
              <PrimaryButton
                label={t.restaurant.bookTable}
                onPress={() => router.push(`/restaurant/${restaurant.id}/book`)}
              />
            </View>
          </SafeAreaView>
        </>
      )}
    </View>
  );
}

function ScrollableMenu({
  items,
  onOpenDish,
}: {
  items: Restaurant["menuHighlights"];
  /** Тап по блюду открывает экран меню с этим блюдом в шторке деталей —
   * отдельной шторки на экране заведения нет, а дублировать её здесь значило
   * бы держать две копии одного экрана. */
  onOpenDish: (dishId: string) => void;
}) {
  // Пустая лента = у заведения действительно нет блюд в API (например,
  // «Adept»). Отсутствие фотографий блюдом больше не считается.
  if (items.length === 0) {
    return <Text style={styles.sectionEmpty}>{t.restaurant.menuEmpty}</Text>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.menuRow}>
        {items.map((item) => (
          <MenuItemCard key={item.id} item={item} onPress={onOpenDish} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.screen,
  },
  loadingSafeArea: {
    flex: 1,
    backgroundColor: colors.background.surface,
  },
  headerSafeArea: {
    backgroundColor: colors.background.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingHorizontal: spacing.sm,
  },
  headerRightGroup: {
    flexDirection: "row",
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  coverContainer: {
    padding: spacing.sm,
    backgroundColor: colors.background.surface,
  },
  cover: {
    width: "100%",
    height: 240,
    borderRadius: radius.photoHero,
    backgroundColor: colors.background.chip,
  },
  // Фотография, название, адрес и чипы — ОДИН блок (макет 340:2535): это
  // ответ на вопрос «что это за место», и разрывать его серым просветом
  // означало бы поделить один ответ надвое.
  summary: {
    backgroundColor: colors.background.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.lg,
  },
  name: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  addressLine: {
    ...typography.body,
    color: colors.text.primary,
    marginTop: spacing.xxs,
  },
  favoriteFailed: {
    ...typography.caption,
    color: colors.brand.primary,
  },
  chipsRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.background.chip,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  // Блок карточки заведения — белая полоса ВО ВСЮ ШИРИНУ, без скругления
  // (макет 340:2535). Разделяет блоки серый просвет между ними, а не линия и
  // не рамка.
  section: {
    backgroundColor: colors.background.surface,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    gap: spacing.xxl,
  },
  textBlock: {
    gap: spacing.lg,
  },
  sectionTitle: {
    ...typography.titleLg,
    color: colors.text.primary,
  },
  description: {
    ...typography.body,
    color: colors.text.primary,
  },
  menuRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  sectionEmpty: {
    ...typography.body,
    color: colors.text.muted,
  },
  socialRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  socialIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.background.socialIcon,
    alignItems: "center",
    justifyContent: "center",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  // Реальные адреса длинные («Проспект Аль-Фараби, 77/8. 1 этаж»); без flex
  // текст на 360 px уезжает за край вместо переноса.
  contactText: {
    flex: 1,
  },
  contactPrimary: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  contactSecondary: {
    ...typography.caption,
    color: colors.text.muted,
  },
  footerSafeArea: {
    backgroundColor: colors.background.surface,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 16,
    elevation: 8,
  },
  footer: {
    padding: spacing.md,
  },
});
