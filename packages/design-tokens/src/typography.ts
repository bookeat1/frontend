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
   * «Афиша», «Статьи», «Выберите кухню», «Подборки») — 17/24 Bold, разрядка
   * -0.3.
   *
   * ЗДЕСЬ КОД НАМЕРЕННО РАСХОДИТСЯ С МАКЕТОМ. В Figma
   * 3z0f6dgev4HMwBAHPjTjPo (узлы 3102:12008, 3102:12025, 3102:12041,
   * 3228:9821, 3102:12120) заголовок секции нарисован 20/28. Мы держим 17/24
   * сознательно — не потому, что не сверились с макетом.
   *
   * История значения (менялось трижды, отсюда эта простыня):
   *   1. Изначально по макету — 20/28.
   *   2. Уменьшили вручную до 17/24 (-0.3): на главной таких заголовков пять
   *      подряд, и в кегле 20 они забирали больше вертикали, чем карточки под
   *      ними. Тогда же «Афиша» осталась на 20 (через проп `size="large"` →
   *      `titleLg`), и пять заголовков ОДНОГО экрана стали разного размера —
   *      именно это рассогласование и запустило всю историю.
   *   3. 2026-08-26 подняли обратно к 20/28, разрядка 0, по макету и по
   *      тогдашнему правилу «следуем макету всегда» (коммит 747bcfa).
   *   4. 2026-08-27 вернули к 17/24 (-0.3): CEO посмотрел бету и сказал, что
   *      шрифт великоват. Живой экран весит больше, чем узел в Figma.
   *
   * Что НЕ надо делать следующему, кто откроет макет и увидит 20: молча
   * «починить» обратно. Значение уже прошло полный круг. Если 20 всё-таки
   * нужны — это решение владельца/CEO по бете, а не по узлу, и меняется
   * вместе с этим комментарием, тестом
   * `packages/design-tokens/src/__tests__/typography.test.ts` и макетом.
   *
   * Кегль ОДИН на главную и на гастрогид: проп `size` у `SectionHeader` не
   * возвращаем (см. его комментарий) — именно из-за него экран разъехался
   * внутри себя. Остальные правки 747bcfa (SemiBold у названий карточек,
   * 14/20 у подписей кухонь и плашки скидки, круг кухни 96, перенос
   * приветствия, обложки 206) остаются в силе — уменьшен только этот кегль.
   */
  titleSection: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.3,
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
  /* ------------------------------------------------------------------ *
   * ГАСТРОГИД — «Editorial v2» (Figma 3z0f6dgev4HMwBAHPjTjPo,
   * node 3192:6246) и страница бренда (node 3424:3927).
   *
   * ПОЧЕМУ ОТДЕЛЬНАЯ ГРУППА, А НЕ ПЕРЕИСПОЛЬЗОВАНИЕ ОБЩИХ РОЛЕЙ. Гастрогид в
   * новом макете набран журнально: заголовки — Playfair Display Italic,
   * подписи — золото на фотографии, кегли 10/11/13, которых в остальном
   * приложении нет. Подмешать это в `titleSection`/`caption` значило бы
   * утащить журнальный вид на главную и в поиск.
   *
   * ПРО МЕЖДУСТРОЧНЫЙ ИНТЕРВАЛ. В макете у большинства надписей стоит
   * `leading: normal`, то есть автоматический интервал шрифта. Значения ниже
   * взяты не на глаз: три надписи шапки измерены по узлам
   * (3192:6254 — 11 pt даёт 13, 3192:6255 — 36 pt Playfair даёт 48,
   * 3192:6256 — явные 20) и «Смотреть все» (3192:6261 — 13 pt даёт 16).
   * Отсюда два коэффициента автоинтервала: 1.2 для SF Pro (у нас Noto Sans)
   * и 1.333 для Playfair. Остальные строки посчитаны ими же.
   * ------------------------------------------------------------------ */

  /** Надпись над слоганом шапки — «BOOKEAT GUIDE · АЛМАТЫ» (node 3192:6254):
   * 11/13 SemiBold с разрядкой 0.88, золотом по фотографии. */
  guideHeroEyebrow: {
    fontFamily: fontFamilies.notoSansSemiBold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.88,
  },
  /** Слоган шапки гастрогида (node 3192:6255) — Playfair Display Italic 36/48.
   * Самый крупный текст приложения после него ничего нет. */
  guideHeroHeadline: {
    fontFamily: fontFamilies.playfairDisplayItalic,
    fontSize: 36,
    lineHeight: 48,
  },
  /** Строка под слоганом (node 3192:6256) — 15/20 Regular, интервал в макете
   * задан явно. */
  guideHeroSubline: {
    fontFamily: fontFamilies.notoSansRegular,
    fontSize: 15,
    lineHeight: 20,
  },
  /** Заголовок секции гастрогида — «Рубрики», «Выбор редакции»,
   * «Гастропрогулки» (узлы 3192:6260, 3192:6265, 3192:6273): Playfair Display
   * Italic 24/32. */
  guideSectionTitle: {
    fontFamily: fontFamilies.playfairDisplayItalic,
    fontSize: 24,
    lineHeight: 32,
  },
  /** Надпись «ЕДА»/«МЕСТА» на плитке рубрики (node 3192:6099) — 10/12
   * SemiBold, разрядка 0.8. */
  guideRubricEyebrow: {
    fontFamily: fontFamilies.notoSansSemiBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.8,
  },
  /** Название на плитке рубрики (node 3192:6100) — 13/16 SemiBold. */
  guideRubricTitle: {
    fontFamily: fontFamilies.notoSansSemiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  /** Надпись над названием на большой карточке (node 3192:6268) — 11/13
   * SemiBold с разрядкой 0.88. Тот же кегль, что у шапки, но своя роль. */
  guideCardEyebrow: {
    fontFamily: fontFamilies.notoSansSemiBold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.88,
  },
  /** Название на большой карточке (узлы 3192:6269, 3192:6277) — 16/19 Bold. */
  guideCardTitle: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 16,
    lineHeight: 19,
  },
  /** Строка под названием «Выбора редакции» (node 3192:6270) — 13/16 Regular. */
  guideCardMeta: {
    fontFamily: fontFamilies.notoSansRegular,
    fontSize: 13,
    lineHeight: 16,
  },
  /** Описание на карточке гастропрогулки (node 3192:6278) — 14/17 Regular. */
  guideCardBody: {
    fontFamily: fontFamilies.notoSansRegular,
    fontSize: 14,
    lineHeight: 17,
  },

  /* --- Страница бренда в гастрогиде (node 3424:3927, «Ocean Basket») --- */

  /** Заголовок секции страницы бренда (узлы 3426:9632, 3427:12239,
   * 3441:12380) — Cormorant Garamond Bold 24/32. */
  brandSectionTitle: {
    fontFamily: fontFamilies.cormorantGaramondBold,
    fontSize: 24,
    lineHeight: 32,
  },
  /** Крупная надпись блока брони (node 3443:12585) — Cormorant Garamond Bold
   * 29/39. */
  brandTitleLg: {
    fontFamily: fontFamilies.cormorantGaramondBold,
    fontSize: 29,
    lineHeight: 39,
  },
  /** Заголовок карточки главы истории (node 3443:12477) — Cormorant Garamond
   * Bold 18/24. */
  brandTitleSm: {
    fontFamily: fontFamilies.cormorantGaramondBold,
    fontSize: 18,
    lineHeight: 24,
  },
  /** Разряженная надпись-рубрика («КАРТА ПРИКЛЮЧЕНИЙ», node 3425:3939) —
   * Montserrat Medium 14/17 с разрядкой 2.52. */
  brandEyebrow: {
    fontFamily: fontFamilies.montserratMedium,
    fontSize: 14,
    lineHeight: 17,
    letterSpacing: 2.52,
  },
  /** Город над названием точки (node 3441:12292) — Montserrat Medium 13/16
   * с разрядкой 1.04. */
  brandVenueCity: {
    fontFamily: fontFamilies.montserratMedium,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 1.04,
  },
  /** Название точки (node 3441:12293) — Montserrat SemiBold 16/19. */
  brandVenueName: {
    fontFamily: fontFamilies.montserratSemiBold,
    fontSize: 16,
    lineHeight: 19,
  },
  /** Подпись главы («ГЛАВА 1 · КЕЙПТАУН · ЮАР», node 3443:12476) —
   * Montserrat Medium 12/20 с разрядкой 1.2. */
  brandChapterLabel: {
    fontFamily: fontFamilies.montserratMedium,
    fontSize: 12,
    lineHeight: 20,
  },
  /** Обычный текст страницы бренда (узлы 3427:12240, 3443:12580) —
   * Montserrat Regular 14/17. */
  brandBody: {
    fontFamily: fontFamilies.montserratRegular,
    fontSize: 14,
    lineHeight: 17,
  },
  /** Мелкая подпись страницы бренда (узлы 3441:12381, 3441:12382) —
   * Montserrat Regular 12/22. Интервал задан в макете явно. */
  brandCaption: {
    fontFamily: fontFamilies.montserratRegular,
    fontSize: 12,
    lineHeight: 22,
  },
  /** Подпись на кнопке страницы бренда (node 3443:12587) — Montserrat
   * SemiBold 14/17. */
  brandButtonLabel: {
    fontFamily: fontFamilies.montserratSemiBold,
    fontSize: 14,
    lineHeight: 17,
  },

  /** Promo banner caption over the photo — the one place the design uses Inter. */
  bannerCaption: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
} as const;

export type TypographyToken = typeof typography;
