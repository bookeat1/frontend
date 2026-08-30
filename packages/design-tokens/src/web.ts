/**
 * Токены ДЕСКТОПНОГО веба.
 *
 * Сняты из Figma 3z0f6dgev4HMwBAHPjTjPo, кадр «WEB / 00 · UI Kit и токены»
 * (узел 3273:2). Узлы указаны у каждого блока — числа менять можно только
 * вместе с макетом.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ФАЙЛ, А НЕ ПРАВКА `colors`/`typography`/`spacing`.
 * Мобильные токены описывают экран 390 px и живут в React Native (числа без
 * единиц, `fontFamily` как имя загруженного шрифта). Веб-кит рисует ту же
 * марку, но своей шкалой: нейтральная лестница 0…900 вместо ролевых имён,
 * дисплейный кегль 60/68, которого на телефоне нет, и сетка 1440. Дописать
 * это в мобильные объекты значило бы либо переименовать половину ключей
 * (сломав приложение), либо завести в них ключи, которые телефон никогда не
 * использует. Пересечения оставлены осознанно: `brand.primary` (#B33036) и
 * `text.brand` (#96272C) совпадают с мобильными — это одна и та же марка.
 *
 * Всё в px и строками: значения уходят прямо в Tailwind-тему и CSS.
 */

/**
 * Нейтральная лестница и акценты из блока «Цвета» (узлы 3273:9, 3273:35,
 * 3273:61). Имена — ровно те, что подписаны в макете под каждым образцом.
 */
export const webPalette = {
  /** neutral/0 — фон страницы и карточек. */
  neutral0: "#FFFFFF",
  /** neutral/50 — подложка секций, невыбранный слот. */
  neutral50: "#F8F8F8",
  /** neutral/100 — приглушённая подложка, бейдж «Завершено». */
  neutral100: "#F3F2F2",
  /**
   * neutral/200. В макете подпись образца `border/default` говорит #E7E7E7,
   * а сама плашка залита #DADADA — рассинхрон внутри кита. Берём число из
   * ПОДПИСИ: им же залита неактивная кнопка (узел 3274:17) и им же обведён
   * ряд типографики (узел 3273:90), то есть #E7E7E7 — реально работающее
   * значение, а заливка образца просто повторяет соседний.
   */
  neutral200: "#E7E7E7",
  /** neutral/300 — обводка полей, вторичных кнопок, чипов. */
  neutral300: "#DADADA",
  /** Обводка активных контролов и текст неактивной кнопки (узел 3274:18).
   * Своего образца в ките нет, значение взято из самих элементов. */
  neutral400: "#B2B2B2",
  /** neutral/500 — третичный текст, подписи. */
  neutral500: "#7D7D7D",
  /** neutral/600 — вторичный текст. */
  neutral600: "#595959",
  /** neutral/900 — основной текст. */
  neutral900: "#1B1B1B",

  /** brand/500 — заливка главной кнопки, выбранного чипа и слота. */
  brand500: "#B33036",
  /** brand/600 — фирменный ТЕКСТ на светлом (контраст выше, чем у brand/500). */
  brand600: "#96272C",
  /** brand/50 — светлая фирменная подложка активного чипа. */
  brand50: "#FBEFF0",

  /** success/50 и success/500 — бейдж «Подтверждено». */
  success50: "#EDF7EE",
  success500: "#2E7D32",
  /**
   * Текст на success/50. Образец в ките называет success/500 (#2E7D32), но
   * сам бейдж (узел 3274:46) нарисован темнее — #1B5E20. Держим ОБА: заливка
   * по образцу, текст по бейджу, иначе контраст на светло-зелёном падает.
   */
  success700: "#1B5E20",

  /** warning/50 — бейдж «Ждём подтверждения». */
  warning50: "#FFF7E6",
  /** Текст того же бейджа (узел 3274:48). Своего образца в ките нет. */
  warning700: "#8A4F00",

  /** danger/500 — обводка поля с ошибкой, текст бейджа «Отменено». */
  danger500: "#C62828",
  /** Текст кнопки «Отменить» (узел 3274:16) — темнее danger/500. */
  danger700: "#8E1B1B",
  /** Подложка бейджа «Отменено» (узел 3274:49). Своего образца нет. */
  danger50: "#FDEEEE",
} as const;

