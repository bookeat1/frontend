/** 4pt base spacing scale. Never hardcode raw numbers in screens — use these. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

/**
 * Corner radii — verified against Figma node 340:2535 and sibling screens.
 * Named by the role they play, not by their pixel value.
 */
export const radius = {
  /** Chips, pill buttons, icon buttons, the search input. */
  pill: 999,
  /**
   * Плавающая плашка нижней навигации (Figma 3z0f6dgev4HMwBAHPjTjPo,
   * node 3039:23943 — `rounded-[36px]`). Отдельный токен, а не `pill`:
   * в макете это конкретные 36. При высоте плашки 58 RN всё равно обрежет
   * радиус до половины высоты (29), поэтому визуально это капсула — но
   * значение остаётся тем, что нарисовано.
   */
  navBar: 36,
  /** Cards: menu item photos, promo banners, map preview, search result photo. */
  card: 20,
  /** The single largest photo on screen — restaurant cover photo only. */
  photoHero: 24,
  /** Rounded-square venue avatar at the top of the Reservation detail screen
   * (node 488:9876) — a squircle, not a circle. */
  avatar: 18,
  /** Confirmation dialog sheet. */
  dialog: 24,
  /**
   * Карточка брони в списке «Мои брони» (Figma dVjT37j984ErvOmzxlx29p,
   * node 3004:6807 — `rounded-[24px]`). Отдельный токен, а не `dialog`:
   * значение совпадает, но роль другая, и диалог не должен тянуть за собой
   * карточку списка, если один из двух радиусов поменяют.
   */
  bookingCard: 24,
  /** Photo inside a horizontally scrolling Explore card (restaurant, dish,
   * event). Measured on `design-ref/screen-explore.png`: the corner curve of
   * the event photo runs 15px at 1:1 frame scale. */
  media: 16,
  /**
   * Белый блок содержимого на сером листе экрана «Статьи»
   * (Figma dVjT37j984ErvOmzxlx29p, node 1001:11921 — `rounded-[24px]` у блока
   * заведения, `rounded-b-[24px]` у шапки статьи). Отдельный токен, а не
   * `dialog`/`photoHero`: значение совпадает, но роль другая — это лист
   * содержимого, и правка радиуса диалога не должна тянуть за собой статью.
   */
  contentBlock: 24,
  /**
   * Белый блок раздела главной («Выбрали для вас», «Афиша», «Акции») — 24
   * (Figma 3z0f6dgev4HMwBAHPjTjPo, узлы 3102:12006, 3102:12024, 3102:12039,
   * 3228:9819: у всех `cornerRadius: 24`). Отдельный токен, а не `card` (20):
   * блок раздела — это лист, на котором лежат карточки, и радиус самой
   * карточки не должен тянуть его за собой.
   */
  homeSection: 24,
  /**
   * Поле ввода даты рождения на регистрации (Figma
   * 3z0f6dgev4HMwBAHPjTjPo, node 3073:11656 — `rounded-[16px]`). Отдельный
   * токен, а не `media`: значение совпадает, но роль другая.
   */
  field: 16,
  /**
   * Нижние углы шапки гастрогида — 28 (Figma 3z0f6dgev4HMwBAHPjTjPo,
   * node 3192:6247, `rounded-b-[28px]`). Отдельный токен, а не `contentBlock`
   * (24): в макете это именно 28, и шапка — единственное место с этим
   * радиусом.
   */
  guideHero: 28,
  /**
   * Плитка рубрики в ряду гастрогида — 22 (node 3192:6097). Между `card` (20)
   * и `contentBlock` (24), и это не описка макета: у всех четырёх плиток
   * `rounded-[22px]`.
   */
  guideRubric: 22,
  /**
   * Большая карточка гастрогида — «Выбор редакции» и «Гастропрогулка»
   * (узлы 3192:6266, 3192:6275, 3192:6279) — 24. Отдельный токен, а не
   * `contentBlock`: значение совпадает, но роль другая. Здесь это САМА
   * карточка с фотографией, а не белый лист под карточками, и правка радиуса
   * листа не должна её тянуть.
   */
  guideCard: 24,
  /** Карточки страницы бренда (узлы 3441:12289, 3443:12468, 3443:12573) — 16. */
  brandCard: 16,
  /** Карта и блок брони на странице бренда (узлы 3426:9633, 3443:12583) — 22. */
  brandBlock: 22,
  /** Пилюля-рубрика в шапке страницы бренда (node 3425:3935) — 19. */
  brandPill: 19,
} as const;

