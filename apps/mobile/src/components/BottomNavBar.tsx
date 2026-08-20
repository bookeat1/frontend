import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CompassIcon,
  MagniferIcon,
  type NavIconProps,
  NotebookIcon,
  PointOnMapIcon,
  UserRoundedIcon,
} from "./nav-icons";

const t = getDictionary();

/** The five destinations of the tab bar. Every one of them is a real route. */
type NavKey = "overview" | "search" | "bookings" | "gastroguide" | "profile";

interface NavItem {
  key: NavKey;
  label: string;
  icon: React.ComponentType<NavIconProps>;
  route: "/" | "/search" | "/bookings" | "/articles" | "/profile";
}

/**
 * Глифы — ровно те пять, что нарисованы в макете (набор Solar Linear), а не
 * их подобия из Phosphor: раньше «Гастрогид» рисовался булавкой MapPin вместо
 * карты с точкой, а «Мои брони» — раскрытой книгой вместо блокнота.
 */
const items: NavItem[] = [
  { key: "overview", label: t.nav.overview, icon: CompassIcon, route: "/" },
  { key: "search", label: t.nav.search, icon: MagniferIcon, route: "/search" },
  { key: "bookings", label: t.nav.bookings, icon: NotebookIcon, route: "/bookings" },
  { key: "gastroguide", label: t.nav.gastroguide, icon: PointOnMapIcon, route: "/articles" },
  { key: "profile", label: t.nav.profile, icon: UserRoundedIcon, route: "/profile" },
];

/**
 * Высота самой плашки (Figma node 3039:23944).
 *
 * 1 (рамка) + 8 + 24 глиф + 2 + 14 подпись + 8 + 1 = 58.
 */
export const NAV_BAR_HEIGHT = 58;

/**
 * Отступ плавающей плашки от краёв экрана: в макете она 359 шириной на экране
 * 375, то есть по 8 слева и справа. Тот же отступ работает нижним полем там,
 * где у телефона нет полосы home-indicator (Android с кнопками): иначе плашка
 * прилипла бы к нижней грани и перестала «висеть».
 */
export const NAV_BAR_EDGE_INSET = spacing.sm;

/** Зазор между плашкой и полосой home-indicator (`gap-[2px]` в макете). */
const NAV_BAR_INDICATOR_GAP = spacing.xxs;

/**
 * How much bottom padding a scrollable screen needs so its last item clears the
 * floating bar.
 *
 * Плашка больше не прижата к нижней грани: под ней лежит зона home-indicator
 * (safe-area), а если её нет — те же 8, что и по бокам. Поэтому места надо
 * резервировать больше, чем раньше (раньше было 58 + inset, что на телефоне
 * без индикатора давало ровно 58 и упирало последнюю строку в плашку).
 */
export function useNavBarSpacing(): number {
  const bottom = useSafeAreaInsets().bottom;
  return NAV_BAR_HEIGHT + NAV_BAR_INDICATOR_GAP + Math.max(bottom, NAV_BAR_EDGE_INSET);
}

/**
 * Which tab the CURRENT route belongs to.
 *
 * Derived from the pathname rather than taken as a prop: a prop is a second
 * source of truth that goes stale the moment a screen forgets to pass it —
 * which is exactly how this bar used to claim "Поиск" while the guest was on
 * the home screen.
 *
 * `/booking/:id` (one reservation) maps to the «Бронь» tab even though that
 * screen does not render the bar today, so the mapping stays right if it ever
 * does. `/articles/:slug` (одна подборка) точно так же подсвечивает
 * «Гастрогид»: статья открывается из списка и остаётся тем же разделом.
 *
 * `/favorites` больше не вкладка (вход в избранное переехал в профиль), так
 * что на этом экране не подсвечено ничего — это честнее, чем подсветить чужую
 * вкладку.
 */
export function activeNavKey(pathname: string): NavKey | null {
  if (pathname === "/") return "overview";
  if (pathname.startsWith("/search")) return "search";
  if (pathname.startsWith("/bookings") || pathname.startsWith("/booking/")) return "bookings";
  if (pathname.startsWith("/articles")) return "gastroguide";
  if (pathname.startsWith("/profile")) return "profile";
  return null;
}

