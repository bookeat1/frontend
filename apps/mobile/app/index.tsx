import { colors, spacing } from "@bookeat/design-tokens";
import type { AuthUser, Cuisine } from "@bookeat/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { BottomNavBar, useNavBarSpacing } from "../src/components/BottomNavBar";
import { ArticlesSection } from "../src/components/explore/ArticlesSection";
import { CuisineSection } from "../src/components/explore/CuisineSection";
import { EventsListSection } from "../src/components/explore/EventsListSection";
import { HomeHeader } from "../src/components/explore/HomeHeader";
import { PromotionsSection } from "../src/components/explore/PromotionsSection";
import { RecommendedSection } from "../src/components/explore/RecommendedSection";
import { EXPLORE_DEFAULT_GUESTS } from "../src/components/explore/use-explore-data";
import { toDateKey } from "../src/lib/format";
import { trackEvent } from "../src/lib/analytics";
import { useAuth } from "../src/lib/auth";
import { requestCitySelection } from "../src/lib/city-select";
import { useLocale } from "../src/lib/locale";

/**
 * Home — the first screen (rebuilt to the Figma home design, 2026-08-06),
 * mounted at the `/` route and reached by the Explore bottom tab.
 *
 * Shape: a compact dark header (`HomeHeader`, replaces the old promo
 * HeroCarousel) bleeding under the status bar, then a stack of full-width white
 * section blocks on the grey screen background.
 *
 * REAL DATA today: «Выбрали для вас» (popular catalog), «Выберите кухню»
 * (distinct cuisine_type values) and «Афиша» (GET /events). «Акции» and
 * «Статьи» have no endpoint yet and hide themselves cleanly (their hooks return
 * [] — see use-explore-data.ts), so the screen looks finished on real data.
 */
/** Высота тёмной шапки главной без учёта полосы статуса. Значение приблизительное
 * и служит одной цели — вовремя перекрасить часы; ошибка в пару пикселей здесь
 * ничего не ломает. */
const HEADER_HEIGHT = 220;

