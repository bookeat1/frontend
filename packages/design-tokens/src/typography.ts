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
  /**
   * Название события НА КАДРЕ карточки списка «Афиша» — 18 (Figma
   * 3z0f6dgev4HMwBAHPjTjPo, node 3452:13369). Отдельный токен, а не
   * `titleCard` (18/26, разрядка −0.3): в макете у этой строки нет разрядки,
   * а межстрочный задан как «normal» — для Noto Sans в 18 pt это ~24.
   *
   * ШРИФТ РАСХОДИТСЯ С МАКЕТОМ ОСОЗНАННО. В Figma здесь Playfair Display Bold
   * Italic; в приложение эта гарнитура не загружена (грузятся только Noto Sans
   * и Inter — см. `apps/mobile/app/_layout.tsx`), и её добавление — это новая
   * зависимость и решение владельца, а не правка отступов. Сам макет
   * непоследователен: третья карточка того же экрана (node 3452:13221)
   * нарисована Noto Sans Bold. До решения держим Noto Sans Bold.
   */
  eventCardTitle: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 18,
    lineHeight: 24,
  },
  /**
   * Название события на кадре КАРТОЧКИ АФИШИ — 28/38 (node 3452:13244).
   * Крупнее всего остального в приложении вместе с `titleXxl` (24/32), потому
   * что лежит на фотографии во весь экран.
   *
   * Шрифт — то же расхождение, что и у `eventCardTitle`: в макете Playfair
   * Display Bold Italic, в приложении её нет.
   */
  eventHeroTitle: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 28,
    lineHeight: 38,
  },
  /** Promo banner caption over the photo — the one place the design uses Inter. */
  bannerCaption: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
} as const;

export type TypographyToken = typeof typography;