/**
 * Bottom tab bar (Figma 3z0f6dgev4HMwBAHPjTjPo, «Bottom Navigation»,
 * node 3039:23943).
 *
 * Плашка ПЛАВАЕТ: скруглённый прямоугольник с отступом 8 от каждого края
 * экрана и мягкой тенью, а не полоса во всю ширину. Под ней — зона
 * home-indicator: там виден фон экрана, приглушённый градиентом.
 *
 * All five tabs navigate. Switching tabs REPLACES the current route rather
 * than pushing: tabs are siblings, not a stack, and pushing would build a back
 * history of "Главная → Поиск → Главная → Поиск" that nobody expects on a
 * phone. Tapping the tab you are already on does nothing, instead of
 * remounting the screen and throwing away its scroll position.
 *
 * ФОН СОБРАН ПО МАКЕТУ И ЧЕСТНО ДЕГРАДИРУЕТ.
 *
 * Под плашкой лежит вертикальный градиент из макета (прозрачный сверху →
 * белый 65 % снизу): он гасит контент, уезжающий под навигацию, и работает на
 * всех платформах.
 *
 * Сама плашка размыта настоящим системным размытием там, где оно есть, — это
 * iOS 26 и `expo-glass-effect` (UIVisualEffectView). Тогда заливка ровно из
 * макета: белый 30 % как оттенок стекла, рамка белым 14 %, радиус 36.
 *
 * На Android и на iOS до 26 нативного размытия НЕТ: `expo-glass-effect` там
 * вырождается в обычный View, а `expo-blur` в проект не установлен и по OTA
 * не приедет. Рисовать вместо размытия белый 30 % нельзя — это не «почти
 * стекло», это подпись в 10 pt поверх голой фотографии. Поэтому там плашка
 * заливается почти непрозрачным белым (`navBarFallback`), геометрия и рамка
 * остаются макетными.
 *
 * ПРО КОНТРАСТ (историю уже проходили: прошлую попытку «жидкого стекла»
 * откатили, потому что подписи в 10 pt терялись поверх фотографии). Сверх
 * макета добавлено ровно два: `colorScheme="light"` у стекла, чтобы система
 * не перекрасила материал в тёмный поверх тёмного фото и красная активная
 * подпись не оказалась на почти чёрном; и более тёмный серый неактивной
 * подписи из макета (#595959 вместо прежнего #A5A5A5).
 */
export function BottomNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const active = activeNavKey(pathname);
  const insets = useSafeAreaInsets();

  const tabs = (
    <View style={styles.row}>
      {items.map(({ key, label, icon: Icon, route }) => {
        const isActive = key === active;
        const color = isActive ? colors.brand.primary : colors.text.navInactive;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
            onPress={() => {
              if (isActive) return;
              router.replace(route);
            }}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Icon size={24} color={color} />
            {/* Длинные подписи («Гастрогид», «Мои брони») сжимаются в одну
                строку, а не выталкивают соседнюю вкладку за край на 360 px. */}
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, NAV_BAR_EDGE_INSET) }]}>
      {/* Градиент лежит во всю ширину дока, под плашкой и под зоной
          home-indicator, и не перехватывает касания. */}
      <LinearGradient
        colors={[colors.overlay.navBarGradientTop, colors.overlay.navBarGradientBottom]}
        style={styles.gradient}
      />
      <NavPanel>{tabs}</NavPanel>
    </View>
  );
}

/**
 * Плашка: настоящее стекло там, где оно есть, иначе — заливка.
 *
 * Проверяются ОБА флага. `isLiquidGlassAvailable` говорит, что приложение
 * вообще в дизайне Liquid Glass, а `isGlassEffectAPIAvailable` — что на этом
 * устройстве есть сам класс UIGlassEffect: на части бет iOS 26 его нет, и
 * обращение к нему роняет приложение (expo/expo#40911).
 */
function NavPanel({ children }: { children: React.ReactNode }) {
  const hasNativeGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

  if (hasNativeGlass) {
    return (
      // Скругление приезжает из `styles.panel`: RN разбирает style в
      // отдельные нативные пропы, и `borderRadius` ловит объявленный в модуле
      // Prop("borderRadius") — им нативная сторона режет сам материал.
      <GlassView
        style={styles.panel}
        glassEffectStyle="regular"
        colorScheme="light"
        tintColor={colors.background.navBarGlassTint}
      >
        {children}
      </GlassView>
    );
  }

  return <View style={[styles.panel, styles.panelFallback]}>{children}</View>;
}

const styles = StyleSheet.create({
  dock: {
    // box-none: в просветах слева, справа и под плашкой лежит контент экрана —
    // прозрачная область не должна перехватывать у него касания.
    pointerEvents: "box-none",
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: NAV_BAR_EDGE_INSET,
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
  },
  panel: {
    borderRadius: radius.navBar,
    // Рамка из макета (`1px solid rgba(255,255,255,0.14)`) заодно играет роль
    // его же `p-px`: 1 сверху и 1 снизу — это те самые два пикселя высоты 58.
    borderWidth: 1,
    borderColor: colors.overlay.navBarBorder,
    marginBottom: NAV_BAR_INDICATOR_GAP,
    // Тень ровно из макета: `0px 1px 20px rgba(0, 0, 0, 0.1)`.
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 20,
    // У Android нет параметров тени — только elevation; 8 даёт сопоставимую
    // мягкость (тот же приём, что у липкого футера в DetailBlocks).
    elevation: 8,
  },
  panelFallback: {
    backgroundColor: colors.background.navBarFallback,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  item: {
    flex: 1,
    // 8 + 24 глиф + 2 + 14 подпись + 8 = 56 — ячейка сама по себе выше
    // минимальных 44 pt, hitSlop не нужен (он бы залез на соседнюю вкладку).
    paddingVertical: spacing.sm,
    alignItems: "center",
    gap: spacing.xxs,
    borderRadius: radius.navBar,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    ...typography.navLabel,
  },
});