/**
 * Семантические имена поверх лестницы — ими и пользуются компоненты.
 * Ровно те роли, что подписаны в макете (`background/canvas`, `text/primary`…).
 */
export const webColors = {
  background: {
    canvas: webPalette.neutral0,
    subtle: webPalette.neutral50,
    muted: webPalette.neutral100,
    brand: webPalette.brand500,
    brandSubtle: webPalette.brand50,
    success: webPalette.success50,
    warning: webPalette.warning50,
    danger: webPalette.danger50,
    disabled: webPalette.neutral200,
    /** Подвал (узел 3256:77) залит основным цветом текста. */
    inverse: webPalette.neutral900,
  },
  border: {
    /** `border/default` из макета — разделители рядов и секций. */
    default: webPalette.neutral200,
    /** `border/strong` из макета — обводка шапки, внутренний разделитель
     * поля телефона, рамка образцов цвета. */
    strong: webPalette.neutral300,
    /**
     * Обводка ИНТЕРАКТИВНОГО контрола в покое: вторичная кнопка, чип, слот,
     * поле ввода (#B2B2B2). Своего образца в блоке «Цвета» у неё нет — имя
     * придумано здесь, поэтому оно и не притворяется одним из двух «border/*»
     * макета. Ставить сюда `border/strong` (#DADADA) было бы правкой макета
     * на глаз: контролы в ките заметно темнее разделителей.
     */
    control: webPalette.neutral400,
    focus: webPalette.brand500,
    danger: webPalette.danger500,
  },
  text: {
    primary: webPalette.neutral900,
    secondary: webPalette.neutral600,
    tertiary: webPalette.neutral500,
    brand: webPalette.brand600,
    disabled: webPalette.neutral400,
    onBrand: webPalette.neutral0,
    onInverse: webPalette.neutral0,
    /** Подписи в подвале на тёмном (узел 3256:81). */
    onInverseMuted: webPalette.neutral400,
    success: webPalette.success700,
    warning: webPalette.warning700,
    danger: webPalette.danger500,
    /** Текст разрушающей кнопки — темнее danger/500 (узел 3274:16). */
    dangerStrong: webPalette.danger700,
  },
  overlay: {
    /** Затемнение под модалкой — заливка кадра 3272:2. */
    scrim: "rgba(27, 27, 27, 0.72)",
    /** Плашка поверх фотографии в карточке (узел 3280:4806). */
    photoBadge: "rgba(27, 27, 27, 0.72)",
    /** Кружок «в избранное» поверх фотографии (узел 3280:4744). */
    photoControl: "rgba(255, 255, 255, 0.92)",
    /** Разделитель и кружки соцсетей в тёмном подвале. */
    onInverseLine: "rgba(255, 255, 255, 0.12)",
    onInverseSurface: "rgba(255, 255, 255, 0.1)",
  },
} as const;

/**
 * Шкала «Типографика · Noto Sans» (узел 3273:89). Пары — кегль/интерлиньяж
 * ровно из подписи справа в каждом ряду.
 */
export const webTypography = {
  /** 60/68 Bold — герой первого экрана. Только в вебе. */
  display: { fontSize: 60, lineHeight: 68, fontWeight: 700 },
  /** 40/48 Bold — H1 страницы. */
  h1: { fontSize: 40, lineHeight: 48, fontWeight: 700 },
  /** 30/38 Bold — заголовок секции. */
  h2: { fontSize: 30, lineHeight: 38, fontWeight: 700 },
  /** 26/34 Bold — подзаголовок, заголовок модалки (узел 3272:9). */
  h3: { fontSize: 26, lineHeight: 34, fontWeight: 700 },
  /** 21/28 Bold. */
  titleL: { fontSize: 21, lineHeight: 28, fontWeight: 700 },
  /** 17/26 Regular — крупный текст. */
  bodyL: { fontSize: 17, lineHeight: 26, fontWeight: 400 },
  /** 15/22 Regular — основной текст. */
  bodyM: { fontSize: 15, lineHeight: 22, fontWeight: 400 },
  /** 13/18 Regular — подписи и метки. */
  bodyS: { fontSize: 13, lineHeight: 18, fontWeight: 400 },
} as const;

/**
 * Радиусы из блока «РАДИУСЫ И ОТСТУПЫ» (узел 3274:57) — вместе с подписью,
 * где макет велит их применять.
 */
