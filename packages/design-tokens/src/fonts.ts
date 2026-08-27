/**
 * Font family name constants. These are the exact family names registered by
 * `expo-font` (via `@expo-google-fonts/noto-sans`, `@expo-google-fonts/inter`
 * and `@expo-google-fonts/playfair-display`)
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
   * Playfair Display Bold Italic — единственная засечная гарнитура и
   * единственный курсив в приложении. Макет ставит её в двух местах:
   *  - НАЗВАНИЕ СОБЫТИЯ в списке «Афиша» и на карточке афиши
   *    (Figma 3z0f6dgev4HMwBAHPjTjPo, узлы 3452:13369 и 3452:13244);
   *  - ИМЯ ЗАВЕДЕНИЯ на карточке списка (node 3452:13349 — 18) и в шапке
   *    карточки заведения (node 3446:12640 — 28/38).
   * Всё остальное набирается Noto Sans / Inter.
   *
   * Курсив задан САМИМ НАЧЕРТАНИЕМ (файл `700Bold_Italic`), а не
   * `fontStyle: "italic"`. Ставить их вместе нельзя: Android наклонил бы уже
   * наклонный шрифт второй раз, синтетически.
   *
   * Кириллица в файле есть — проверено по таблице cmap (Б, ж, я, Ё, тире,
   * средняя точка на месте), названия событий и заведений у нас русские.
   */
  playfairDisplayBoldItalic: "PlayfairDisplay_700Bold_Italic",
} as const;

export type FontFamilyToken = typeof fontFamilies;
