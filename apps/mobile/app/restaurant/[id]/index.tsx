import type { Restaurant } from "@bookeat/api";
import { colors, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo } from "react";
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "../../../src/components/icons";
import { IconButton } from "../../../src/components/IconButton";
import { useRestaurantFavorite } from "../../../src/hooks/useFavorites";
import { MapPreview } from "../../../src/components/booking/MapPreview";
import { MenuItemCard } from "../../../src/components/MenuItemCard";
import { VenueAddressRow, VenueContactIcons } from "../../../src/components/contacts/VenueContactLinks";
import { DETAIL_FOOTER_CLEARANCE } from "../../../src/components/detail/DetailBlocks";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { SegmentedTabs } from "../../../src/components/SegmentedTabs";
import { StoriesRail } from "../../../src/components/restaurant/StoriesRail";
import { VenueHero } from "../../../src/components/restaurant/VenueHero";
import { ErrorState, LoadingState } from "../../../src/components/StateViews";
import { VenueScheduleCard } from "../../../src/components/VenueScheduleCard";
import { useRestaurant, useRestaurantRefresh } from "../../../src/hooks/useRestaurant";
import { trackEvent } from "../../../src/lib/analytics";
import { highlightsWithPhoto } from "../../../src/lib/menu-highlights";

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

  // «Лучшие позиции» — только блюда с фотографией: карточка ленты это прежде
  // всего снимок, а ряд серых плашек читается как поломка (правка владельца,
  // на его экране так выглядели «Айран 1 л» и «Айран 200 мл»). Отбор тот же
  // делает сервер; здесь он повторён страховкой, см. lib/menu-highlights.
  const highlights = useMemo(
    () => highlightsWithPhoto(restaurant?.menuHighlights ?? []),
    [restaurant?.menuHighlights],
  );

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
          <ScrollView
            style={styles.scrollFloor}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {/* Шапка «Hero / Editorial» (макет 3446:12620): снимок во всю
                ширину, кнопки и подпись НА нём. Кнопки уехали внутрь шапки
                вместе с ней — белой полосы над фотографией в макете больше
                нет. */}
            <VenueHero
              restaurant={restaurant}
              isFavorite={favorite.isFavorite}
              onToggleFavorite={favorite.toggle}
              onBack={() => router.back()}
              onShare={() => void share(restaurant.name, restaurant.address)}
            />
            {favorite.failed ? (
              <Text style={styles.favoriteFailed} accessibilityRole="alert">
                {t.restaurant.favoriteFailed}
              </Text>
            ) : null}

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

            {/* Блок меню есть ТОЛЬКО у заведения, у которого в API
                действительно есть позиции (правка владельца 2026-08-24).
                Признака «меню нет» бэкенд не присылает: GET
                /restaurants/:id/menu отдаёт либо список, либо пустой массив,
                либо не отвечает вовсе — во всех трёх случаях `menuHighlights`
                пуст, и показывать нечего; кнопка «Посмотреть меню» уходит
                вместе с блоком осознанно, экран меню читает ТУ ЖЕ ручку и
                открылся бы пустым.

                ЛЕНТА И КНОПКА РАЗВЕДЕНЫ (2026-09-01). Из ленты выкидываются
                блюда БЕЗ фотографии (`highlightsWithPhoto`) — ряд серых
                плашек читается как поломка. Заголовок «Лучшие позиции» и сама
                лента при пустом отборе исчезают целиком, а КНОПКА остаётся:
                меню у заведения есть, просто у его блюд нет снимков, и
                спрятать вход в меню значило бы сделать его недостижимым — тот
                самый баг, который здесь уже чинили. На боевом каталоге фото
                есть примерно у трети блюд, так что заведение вообще без
                снимков — не редкость. */}
            {restaurant.menuHighlights.length > 0 ? (
              <View style={styles.section}>
                {highlights.length > 0 ? (
                  <>
                    <Text style={styles.sectionTitle}>{t.restaurant.menuHighlights}</Text>
                    <ScrollableMenu
                      items={highlights}
                      onOpenDish={(dishId) =>
                        router.push({
                          pathname: "/restaurant/[id]/menu",
                          params: { id: restaurant.id, dish: dishId },
                        })
                      }
                    />
                  </>
                ) : null}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingHorizontal: spacing.sm,
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
  favoriteFailed: {
    ...typography.caption,
    color: colors.brand.primary,
    // Своё поле по бокам: строка больше не лежит внутри белого блока с
    // отступами — шапка теперь идёт от края до края.
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.surface,
    paddingBottom: spacing.sm,
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
