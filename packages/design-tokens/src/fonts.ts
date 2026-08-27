/**
 * Font family name constants. These are the exact family names registered by
 * `expo-font` (via `@expo-google-fonts/noto-sans` and `@expo-google-fonts/inter`)
 * in the app root — see `apps/mobile/app/_layout.tsx`. Kept as data-only string
 * constants here (no expo-font/react-native import) so this package stays
 * framework-light; the app is responsible for actually loading the font files.
 */
export const fontFamilies = {
  notoSansRegular: "NotoSans_400Regular",
  notoSansMedium: "NotoSans_500Medium",
  notoSansSemiBold: "NotoSans_600SemiBold",
  notoSansBold: "NotoSans_700Bold",
  interSemiBold: "Inter_600SemiBold",
  /**
   * Заголовки гастрогида «Editorial v2» (Figma 3z0f6dgev4HMwBAHPjTjPo,
   * node 3192:6246): слоган шапки и все заголовки секций нарисованы
   * Playfair Display Italic. Это ЕДИНСТВЕННЫЙ раздел приложения с засечками —
   * гастрогид в новом макете подан как журнал, а не как каталог.
   */
  playfairDisplayItalic: "PlayfairDisplay_400Regular_Italic",
  /**
   * Заголовки страницы бренда в гастрогиде (node 3424:3927, «Ocean Basket»):
   * Cormorant Garamond Bold. Отдельная гарнитура от Playfair: это страница
   * бренда, и макет даёт ей свою типографику.
   */
  cormorantGaramondBold: "CormorantGaramond_700Bold",
  /** Текст страницы бренда (node 3424:3927) — Montserrat в четырёх начертаниях. */
  montserratRegular: "Montserrat_400Regular",
  montserratMedium: "Montserrat_500Medium",
  montserratSemiBold: "Montserrat_600SemiBold",
  montserratBold: "Montserrat_700Bold",
} as const;

export type FontFamilyToken = typeof fontFamilies;