/** Minimum hit-slop / touch target per accessibility hard rule (>= 44pt). */
export const hitSlop = {
  minTouchTarget: 44,
} as const;

/**
 * Fixed control heights the design states explicitly. Verified against the
 * Reservation screen (Figma file oPxXynSOY3PYhf3gkVR5Ps, node 471:3880).
 */
export const controlHeight = {
  /** Date/guests pill selectors (471:3899), time slots (471:3914) and the
   * sticky flow CTA (471:3967) are all 48 tall. */
  pill: 48,
  /**
   * Чип-фильтр под строкой поиска — 40 (Figma 3z0f6dgev4HMwBAHPjTjPo,
   * node 347:5942, кадры «Frame 45»/«Frame 46»: высота 40, скругление 999,
   * подложка #F3F2F2).
   *
   * Меньше жёсткого минимума в 44, и это НЕ послабление правила: чип лежит в
   * горизонтальной прокрутке, и до 44 его зона касания добирается hitSlop'ом
   * (см. `FilterChip`) — ровно так же, как у 28-точечных пилюль карточек
   * Explore (`compactPill`). Рисуем то, что нарисовано, пальцем попадаем в 48.
   */
  chip: 40,
  /** "Special Requests" textarea (471:3946). */
  multilineField: 80,
  /** Dish photo in the pre-order list. Measured off the design render
   * `design-ref/screen-menu-preorder.png` (120x80) — that screen has no
   * value-by-value spec yet, so this is a read of the render, not a node. */
  dishPhotoHeight: 80,
  dishPhotoWidth: 120,
  /** Venue avatar on the Reservation detail screen (node 488:9876) — 72x72
   * rounded square, optically centred under the header. */
  venueAvatar: 72,
  /** Circular contact icon button (website / WhatsApp / Instagram). */
  contactIcon: 48,
  /** Map preview block on the Reservation detail screen. */
  mapPreview: 208,
  /** Status pill height — 32 tall with 12/6 padding in the design. */
  statusPill: 32,
  /**
   * Квадратная фотография заведения в строке «Мои брони»
   * (node 3004:6810) — 64x64 со скруглением `radius.card` (20).
   */
  bookingVenueThumb: 64,
  /** Explore card pills: the red time-slot pill on a restaurant card and the
   * grey tag chip on an event card are both 28 tall
   * (`design-ref/screen-explore.png`). They are inside a horizontally
   * scrolling card, so the 44pt rule is met with hitSlop, not with height. */
  compactPill: 28,
} as const;

/**
 * Fixed block sizes of the Explore (home) screen, measured on
 * `design-ref/screen-explore.png` at 1:1 (the render's device frame is exactly
 * 375 wide). No value-by-value Figma spec exists for this screen yet, so these
 * are reads of the render.
 */
