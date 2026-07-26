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
    /** Pure black used specifically for menu item name/price in the design. */
    strong: "#000000",
    /** Text placed directly over photos/scrim. */
    onDark: "#FFFFFF",
    /** Text on the brand-colored primary button. */
    onBrand: "#FFFFFF",
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
    /** Full-bleed photo viewer backdrop (Figma node 340:2455). */
    photoViewer: "#000000",
  },
  /**
   * Booking-status pill (Figma file oPxXynSOY3PYhf3gkVR5Ps, section
   * "Reservation Cancel Flow", node 488:9876). The design only draws two of
   * them — amber "Pending Confirmation" and green "Confirmed". The remaining
   * backend statuses (waitlist / arrived / completed / cancelled / no_show)
   * have no node, so `neutral` and `negative` below are OURS, built from the
   * existing palette (text.mutedStrong on background.chip, brand red on a
   * pale red) rather than invented hues.
   */
  status: {
    /** pending / waitlist — "the venue has not answered yet". */
    pendingText: "#C77700",
    pendingSurface: "#FDF0DC",
    /** confirmed / arrived — "the table is yours". */
    positiveText: "#1E9E5A",
    positiveSurface: "#E4F5EA",
    /** cancelled / no_show — the booking is dead. */
    negativeText: "#B33036",
    negativeSurface: "#F7E4E5",
    /** completed — over, but nothing went wrong. */
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
    /** Page dots over the Explore hero carousel (design-ref/screen-explore.png):
     * the current page is a solid white capsule, the rest are dimmed dots. */
    carouselDot: "rgba(255, 255, 255, 0.55)",
    carouselDotActive: "#FFFFFF",
  },
} as const;

export type ColorToken = typeof colors;
