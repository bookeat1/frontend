import type { Restaurant } from "@bookeat/api";
import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Export, Heart, ArrowLeft } from "../../../src/components/icons";
import { IconButton } from "../../../src/components/IconButton";
import { useRestaurantFavorite } from "../../../src/hooks/useFavorites";
import { MapPreview } from "../../../src/components/booking/MapPreview";
import { MenuItemCard } from "../../../src/components/MenuItemCard";
import { VenueAddressRow, VenueContactIcons } from "../../../src/components/contacts/VenueContactLinks";
import { DETAIL_FOOTER_CLEARANCE } from "../../../src/components/detail/DetailBlocks";
import { PhotoView } from "../../../src/components/PhotoView";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { SegmentedTabs } from "../../../src/components/SegmentedTabs";
import { StoriesRail } from "../../../src/components/restaurant/StoriesRail";
import { splitCuisines } from "../../../src/lib/cuisine-display";
import { ErrorState, LoadingState } from "../../../src/components/StateViews";
import { VenueScheduleCard } from "../../../src/components/VenueScheduleCard";
import { useRestaurant, useRestaurantRefresh } from "../../../src/hooks/useRestaurant";
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
  // Потянуть карточку = переспросить и профиль заведения, и ленту сторис;
  // кружок гаснет, когда ответили оба (см. useRestaurantRefresh).
  const { refreshing, onRefresh } = useRestaurantRefresh(id);

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

          <ScrollView
            style={styles.scrollFloor}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {/* Фотография, название, адрес и чипы — ОДИН блок (макет
                340:2535). Раньше фото было отдельным элементом списка, и
                просвет между блоками разрезал этот ответ надвое. */}
            <View style={styles.summaryBlock}>
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
              {/* Строку снова рисуем безусловно: ценовая ступень (₸/₸₸/₸₸₸)
                  есть у КАЖДОГО заведения, поэтому пустой эта строка больше
                  быть не может. Проверка hasSummaryChips нужна была, пока чип
                  цены зависел от заполненного среднего чека в тенге. */}
              <View style={styles.chipsRow}>
                {/* КУХНЯ И ЧЕК — то, что стоит в этой строке макета 340:2535
                    (правка владельца 2026-08-25). Признак открытости отсюда
                    УБРАН: он остался единственным местом, где ему и место, —
                    в блоке расписания под описанием («Открыто до 23:00» +
                    «Ежедневно с 10:00 до 23:00», см. VenueScheduleCard).
                    Расстояния («500 м» в макете) здесь нет и не будет: у нас
                    нет ни геопозиции гостя, ни расстояния в API, а прошлая
                    версия этой строки считала его из хеша id.

                    Кухонь у заведения набор, и правило показа — ТО ЖЕ, что на
                    карточке в списке (splitCuisines): две отдельными чипами,
                    остальные под «+N». Одно правило на приложение важнее, чем
                    выигрыш в пару чипов на экране, где места чуть больше; ряд
                    при этом умеет переноситься, чтобы длинные названия на 360
                    не уезжали за край. */}
                <CuisineChips cuisines={restaurant.cuisines} />
                {/* Ценовая категория — символьной ступенью «₸/₸₸/₸₸₸» (правка
                    владельца 2026-08-24, откат числового диапазона от
                    2026-08-20), тем же алфавитом, что на карточках в списках и
                    в чипах фильтра цены. Ступень есть у каждого заведения
                    (price_category с сервера), поэтому чип рисуется всегда. */}
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{restaurant.priceLevel}</Text>
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

            {/* Меню целиком — заголовок, лента и кнопка — есть ТОЛЬКО у
                заведения, у которого в API действительно есть позиции
                (правка владельца 2026-08-24). Признака «меню нет» бэкенд не
                присылает: GET /restaurants/:id/menu отдаёт либо список, либо
                пустой массив, либо не отвечает вовсе — во всех трёх случаях
                `menuHighlights` пуст, и показывать нечего. Кнопка
                «Посмотреть меню» уходит вместе с блоком осознанно: экран
                меню читает ТУ ЖЕ ручку и открылся бы пустым. */}
            {restaurant.menuHighlights.length > 0 ? (
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
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.restaurant.contacts}</Text>
              {/* Ряд соцсетей рисуется, ТОЛЬКО когда есть хоть одна ссылка:
                  пустой ряд оставлял на экране отступ без содержимого.
                  Иконки нажимаются — иконка, которая никуда не ведёт, обещает
                  переход и не выполняет обещание. */}
              {/* Те же компоненты контактов, что на экране брони и на
                  карточках афиши и акции. Раньше здесь лежала ЧЕТВЁРТАЯ копия
                  этого блока, и в ней телефон был просто текстом: копию
                  починили в трёх местах, а про эту забыли.

                  С 2026-08-26 телефон вообще не печатается номером — он
                  первый значок в ряду контактов и по нажатию звонит. */}
              <VenueContactIcons phone={restaurant.phone} social={restaurant.social} />
              <VenueAddressRow restaurant={restaurant} />

              <MapPreview restaurant={restaurant} />
            </View>
            {/* Белый хвост под последним блоком. Это отдельный элемент, а не
                нижний отступ контейнера: отступ красился бы серым фоном списка,
                и под последней карточкой снова тянулась бы серая полоса. */}
            <View style={styles.bottomFloor} />
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

/**
 * Кухни заведения в шапке. Правило показа общее с карточкой в списке
 * (splitCuisines): главная и следующая — своими чипами, остаток — «+N», а
 * полный набор уходит в метку для скринридера. Заведение без кухонь не рисует
 * НИЧЕГО — ни чипа, ни «+0» (на бою такое есть: «Agora wine and deli»).
 */
function CuisineChips({ cuisines }: { cuisines: Restaurant["cuisines"] }) {
  const { visible, hiddenCount, hiddenNames } = splitCuisines(cuisines);
  return (
    <>
      {visible.map((cuisine) => (
        <View key={cuisine.id} style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>
            {cuisine.name}
          </Text>
        </View>
      ))}
      {hiddenCount > 0 ? (
        <View style={styles.chip} accessibilityLabel={hiddenNames}>
          <Text style={styles.chipText}>{`+${hiddenCount}`}</Text>
        </View>
      ) : null}
    </>
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
  // Пустого состояния здесь нет: блок с меню целиком не рисуется, когда
  // позиций нет (см. вызов выше). Раньше на его месте оставались заголовок
  // «Популярное меню», строка «Ресторан ещё не добавил меню» и кнопка,
  // ведущая на такой же пустой экран.
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
  // Белый «пол» ПОД содержимым: он виден только там, где содержимое кончилось —
  // при оттягивании снизу. Сам список блоков красит contentContainer, иначе
  // белое залило бы и просветы между блоками, и разделители исчезли бы.
  //
  // Отрицательный отступ съедает просвет, который контейнер ставит между всеми
  // блоками: последний блок должен переходить в белый «пол» без серой полоски
  // над кнопкой (правка владельца от 20.08).
  bottomFloor: {
    marginTop: -spacing.sm,
    // Высотой с липкую кнопку: иначе на коротком экране под последним блоком
    // остаётся полоса фона ровно там, где кнопка его не закрывает.
    height: DETAIL_FOOTER_CLEARANCE,
    backgroundColor: colors.background.surface,
  },
  scrollFloor: {
    backgroundColor: colors.background.surface,
  },
  scrollContent: {
    backgroundColor: colors.background.screen,
    gap: spacing.sm,
  },
  coverContainer: {
    // 8 по краям — замер по макету 340:2535: обложка 359 при ширине экрана 375.
    // Снизу 16: столько между фотографией и названием (правка владельца).
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
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
  summaryBlock: {
    backgroundColor: colors.background.surface,
  },
  summary: {
    backgroundColor: colors.background.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    // Название и адрес — одна подпись: в макете строка адреса начинается на 2
    // ниже названия. Отступ до чипов задаётся отдельно, там 16.
    gap: spacing.xxs,
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
    marginTop: spacing.lg,
    flexDirection: "row",
    // Перенос: в строке теперь могут стоять две кухни, «+N» и чек, а
    // «Средиземноморская» на экране 360 съедает половину ширины сама. Без
    // переноса последний чип уезжал бы за край без всякого признака, что он
    // там есть. `gap` работает и как вертикальный просвет между рядами.
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  // 36 высотой, текст с отступом 12 по бокам — размеры чипа из макета.
  // Гамма — та же бордовая, что у меток в списках (правка владельца
  // 2026-08-21 «chips should be same color»): карточка заведения и карточка в
  // каталоге показывают одни и те же факты, и разный цвет читался бы как
  // разный смысл.
  chip: {
    backgroundColor: colors.background.chipBrand,
    borderRadius: radius.pill,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    ...typography.labelMedium,
    color: colors.text.brand,
  },
  // Блок карточки заведения — белая полоса ВО ВСЮ ШИРИНУ, без скругления
  // (макет 340:2535). Разделяет блоки серый просвет между ними, а не линия и
  // не рамка.
  section: {
    backgroundColor: colors.background.surface,
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
  socialRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  socialIconPressed: {
    opacity: 0.6,
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
