/**
 * Color tokens — verified against the Figma file (fileKey 7rBjjTjp4FbxV9SCJmypWF),
 * node 340:2535 ("Карточка заведения") plus the search/photo screens.
 * Named by semantic role, not by raw value, so screens never hardcode hex.
 */
export const colors = {
  brand: {
    /** Primary CTA fill, active banner outline, map pin, active nav icon. */
    primary: "#B33036",
    /**
     * Filled heart of a favourited card. Deliberately NOT `primary`: measured
     * off the Explore reference render (`design-ref/screen-explore.png`, the
     * favourited event card) as #FF3838, a brighter red than the CTA colour.
     */
    favorite: "#FF3838",
  },
  text: {
    /** Default body/heading text. */
    primary: "#1B1B1B",
    /** Secondary/disabled text — addresses subtext, inactive tabs, captions. */
    muted: "#A5A5A5",
    /** Slightly darker muted tone used for chip labels in search results. */
    mutedStrong: "#7D7D7D",
    /** Подпись под заголовком экрана — тёмная, не приглушённая. Отдельный
     * токен, потому что в макете это #171717, а не общий text.primary
     * (#1B1B1B): оттенки соседние, но макет называет именно этот. */
    subtitle: "#171717",
    /** Pure black used specifically for menu item name/price in the design. */
    strong: "#000000",
    /** Text placed directly over photos/scrim. */
    onDark: "#FFFFFF",
    /** Text on the brand-colored primary button. */
    onBrand: "#FFFFFF",
    /**
     * Неактивная вкладка нижней навигации — #595959 из макета
     * (Figma 3z0f6dgev4HMwBAHPjTjPo, node 3039:23943). Отдельный токен, а не
     * `muted` (#A5A5A5): на полупрозрачной плашке светло-серая подпись в 10 pt
     * читается хуже, макет рисует именно этот, более тёмный серый.
     */
    navInactive: "#595959",
  },
  background: {
    /** Screen background behind white surface cards. */
    screen: "#F5F5F5",
    /** Card / sheet surface. */
    surface: "#FFFFFF",
    /** Neutral pill chip background (hours, price, menu tag chips). */
    chip: "#F1F1F1",
    /** Slightly different chip background used on the search bar + filter row. */
    chipAlt: "#F3F2F2",
    /** Selected/active filter chip background. */
    chipActive: "#1B1B1B",
    /** "Посмотреть меню" secondary button fill. */
    secondaryButton: "#E5E5E5",
    /** Circular social-icon button fill. */
    socialIcon: "#F2F2F2",
    /** Placeholder fill behind promo banner images while loading. */
    bannerPlaceholder: "#E7E7E7",
    /**
     * Solid fill of the rebuilt home header (Figma home design, 2026-08-06).
     * The design draws a dark restaurant photo behind the greeting, but the
     * backend has no home-header image endpoint yet, so the header is a flat
     * dark surface instead of a fabricated/placeholder photo. Dark charcoal so
     * the white greeting, city and bell stay legible without a scrim.
     */
    header: "#2A2321",
    /** Full-bleed photo viewer backdrop (Figma node 340:2455). */
    photoViewer: "#000000",
    /**
     * Fill behind the floating tab bar where the native liquid-glass effect is
     * unavailable (iOS below 26, Android). Translucent rather than solid so the
     * bar still reads as a layer above the content scrolling under it, while
     * staying opaque enough for the 10pt tab labels.
     */
    navBarFallback: "rgba(255, 255, 255, 0.94)",
    /**
     * Заливка плашки нижней навигации из макета: белый 30 %. Работает только
     * поверх НАСТОЯЩЕГО размытия (iOS 26, `expo-glass-effect`) — там это
     * оттенок стекла. Без размытия столько прозрачности означает подпись
     * поверх голой фотографии, поэтому используется `navBarFallback`.
     */
    navBarGlassTint: "rgba(255, 255, 255, 0.3)",
  },
  /**
   * Пилюля статуса брони. Значения сверены с макетом «Мои брони»
   * (Figma dVjT37j984ErvOmzxlx29p, node 3004:6781): там нарисованы все три
   * рабочих тона — pending (3004:6814), confirmed (3004:6830) и cancelled
   * (3004:6872). До этого тона брались с экрана деталки брони
   * (oPxXynSOY3PYhf3gkVR5Ps, node 488:9876), где красного не было вовсе и
   * `negative` был нашим.
   *
   * `neutral` (статус `completed`) в макете по-прежнему НЕ нарисован — он
   * остаётся нашим: приглушённый серый из существующей палитры.
   *
   * Осторожно: контраст текста к подложке у всех трёх тонов ниже 4.5:1
   * (примерно 2.5–3.1:1 при кегле 12). Это значения макета, а не наш выбор;
   * если понадобится доступный вариант — менять надо макет, а не только код.
   */
  status: {
    /** pending / waitlist — заведение ещё не ответило. */
    pendingText: "#F67700",
    pendingSurface: "#FFE4CC",
    /** confirmed / arrived — стол ваш. */
    positiveText: "#16A34A",
    positiveSurface: "#D7F9E3",
    /** cancelled / no_show — бронь мертва. */
    negativeText: "#FF323B",
    negativeSurface: "#FFE9EA",
    /**
     * Тот же смысл, но для текста на БЕЛОМ листе (сообщение об ошибке в
     * диалоге отмены брони). Пилюльный #FF323B на белом даёт около 3.4:1 —
     * ниже нормы для обычного текста, — поэтому тут остаётся тёмный красный,
     * который раньше был `negativeText`.
     */
    negativeTextOnSurface: "#B33036",
    /** completed — визит закончился, и ничего не сломалось. */
    neutralText: "#7D7D7D",
    neutralSurface: "#F1F1F1",
  },
  border: {
    /** Hairline between content and bottom nav / sticky footer. */
    subtle: "#F5F5F5",
    /** 1.5px outline of an unselected time-slot pill — Figma file
     * oPxXynSOY3PYhf3gkVR5Ps, node 471:3914 (Reservation, slots card). */
    control: "#E5E5E5",
  },
  overlay: {
    /** Scrim behind icon buttons placed on photos (back/close). */
    scrim: "rgba(0, 0, 0, 0.55)",
    /** Bottom gradient over promo banner photos so caption text stays legible. */
    bannerGradientTop: "rgba(0, 0, 0, 0)",
    bannerGradientBottom: "rgba(0, 0, 0, 0.7)",
    /** Sticky booking-button footer shadow. */
    footerShadow: "rgba(0, 0, 0, 0.08)",
    /** Backdrop behind a modal confirmation dialog. Darker than `scrim`
     * because it covers a white screen, not a photo. */
    dialogScrim: "rgba(0, 0, 0, 0.45)",
    /**
     * Scrim over the home header photo. Heavy enough that the white greeting
     * and city stay readable over the photo's bright spots, light enough that
     * the picture still reads as a picture.
     */
    headerScrim: "rgba(0, 0, 0, 0.45)",
    /**
     * Затемнение поверх фотографии в шапке гастрогида (макет
     * dVjT37j984ErvOmzxlx29p, node 1099:6802 — `rgba(0,0,0,0.3)`). Легче, чем
     * `headerScrim` (0.45): на этом кадре светлый только верх, и заголовок в
     * 24 pt читается уже при 30 %.
     */
    guideHeroScrim: "rgba(0, 0, 0, 0.3)",
    /** Page dots over the Explore hero carousel (design-ref/screen-explore.png):
     * the current page is a solid white capsule, the rest are dimmed dots. */
    carouselDot: "rgba(255, 255, 255, 0.55)",
    carouselDotActive: "#FFFFFF",
    /**
     * Вертикальный градиент под плавающей плашкой навигации
     * (`linear-gradient(rgba(239,239,239,0), rgba(255,255,255,0.65))` в
     * макете): контент, уезжающий под плашку, гасится к низу экрана.
     */
    navBarGradientTop: "rgba(239, 239, 239, 0)",
    navBarGradientBottom: "rgba(255, 255, 255, 0.65)",
    /** Рамка плашки навигации — `1px solid rgba(255,255,255,0.14)`. */
    navBarBorder: "rgba(255, 255, 255, 0.14)",
  },
} as const;

export type ColorToken = typeof colors;