export default function HomeScreen() {
  const navPad = useNavBarSpacing();
  const insets = useSafeAreaInsets();
  // true, пока тёмная шапка стоит под статус-баром.
  const [headerBehindStatusBar, setHeaderBehindStatusBar] = useState(true);
  // Dictionary through the context so the greeting/city labels re-render in the
  // chosen language the instant it changes (the switch lives in /settings/language).
  const { dictionary: t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status, repository } = useAuth();

  // Greeting name and city read from the SAME ["me"] query cache the profile
  // screens edit (profile.tsx / profile/edit / profile/personal-data all write
  // it via queryClient.setQueryData(["me"], updated)). Reading the auth
  // context's best-effort `user` instead left the header stale after an edit —
  // that state is only refreshed at sign-in, never after a PATCH. Same query
  // shape as profile.tsx so the two views share one source of truth, and the
  // stored city survives a restart because GET /users/me returns it.
  const me = useQuery<AuthUser>({
    queryKey: ["me"],
    queryFn: () => repository.getMe(),
    enabled: status === "signed-in",
    staleTime: 5 * 60_000,
  });
  const account = me.data ?? null;

  // Both are best-effort: a cold start with no session, or a profile that
  // hasn't answered yet, falls back to the no-name greeting and the default
  // city rather than gating the screen.
  const firstName = account?.fullName?.trim().split(/\s+/)[0];
  const greeting = firstName ? t.explore.greeting(firstName) : t.explore.greetingNoName;
  const city = account?.city?.trim() || t.explore.cityFallback;

  const openSearch = useCallback(() => router.push("/search"), [router]);
  // Тап по капсуле «сегодня · 2 гостя» ведёт в поиск С ЭТИМ ЖЕ выбором, а не
  // просто в каталог: человек уже назвал день и компанию, и заставлять его
  // повторить это на следующем экране — терять то, что он только что сказал.
  // Дальше выбор становится настоящим фильтром по свободным столам.
  const openSearchWithParty = useCallback(
    () =>
      router.push({
        pathname: "/search",
        params: { guests: String(EXPLORE_DEFAULT_GUESTS), date: toDateKey(new Date()) },
      }),
    [router],
  );
  const openNotifications = useCallback(() => router.push("/notifications"), [router]);

  // Tapping the city in the header opens the same picker the profile uses and
  // persists the choice to the account, writing the server's answer back into
  // the ["me"] cache so the greeting/city update everywhere without a refetch —
  // exactly the flow profile.tsx runs. Cache is touched only on success.
  const openCity = useCallback(() => {
    requestCitySelection((city) => {
      void repository
        .updateMe({ city: city ?? "" })
        .then((updated) => queryClient.setQueryData(["me"], updated))
        .catch(() => {
          // Keep the last stored city; the header already shows the real value.
        });
    });
    router.push({ pathname: "/city", params: { selected: account?.city ?? "", purpose: "profile" } });
  }, [account?.city, queryClient, repository, router]);

  // The «Афиша» section chevron opens the dedicated events list screen.
  const openEvents = useCallback(() => router.push("/events"), [router]);

  // «Статьи»: the chevron opens the full collections list; a card opens that
  // collection's detail (the id carried by the card IS the slug).
  const openArticles = useCallback(() => router.push("/articles"), [router]);
  const openArticle = useCallback(
    (slug: string) => router.push(`/articles/${slug}`),
    [router],
  );

  // Tapping an «Афиша» row opens that event's detail card (same target as the
  // dedicated list), instead of jumping to the host restaurant.
  const openEvent = useCallback(
    (id: string) => {
      trackEvent("event_tap", { id });
      router.push(`/event/${id}`);
    },
    [router],
  );

  // «Акции»: the chevron opens the full list, a tile opens that promo's card —
  // the same pair as «Афиша» above.
  const openPromotions = useCallback(() => router.push("/promotions"), [router]);
  const openPromotion = useCallback(
    (id: string) => {
      trackEvent("promotion_tap", { id });
      router.push(`/promotion/${id}`);
    },
    [router],
  );

  const openRestaurant = useCallback(
    (id: string) => router.push(`/restaurant/${id}`),
    [router],
  );

  // A cuisine chip opens the catalog pre-filtered to that cuisine. The id is
  // casefold(cuisine_type), exactly what the search filter matches on, so the
  // search screen just seeds `filters.cuisineIds` from the `cuisine` param.
  const pickCuisine = useCallback(
    (cuisine: Cuisine) =>
      router.push({ pathname: "/search", params: { cuisine: cuisine.id } }),
    [router],
  );

  return (
    <View style={styles.root}>
      {/* Часы и заряд рисует система, а не мы — но их ЦВЕТ задаём мы. Пока под
          статус-баром тёмное фото шапки, они белые; стоит шапке уехать вверх,
          под ними оказывается белый лист, и белые часы на нём исчезают. Поэтому
          цвет переключается по прокрутке, а не выставляется один раз. */}
      <StatusBar style={headerBehindStatusBar ? "light" : "dark"} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: navPad }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          // Порог — высота шапки за вычетом самой полосы статуса: ровно тот
          // момент, когда её нижний край проходит под часами.
          const passed = event.nativeEvent.contentOffset.y > HEADER_HEIGHT - insets.top;
          if (passed === headerBehindStatusBar) setHeaderBehindStatusBar(!passed);
        }}
        // No top safe-area inset here on purpose: the header bleeds under the
        // status bar and applies the inset itself.
      >
        <HomeHeader
          greeting={greeting}
          city={city}
          dateValue={t.booking.today}
          guestsValue={t.booking.guestsCount(EXPLORE_DEFAULT_GUESTS)}
          onOpenSearch={openSearchWithParty}
          onOpenNotifications={openNotifications}
          onOpenCity={openCity}
        />

        <View style={styles.sheet}>
          <RecommendedSection onSeeAll={openSearch} onOpenRestaurant={openRestaurant} />
          <CuisineSection onPickCuisine={pickCuisine} />
          <PromotionsSection onSeeAll={openPromotions} onOpenPromotion={openPromotion} />
          <EventsListSection onOpenEvent={openEvent} onSeeAll={openEvents} />
          {/* Live GASTROGUIDE collections; hides itself when nothing is published. */}
          <ArticlesSection onSeeAll={openArticles} onOpenArticle={openArticle} />
        </View>
      </ScrollView>

      {/* Белая подложка под последним блоком: без неё оттягивание ленты вниз
          обнажает серый фон экрана, и белая лента визуально «рвётся» перед
          панелью вкладок. Слой лежит ПОД скроллом и ничего не перехватывает. */}
      <View style={[styles.floor, { height: navPad + spacing.huge }]} pointerEvents="none" />

      {/* The bar reads the active tab off the current route itself. */}
      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Серый фон — это НЕ фон ради фона, а разделитель: в макете 986:8697 блоки
    // лежат белыми карточками на сером, и просвет между ними и показывает, где
    // кончается одна секция и начинается другая. Правка «везде белый» от
    // 13.08 была про пустые экраны, где серый читался как ошибка загрузки;
    // здесь он несёт смысл.
    backgroundColor: colors.background.screen,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  floor: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background.screen,
    zIndex: -1,
  },
  sheet: {
    // 8 серого между шапкой и первым блоком и между блоками — ровно то, что
    // рисует макет.
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
});
