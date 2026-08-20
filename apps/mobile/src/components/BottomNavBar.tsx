import { colors, radius, spacing, typography } from "@bookeat/design-tokens";
import { getDictionary } from "@bookeat/i18n";
import { usePathname, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BookOpen, Compass, MagnifyingGlass, MapPin, UserCircle } from "./icons";

const t = getDictionary();

/** The five destinations of the tab bar. Every one of them is a real route. */
type NavKey = "overview" | "search" | "bookings" | "gastroguide" | "profile";

interface NavItem {
  key: NavKey;
  label: string;
  icon: typeof Compass;
  route: "/" | "/search" | "/bookings" | "/articles" | "/profile";
}

const items: NavItem[] = [
  { key: "overview", label: t.nav.overview, icon: Compass, route: "/" },
  { key: "search", label: t.nav.search, icon: MagnifyingGlass, route: "/search" },
  { key: "bookings", label: t.nav.bookings, icon: BookOpen, route: "/bookings" },
  // Четвёртая вкладка — гастрогид, а не избранное. Глиф в макете называется
  // «Point On Map», ближайший в наборе Phosphor — MapPin.
  { key: "gastroguide", label: t.nav.gastroguide, icon: MapPin, route: "/articles" },
  { key: "profile", label: t.nav.profile, icon: UserCircle, route: "/profile" },
];

/**
 * Высота самой плашки (Figma node 3039:23944).
 *
 * 1 (рамка-паддинг) + 8 + 24 глиф + 2 + 14 подпись + 8 + 1 = 58.
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
 * Плашка ПЛАВАЕТ: белый скруглённый прямоугольник с отступом 8 от каждого края
 * экрана и мягкой тенью, а не полоса во всю ширину. Под ней — зона
 * home-indicator, она остаётся прозрачной: там виден фон экрана.
 *
 * All five tabs navigate. Switching tabs REPLACES the current route rather
 * than pushing: tabs are siblings, not a stack, and pushing would build a back
 * history of "Главная → Поиск → Главная → Поиск" that nobody expects on a
 * phone. Tapping the tab you are already on does nothing, instead of
 * remounting the screen and throwing away its scroll position.
 *
 * The bar is SOLID, not frosted. В макете плашка полупрозрачная (белый 30 % с
 * размытием) — это вариант «жидкого стекла», от которого проект уже
 * отказывался: на реальном телефоне поверх фотографии заливка расплывалась
 * пятнами, а подписи в 10 pt теряли контраст. Настоящее размытие требует
 * нативного модуля и новой сборки; до тех пор честный ответ — непрозрачная
 * плашка с той же геометрией, радиусом и тенью.
 */
export function BottomNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const active = activeNavKey(pathname);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, NAV_BAR_EDGE_INSET) }]}>
      <View style={styles.panel}>
        <View style={styles.row}>
          {items.map(({ key, label, icon: Icon, route }) => {
            const isActive = key === active;
            const color = isActive ? colors.brand.primary : colors.text.muted;
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
                {/* Толщина линии 2 в сетке 24 — по макету. У Phosphor это «bold»:
                    regular рисует 1.5 и рядом с текстом выглядит бледнее подписи. */}
                <Icon size={24} color={color} weight="bold" />
                {/* Длинные подписи («Гастрогид», «Мои брони») сжимаются в одну
                    строку, а не выталкивают соседнюю вкладку за край на 360 px. */}
                <Text style={[styles.label, { color }]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
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
  panel: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.navBar,
    // `p-px` из макета: рамка плашки. Заливка непрозрачная, поэтому белая
    // рамка в 14 % не нарисована — но её толщина остаётся частью высоты 58.
    padding: 1,
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
