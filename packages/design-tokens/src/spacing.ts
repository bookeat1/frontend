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
  /** Rebuilt home (Figma home design, 2026-08-06). Circular cuisine avatar in
   * the «Выберите кухню» rail — a 72 diameter circle leaves ~4 chips visible
   * on a 360-wide screen with the next one peeking. */
  cuisineChip: 72,
  /** Square thumbnail on the right of a vertical «Афиша» event row. */
  // Фотография события в «Афише». 96, как в макете 986:8697: при 72 картинка
  // читалась как иконка рядом с текстом, а не как фотография места.
  eventThumb: 96,
} as const;

/** Stroke widths from the design. */
export const borderWidth = {
  /** Time-slot pill outline — 1.5px, grey when idle, brand when chosen
   * (Figma node 471:3914). */
  control: 1.5,
} as const;