export const exploreLayout = {
  /** Full-bleed hero carousel. 245 of it is visible; the last 20 sit behind
   * the white sheet, which overlaps them with its rounded top corners. */
  heroHeight: 265,
  sheetOverlap: 20,
  /** Horizontally scrolling card. At 256 only one card and a sliver of the
   * next fitted on a 390-wide phone, and the rail read as a single venue with
   * something cut off behind it. 200 + 8 gap shows two whole cards and the
   * third clearly peeking — the point of a rail is that there is more in it. */
  cardWidth: 200,
  cardPhotoHeight: 120,
  /**
   * Круг с фотографией кухни в ряду «Выберите кухню».
   *
   * 96 — размер из макета (3z0f6dgev4HMwBAHPjTjPo, ячейки 3106:12348 и
   * соседние). Прежние 72 были сняты с отрендеренного экрана, а не с макета,
   * и держались только потому, что так помещалось ~4 кружка вместо ~3.
   * Владелец выбрал макет (2026-08-26): кухню выбирают по картинке, и её
   * читаемость дороже лишней половины кружка в ряду.
   */
  cuisineChip: 96,
  /**
   * Ширина ЯЧЕЙКИ ряда кухонь — она же ширина подписи под кругом. Круг
   * теперь тоже 96, то есть ячейка и круг совпали по ширине.
   *
   * Шире круга нарочно (правка владельца 2026-08-24: «Ср.морская»). Подпись
   * «Средиземноморская» — одно слово, переносить его не по чему, и в 72 оно
   * не влезало ни в одну строку: RN обрезал его многоточием. Сжатие шрифта
   * (`adjustsFontSizeToFit` в `CuisineChip`) даёт самому длинному названию
   * боевого каталога поместиться ЦЕЛИКОМ. Цена — на экране 360 видно ~3
   * кружка вместо ~3.9; обрезанное название стоит дороже.
   *
   * 96, а не прежние 84 (2026-08-26): столько в макете
   * (3z0f6dgev4HMwBAHPjTjPo, ячейки 3106:12348 и соседи), и подпись выросла
   * с 12/16 до нарисованных 14/20 — в 84 длинное название сжималось бы
   * сильнее прежнего.
   */
  cuisineChipLabel: 96,
  /**
   * Фотография события в строке «Афиши» на главной — 110x104 со скруглением
   * `radius.card` (Figma 3z0f6dgev4HMwBAHPjTjPo, node 3228:9840). Не квадрат:
   * в макете кадр шире, чем выше, и именно его высота задаёт высоту всей
   * строки (текст слева ниже и центрируется по ней).
   */
  eventThumbWidth: 110,
  eventThumbHeight: 104,
  /**
   * Высота СОДЕРЖАТЕЛЬНОЙ части шапки главной — того, что лежит НИЖЕ верхней
   * безопасной зоны устройства (Figma 3z0f6dgev4HMwBAHPjTjPo, node
   * 3102:11986: вся рамка шапки 308 при ширине 375, из них 44 занимает
   * статус-бар с часами и батареей → 308 − 44 = 264).
   *
   * Полная высота блока считается как «верхняя вставка + это число» —
   * см. `homeHeaderHeight()` в
   * `apps/mobile/src/components/explore/home-header-layout.ts`. Хранить тут
   * 308 было бы неверно: 44 — это статус-бар КОНКРЕТНОГО макетного
   * устройства, а на реальных он от 20 до 62.
   */
  headerContentHeight: 264,
} as const;

/**
 * Карточка ВЕРТИКАЛЬНОГО СПИСКА — экраны поиска, «Афиша», «Статьи»
 * (гастрогид), «Гастропрогулки». Одна цифра на все четыре: человек ходит
 * между этими списками по одной навигации, и разная высота обложки читалась
 * бы как разные виды карточек, а не как разный материал.
 */
export const listCard = {
  /**
   * Высота обложки — 206 (Figma 3z0f6dgev4HMwBAHPjTjPo, node 3192:6246
   * «Гастрогид — Editorial v2»: кадры 3192:6275 и 3192:6279 списка
   * «Гастропрогулки» — 343x206; соседний «Выбор редакции» 3192:6266 — 343x214).
   *
   * Было 148 в пяти местах подряд (RestaurantCard, EventListCard,
   * ArticleListCard, GuideRouteCard, ArticleCard variant=full) — число из
   * СТАРЫХ узлов (dVjT37j984ErvOmzxlx29p, 1100:7103 и соседи). Владелец
   * попросил 2026-08-26 привести поиск, афишу, статьи и ивенты к тому, что
   * нарисовано в гастрогиде, — это 206.
   *
   * Высота ФИКСИРОВАННАЯ, а не пропорция от ширины: в макете нарисована
   * конкретная высота, и на экране 360 пропорция дала бы 197, а на 430 — 236,
   * то есть ни на одном реальном телефоне не было бы значения из макета.
   * Ширину карточка по-прежнему берёт по месту (боковой отступ фотографии 8
   * на поиске и в афише — отдельная правка владельца от 2026-08-24, её этот
   * токен не трогает).
   */
  coverHeight: 206,
} as const;

/**
 * Раскладка гастрогида «Editorial v2» (Figma 3z0f6dgev4HMwBAHPjTjPo,
 * node 3192:6246). Числа, которых нет в шаге 4 pt (14, 22, 28, 118, 158, 206,
 * 214) — они нарисованы, и подгонять их к шкале значило бы рисовать не то,
 * что в макете.
 *
 * ПРО «20 ПРОТИВ 24» И ОТСТУП ФОТОГРАФИИ 8. Оба вопроса закрыты новым
 * макетом: скругление карточек гастрогида теперь 24 (`radius.guideCard`),
 * плиток рубрик — 22 (`radius.guideRubric`), а бокового отступа фотографии
 * внутри карточки больше нет вовсе — карточка занимает всю ширину контента,
 * а поля 16 стоят у листа целиком (`contentPaddingHorizontal`).
 */
