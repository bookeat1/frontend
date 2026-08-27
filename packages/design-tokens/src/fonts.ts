/**
 * Font family name constants. These are the exact family names registered by
 * `expo-font` (via `@expo-google-fonts/noto-sans`, `@expo-google-fonts/inter`,
 * `@expo-google-fonts/playfair-display`, `@expo-google-fonts/cormorant-garamond`
 * and `@expo-google-fonts/montserrat`)
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
   * Playfair Display Bold Italic. Макет ставит это начертание в двух местах:
   *  - НАЗВАНИЕ СОБЫТИЯ в списке «Афиша» и на карточке афиши
   *    (Figma 3z0f6dgev4HMwBAHPjTjPo, узлы 3452:13369 и 3452:13244);
   *  - ИМЯ ЗАВЕДЕНИЯ на карточке списка (node 3452:13349 — 18) и в шапке
   *    карточки заведения (node 3446:12640 — 28/38).
   * Всё остальное в каталоге набирается Noto Sans / Inter; засечки за его
   * пределами есть только в гастрогиде — см. `playfairDisplayItalic` и
   * `cormorantGaramondBold` ниже.
   *
   * Курсив задан САМИМ НАЧЕРТАНИЕМ (файл `700Bold_Italic`), а не
   * `fontStyle: "italic"`. Ставить их вместе нельзя: Android наклонил бы уже
   * наклонный шрифт второй раз, синтетически.
   *
   * Кириллица в файле есть — проверено по таблице cmap (Б, ж, я, Ё, тире,
   * средняя точка на месте), названия событий и заведений у нас русские.
   */
  playfairDisplayBoldItalic: "PlayfairDisplay_700Bold_Italic",
  /**
   * Заголовки гастрогида «Editorial v2» (Figma 3z0f6dgev4HMwBAHPjTjPo,
   * node 3192:6246): слоган шапки и все заголовки секций нарисованы
   * Playfair Display Italic. Гастрогид в новом макете подан как журнал, а не
   * как каталог, поэтому засечки здесь идут сплошь.
   *
   * ЭТО ДРУГОЕ НАЧЕРТАНИЕ, а не дубль `playfairDisplayBoldItalic`: там Bold
   * (700) для названий заведений и событий, здесь Regular (400) для
   * журнальных заголовков гастрогида. Оба файла грузятся одним `useFonts`.
   * Курсив — тоже самим начертанием, без `fontStyle: "italic"`.
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
