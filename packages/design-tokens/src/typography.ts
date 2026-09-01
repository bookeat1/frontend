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
  /**
   * Название заведения НА фотографии карточки списка — Playfair Display Bold
   * Italic 18 (Figma 3z0f6dgev4HMwBAHPjTjPo, node 3452:13349/3452:13393).
   * В макете межстрочный «normal»; для Playfair это ~1.33 кегля, отсюда 24.
   *
   * Отдельная роль, а не `titleSm`: у карточки нового вида имя лежит поверх
   * снимка засечной курсивной гарнитурой, и это единственное место списка,
   * где она появляется.
   */
  displayCard: {
    fontFamily: fontFamilies.playfairDisplayBoldItalic,
    fontSize: 18,
    lineHeight: 24,
  },
  /**
   * Название заведения в ШАПКЕ карточки заведения — Playfair Display Bold
   * Italic 28/38 (node 3446:12640). Та же гарнитура, что на карточке списка,
   * на ступень крупнее: список и деталка должны читаться как одно место.
   */
  displayHero: {
    fontFamily: fontFamilies.playfairDisplayBoldItalic,
    fontSize: 28,
    lineHeight: 38,
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
  /**
   * Подпись КОЛОНКИ в шторке «Дата и гости» — «Когда» и «Гости» (Figma
   * 3z0f6dgev4HMwBAHPjTjPo, узлы 3447:13056 и 3447:13058): 14 Medium, но
   * интерлиньяж 24, а не 20. Отдельный токен, а не `labelMedium`: кегль тот
   * же, а высота строки в макете другая, и именно она задаёт просвет до
   * первой строки колеса под подписью.
   */
  columnLabel: {
    fontFamily: fontFamilies.notoSansMedium,
    fontSize: 14,
    lineHeight: 24,
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
  /**
   * Заголовок карточки брони в новом списке — «Flour Demi · 9 июня, 10:30»
   * (Figma 3z0f6dgev4HMwBAHPjTjPo, узлы 3589:8247 и I3589:8529;3589:8488:
   * Noto Sans Medium 18/24.52).
   *
   * НЕ `displayCard`: там 18 той же высоты, но засечным курсивом Playfair —
   * так набрано ИМЯ МЕСТА на карточке каталога. Здесь в строке имя вместе с
   * датой, и макет ставит основную гарнитуру. Межстрочный округлён до целого,
   * как и у остальных токенов.
   */
  bookingCardTitle: {
    fontFamily: fontFamilies.notoSansMedium,
    fontSize: 18,
    lineHeight: 25,
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
   * а межстрочный задан как «normal» — для Playfair Display в 18 pt это ~24.
   *
   * Гарнитура — Playfair Display Bold Italic, как нарисовано (решение
   * владельца 2026-08-27: «шрифт добавляем, делаем как по макету»).
   *
   * МАКЕТ ЗДЕСЬ НЕПОСЛЕДОВАТЕЛЕН, и мы это НЕ копируем: две карточки из трёх
   * (3452:13369, 3452:13373) нарисованы Playfair, третья (3452:13221) —
   * Noto Sans Bold. Все карточки списка идут через ЭТОТ токен, то есть
   * набраны одинаково: разный шрифт у соседних карточек одного списка читался
   * бы как разный вид материала, а не как оформительский приём.
   */
  eventCardTitle: {
    fontFamily: fontFamilies.playfairDisplayBoldItalic,
    fontSize: 18,
    lineHeight: 24,
  },
  /**
   * Название события на кадре КАРТОЧКИ АФИШИ — 28/38 (node 3452:13244).
   * Крупнее всего остального в приложении вместе с `titleXxl` (24/32), потому
   * что лежит на фотографии во весь экран.
   *
   * Гарнитура — Playfair Display Bold Italic, как в макете.
   */
  eventHeroTitle: {
    fontFamily: fontFamilies.playfairDisplayBoldItalic,
    fontSize: 28,
    lineHeight: 38,
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
  /**
   * Заголовок секции гастрогида — «Рубрики», «Выбор редакции»,
   * «Гастропрогулки» (узлы 3492:13477, 3492:13479, 3492:13486, и тот же
   * заголовок на экране рубрики — 3492:13743): Bold 20/28.
   *
   * БЫЛО Playfair Display Italic 24/32 (узлы 3192:6260, 3192:6265, 3192:6273).
   * Макет переписан: старые текстовые узлы заменены новыми (номера 3492:*),
   * и засечки из заголовков секций убраны. Журнальная типографика осталась
   * ровно там, где её нарисовали: слоган шапки (`guideHeroHeadline`) и
   * страница бренда. Заголовок секции теперь набран тем же шрифтом, что и
   * весь каталог, — это сознательное сближение гастрогида с остальным
   * приложением, а не потеря правки.
   */
  guideSectionTitle: {
    fontFamily: fontFamilies.notoSansBold,
    fontSize: 20,
    lineHeight: 28,
  },
  /**
   * Ссылка «Смотреть все» справа от заголовка секции гастрогида
   * (node 3192:6261) — 13 SemiBold. Высота строки в макете «normal»; берём 16
   * — ровно та высота, которую макет проставил самому узлу (91×16).
   *
   * Свой токен, а не `captionMedium` (12/16 Medium): у ссылки другой кегль и
   * другая насыщенность, и правка подписей каталога не должна её двигать.
   */
  guideSectionLink: {
    fontFamily: fontFamilies.notoSansSemiBold,
    fontSize: 13,
    lineHeight: 16,
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
    // Разрядка 1.2 из макета. Её здесь не было, пока подпись главы никто не
    // рисовал: токен завели по узлу, но значение letterSpacing потеряли.
    letterSpacing: 1.2,
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

  /* --- Фирменная страница Ocean Basket (node 3424:3927) --- */

  /** «WELCOME DRINK» в шапке (node 3425:3946) — Montserrat SemiBold 13/15.85
   * с разрядкой 1.56. */
  brandPromoLabel: {
    fontFamily: fontFamilies.montserratSemiBold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 1.56,
  },
  /** «Подробнее» рядом с ней (node 3425:3948) — Montserrat Regular 13/15.85. */
  brandPromoAction: {
    fontFamily: fontFamilies.montserratRegular,
    fontSize: 13,
    lineHeight: 16,
  },
  /** Название блюда «Фирменного улова» (node 3441:12387) — Montserrat
   * SemiBold 14/18. */
  brandDishName: {
    fontFamily: fontFamilies.montserratSemiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  /** Цена под ним (node 3441:12388) — Montserrat Regular 12.5/19. Кегль
   * дробный именно так и нарисован. */
  brandDishPrice: {
    fontFamily: fontFamilies.montserratRegular,
    fontSize: 12.5,
    lineHeight: 19,
  },
  /** Разряженная надпись «ИСТОРИЯ БРЕНДА» (node 3443:12463) — Montserrat
   * Medium 16/19.5. Разрядка в макете набрана ПРОБЕЛАМИ внутри строки, а не
   * `letterSpacing`; в коде её делает `spacedOut`, см. ocean-basket-content. */
  brandStoryHeading: {
    fontFamily: fontFamilies.montserratMedium,
    fontSize: 16,
    lineHeight: 20,
  },
  /** Текст раскрытой главы (node 3443:12605) — Noto Sans Regular 16/21.8.
   * Гарнитура здесь ДРУГАЯ, чем у остального экрана, и это макет, а не
   * недосмотр: главу набрали основным шрифтом приложения. */
  brandStoryBody: {
    fontFamily: fontFamilies.notoSansRegular,
    fontSize: 16,
    lineHeight: 22,
  },
  /** Номер точки на карточке (node 3441:12295) — Montserrat Bold 14/17. */
  brandVenueBadge: {
    fontFamily: fontFamilies.montserratBold,
    fontSize: 14,
    lineHeight: 17,
  },
  /** Пилюля «Welcome drink» на карточке точки (node 3441:12299) — Montserrat
   * SemiBold 12/14.6. */
  brandVenueTag: {
    fontFamily: fontFamilies.montserratSemiBold,
    fontSize: 12,
    lineHeight: 15,
  },
  /** Мелкая подпись с ПЛОТНЫМ интервалом — «хиты меню» (node 3441:12381) и
   * строка под ником инстаграма (node 3443:12580): Montserrat Regular
   * 12/14.6. Это НЕ `brandCaption`: там тот же кегль, но интервал 22,
   * заданный в макете отдельно (node 3441:12382). */
  brandCaptionTight: {
    fontFamily: fontFamilies.montserratRegular,
    fontSize: 12,
    lineHeight: 15,
  },
  /** «…в твоей тарелке» (node 3443:12572) — Cormorant Garamond Bold 20/24. */
  brandClosingTitle: {
    fontFamily: fontFamilies.cormorantGaramondBold,
    fontSize: 20,
    lineHeight: 24,
  },
  /** Разряженная надпись замыкающего блока и «ПРОДОЛЖЕНИЕ СЛЕДУЕТ»
   * (узлы 3443:12584, 3443:12571) — Montserrat Medium 13/15.85. */
  brandSpacedLabel: {
    fontFamily: fontFamilies.montserratMedium,
    fontSize: 13,
    lineHeight: 16,
  },

  /** Promo banner caption over the photo — the one place the design uses Inter. */
  bannerCaption: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: 12,
    lineHeight: 16,
  },
} as const;

export type TypographyToken = typeof typography;
