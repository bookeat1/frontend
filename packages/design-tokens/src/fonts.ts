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
   * Playfair Display Bold Italic — акцентный НАБОРНЫЙ шрифт новых макетов:
   * название заведения на карточке списка (Figma 3z0f6dgev4HMwBAHPjTjPo,
   * node 3452:13349 — 18) и в шапке карточки заведения (node 3446:12640 —
   * 28/38). Единственная начертанием засечная гарнитура в приложении: ею
   * набирается ТОЛЬКО имя места, всё остальное остаётся Noto Sans.
   */
  playfairDisplayBoldItalic: "PlayfairDisplay_700Bold_Italic",
} as const;

export type FontFamilyToken = typeof fontFamilies;
