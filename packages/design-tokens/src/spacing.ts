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
   * Верхние углы НИЖНЕЙ ШТОРКИ «Дата и гости» на главной — 16 (Figma
   * 3z0f6dgev4HMwBAHPjTjPo, node 3447:13024 — `rounded-t-[16px]`). Отдельный
   * токен, а не `dialog` (24): диалог подтверждения и шторка подбора — разные
   * вещи, и в макете у них разный радиус.
   */
  sheet: 16,
  /**
   * Карточка брони в списке «Мои брони» (Figma dVjT37j984ErvOmzxlx29p,
   * node 3004:6807 — `rounded-[24px]`). Отдельный токен, а не `dialog`:
   * значение совпадает, но роль другая, и диалог не должен тянуть за собой
   * карточку списка, если один из двух радиусов поменяют.
   */
  bookingCard: 24,
  /**
   * 16 — промежуточный радиус.
   *
   * Фотографии карточек главной сюда БОЛЬШЕ НЕ ходят: в макете
   * (3z0f6dgev4HMwBAHPjTjPo, узлы 3447:12749, 3447:12869 и соседние) у них
   * `rounded-[20px]`, то есть `card`. Прежние 16 были сняты с отрендеренного
   * экрана `design-ref/screen-explore.png` на глаз, а не с узла.
   *
   * Остаётся как основа для мелких скруглений (квадрат чекбокса в фильтрах —
   * `media / 3`).
   */
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
  /**
   * Карточка горизонтального ряда на главной — 256 в ширину, фотография 148 в
   * высоту (Figma 3z0f6dgev4HMwBAHPjTjPo, узлы 3447:12749, 3447:12830,
   * 3447:12913 и соседние: `w-[256px]`, `h-[148px]`, просвет между карточками
   * 8).
   *
   * Было 200x120 — значение, выбранное НАМИ на глаз, чтобы в ряд помещалось
   * две целых карточки и третья с краю. Макет рисует одну целую и заметный
   * край второй, и по правилу владельца от 26.08.2026 («значения UI берём из
   * Figma, не подгоняем на глаз») ряд возвращён к макету. Если две карточки в
   * кадре всё-таки нужны — это решение владельца по бете, и менять его надо
   * вместе с этим комментарием, а не молча.
   */
  cardWidth: 256,
  cardPhotoHeight: 148,
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

/** Stroke widths from the design. */
export const borderWidth = {
  /** Time-slot pill outline — 1.5px, grey when idle, brand when chosen
   * (Figma node 471:3914). */
  control: 1.5,
} as const;