export const guideLayout = {
  /**
   * Высота СОДЕРЖАТЕЛЬНОЙ части шапки — того, что ниже верхней безопасной
   * зоны (node 3192:6247: кадр 340 при статус-баре 44 → 340 − 44 = 296).
   * Хранить 340 нельзя: 44 — статус-бар макетного устройства, на реальных он
   * от 20 до 62.
   */
  heroContentHeight: 296,
  /** Блок слогана стоит на 24 от нижней кромки кадра (node 3192:6253:
   * y 223 + высота 93 = 316 при кадре 340). */
  heroCopyBottom: 24,
  /** Просвет между надписью-рубрикой, слоганом и строкой под ним — 6. */
  heroCopyGap: 6,
  /** Верхнее поле листа контента — 24, нижнее — 28 (node 3192:6257). */
  contentPaddingTop: 24,
  contentPaddingBottom: 28,
  /** Боковые поля листа контента — 16 (node 3192:6257). */
  contentPaddingHorizontal: 16,
  /** Просвет между секциями — 28 (node 3192:6257). */
  sectionGap: 28,
  /** Просвет между заголовком секции и её содержимым — 14 (узлы 3192:6258,
   * 3192:6263, 3192:6271). */
  sectionHeaderGap: 14,
  /** Просвет между двумя большими карточками в секции — тоже 14 (node
   * 3192:6271: карточка 3192:6275 стоит на 46, следующая 3192:6279 на 266
   * при высоте 206 → 266 − 46 − 206 = 14). Значение то же, что у
   * `sectionHeaderGap`, но роль другая: правка одного не должна двигать
   * второе. */
  cardGap: 14,
  /** Высота строки заголовка секции — 32 (node 3192:6259). */
  sectionHeaderHeight: 32,
  /** Плитка рубрики (node 3192:6097): 118×158, внутреннее поле 12, просвет
   * между надписями 2, просвет в ряду 8 (node 3192:6133: шаг 126 при ширине
   * 118). */
  rubricCardWidth: 118,
  rubricCardHeight: 158,
  rubricCardPadding: 12,
  rubricTextGap: 2,
  rubricGap: 8,
  /** Карточка «Выбора редакции» (node 3192:6266) — 214 высотой, поля 16/12,
   * просвет между строками 5. */
  editorPickHeight: 214,
  /** Карточка гастропрогулки (узлы 3192:6275, 3192:6279) — 206 высотой (то же
   * число, что `listCard.coverHeight`), просвет между строками 4. */
  cardPaddingHorizontal: 16,
  cardPaddingVertical: 12,
  editorPickTextGap: 5,
  walkTextGap: 4,
} as const;

/**
 * Раскладка страницы бренда в гастрогиде (node 3424:3927, «Ocean Basket»).
 */
export const brandPageLayout = {
  /** Шапка (node 3425:3926) — 357 при статус-баре 0 в макете; содержательная
   * часть считается от верхней безопасной зоны так же, как у гастрогида. */
  heroContentHeight: 357,
  /** Круглая кнопка поверх шапки (node 3427:12226) — 40×40. */
  heroControlSize: 40,
  /** Поля листа (node 3426:9631) — 16 по бокам, 27 сверху и снизу. */
  contentPaddingHorizontal: 16,
  contentPaddingVertical: 27,
  /** Просвет между секциями — 24 (node 3426:9631). */
  sectionGap: 24,
  /** Карта (node 3426:9633) — 240 высотой. */
  mapHeight: 240,
  /** Карточка точки (node 3441:12289): 292 шириной, фотография 215, просвет
   * в ряду 14. */
  venueCardWidth: 292,
  venueCardPhotoHeight: 215,
  venueCardGap: 14,
  /** Пилюля-рубрика в шапке (node 3425:3935) — 36 высотой. */
  heroPillHeight: 36,
  /** Кнопка блока брони (node 3443:12586) — поля 16/12. */
  ctaButtonPaddingHorizontal: 16,
  ctaButtonPaddingVertical: 12,
  /** Блок брони (node 3443:12583) — 150 высотой. */
  ctaHeight: 150,
} as const;

/** Stroke widths from the design. */
export const borderWidth = {
  /** Time-slot pill outline — 1.5px, grey when idle, brand when chosen
   * (Figma node 471:3914). */
  control: 1.5,
} as const;
