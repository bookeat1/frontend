import { fontFamilies } from "./fonts";

/**
 * Type scale verified against Figma node 340:2535 and the search/photo
 * screens. Every role maps 1:1 to a text style actually used in the design —
 * do not add sizes that aren't backed by a real node.
 */
export const typography = {
  /** Home greeting «Куда сегодня, Камила?» (node 986:8720) — the largest type
   * in the app, and the only place that uses it. */
  titleXxl: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 24,
    lineHeight: 32,
  },
  /** Venue name on the Reservation detail screen (node 488:9876) — the one
   * place the design goes above 20pt. */
  titleXl: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  /** Section/screen titles: "Flour Demi", "О ресторане", "Популярное в меню", "Контакты". */
  titleLg: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  /**
   * Заголовок секции на главной и на гастрогиде («Выбрали для вас», «Акции»,
   * «Афиша», «Статьи», «Выберите кухню», «Подборки») — 20/28 Bold.
   *
   * Значения сверены по Figma 3z0f6dgev4HMwBAHPjTjPo, узлы 3102:12008,
   * 3102:12025, 3102:12041, 3228:9821, 3102:12120 (правка владельца
   * 2026-08-26). До этого здесь стояло 17/24 с разрядкой -0.3 — заголовки
   * когда-то намеренно уменьшили, чтобы пять подряд занимали меньше места,
   * и главная разошлась с макетом, а «Афиша» позже вернулась к 20 и разошлась
   * с четырьмя соседями.
   *
   * Разрядка 0: четыре из пяти узлов главной стоят на нуле. Пятый
   * («Выбрали для вас») и «Подборки» гастрогида — на -0.25; разница в
   * четверть точки не стоит второго токена, но она есть, и это расхождение
   * ВНУТРИ макета, а не наша вольность.
   */
  titleSection: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 0,
  },
  /** Card headings on the Reservation detail screen ("What happens next?",
   * "Contacts") — bold 18, one step below the venue name (node 488:9876). */
  titleCard: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  /** Screen header titles ("Фотографии") and photo counter ("4 из 6"). */
  titleMd: {
    fontFamily: fontFamilies.notoSansSemiBold,
    fontSize: 16,
    lineHeight: 24,
  },
  /** Restaurant name in search result cards. */
  titleSm: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 16,
    lineHeight: 24,
  },
  /**
   * Menu item name / price — pure black in the design, see colors.text.strong.
   *
   * Он же — НАЗВАНИЕ КАРТОЧКИ на главной: «Flour Demi» (3102:12015),
   * «Кальян-рейв в Mongol» (3102:12050), «Куда сходить на неделе»
   * (3102:12127) и «BBQ-бранч» в строке «Афиши» (3228:9830) — все четыре
   * в макете 16/24 весом 590, то есть SemiBold. Три из них до 2026-08-26
   * рисовались `titleSm` (тот же кегль, но Bold) и были жирнее «Афиши»,
   * стоящей рядом на том же экране.
   */
  itemName: {
    fontFamily: fontFamilies.notoSansSemiBold,
    fontSize: 16,
    lineHeight: 24,
  },
  /** Active tab label, button labels, chip labels ("Открыто до 23:00", "Забронировать стол"). */
  labelSemiBold: {
    fontFamily: fontFamilies.notoSansSemiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  /** Hours/phone/address primary line, selected search chip label. */
  labelMedium: {
    fontFamily: fontFamilies.notoSansMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  /** Description copy, inactive tab label, address line. */
  body: {
    fontFamily: fontFamilies.notoSansRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  /** Search-chip small labels ("Казахская кухня", "12 000–20 000 ₸"). */
  captionMedium: {
    fontFamily: fontFamilies.notoSansMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  /** Muted captions: hours subtext, phone/address subtext, menu item description. */
  caption: {
    fontFamily: fontFamilies.notoSansRegular,
    fontSize: 12,
    lineHeight: 16,
  },
  /**
   * Число даты в строке «Афиши» на главной — 32/34 Bold (Figma
   * 3z0f6dgev4HMwBAHPjTjPo, node 3228:9826). Самый крупный элемент карточки:
   * гость сначала спрашивает «когда», и в макете число читается первым.
   */
  dateNumber: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 32,
    lineHeight: 34,
  },
  /**
   * Месяц под числом — 10/14 SemiBold заглавными с разрядкой 1 (node
   * 3228:9827). Разрядка обязательна: без неё заглавные в 10 pt слипаются.
   */
  dateMonth: {
    fontFamily: fontFamilies.notoSansSemiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
  },
  /** Bottom-nav labels. */
  navLabel: {
    fontFamily: fontFamilies.notoSansRegular,
    fontSize: 10,
    lineHeight: 14,
  },
  /** Promo banner caption over the photo — the one place the design uses Inter. */
  bannerCaption: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
} as const;

export type TypographyToken = typeof typography;