export const webRadius = {
  /** 8 — слоты и бейджи внутри карточки. */
  sm: 8,
  /** 12 — поля ввода и кнопки размера M. */
  md: 12,
  /** 16 — карточки блюд и кнопки размера L (узел 3274:7). */
  lg: 16,
  /** 20 — карточки заведений (в кадрах нарисованы 24, см. `card`). */
  xl: 20,
  /** 24 — модалки и тикет брони. */
  xxl: 24,
  /** Полная скругляемость — чипы, бейджи, аватары. */
  full: 999,
  /**
   * Радиус реальной карточки заведения на макетах — 24 (узел 3280:5482),
   * хотя блок радиусов подписывает под «карточки заведений» 20. Отдельный
   * токен, чтобы расхождение было видно, а не спрятано в компоненте.
   */
  card: 24,
  /** Поле телефона в модалке входа (узел 3272:13) — 14, не 12. */
  field: 14,
} as const;

/**
 * Сетка десктопа (узел 3273:124): контейнер 1200, внешние поля 120,
 * 12 колонок по 76, гаттер 24, брейкпоинты 1440/1280/1024/768.
 */
export const webLayout = {
  containerWidth: 1200,
  pageGutter: 120,
  columns: 12,
  columnWidth: 76,
  gutter: 24,
  breakpoints: [1440, 1280, 1024, 768],
  /** Высота шапки (узел 3367:10653). */
  headerHeight: 80,
  /** Ширина модалки входа (узел 3272:6). */
  modalWidth: 380,
} as const;

/**
 * Размеры контролов, снятые с самих элементов кита. Числа здесь — это
 * `height` и `padding` конкретных узлов, а не «на глаз подобранные» отступы.
 */
export const webControls = {
  /** Button / Primary · Secondary / L — 54 высотой, паддинг 15/28 (3274:7). */
  buttonL: { height: 54, paddingX: 28, radius: webRadius.lg, fontSize: 16, lineHeight: 24 },
  /** Button / M — 42 высотой, паддинг 11/20 (3274:11). */
  buttonM: { height: 42, paddingX: 20, radius: webRadius.md, fontSize: 14, lineHeight: 20 },
  /** Chip — 38 высотой, паддинг 9/16 (3274:22). */
  chip: { height: 38, paddingX: 16, fontSize: 14, lineHeight: 20 },
  /** Slot — 42 высотой, паддинг 11/20 (3274:29). */
  slot: { height: 42, paddingX: 20, radius: webRadius.md, fontSize: 15, lineHeight: 20 },
  /** Input — 48 высотой, паддинг 13/16 (3274:38). */
  input: { height: 48, paddingX: 16, radius: webRadius.md, fontSize: 15, lineHeight: 22 },
  /** Badge — 32 высотой, паддинг 8/16 (3274:45). */
  badge: { height: 32, paddingX: 16, fontSize: 14, lineHeight: 16 },
  /**
   * Обводка в покое — 1, в фокусе и в ошибке — 2 (узлы 3274:40 и 3274:42).
   * Держим отдельно, потому что от толщины зависит компенсация паддинга.
   */
  borderWidth: { rest: 1, active: 2 },
} as const;

/**
 * Карточка заведения (узел 3280:5482) — единственная карточка, полностью
 * размеченная в макетах веба.
 */
export const webVenueCard = {
  width: 282,
  imageHeight: 190,
  bodyPadding: 16,
  bodyGap: 16,
  radius: webRadius.card,
  /** Тень: две — 0 4 10 rgba(0,0,0,.10) и 0 2 4 rgba(0,0,0,.05). */
  shadow: "0 4px 10px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)",
  /** Слот-подсказка внутри карточки: 32 высотой, паддинг 7/12, радиус 10. */
  slot: { height: 32, paddingX: 12, radius: 10, fontSize: 13, lineHeight: 18 },
} as const;

/** Тень модалки (узел 3272:6): 0 20 50 rgba(0,0,0,.32). */
export const webShadow = {
  modal: "0 20px 50px rgba(0, 0, 0, 0.32)",
  card: webVenueCard.shadow,
} as const;

export type WebColorToken = typeof webColors;
export type WebTypographyToken = typeof webTypography;
