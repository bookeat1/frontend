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
    /**
     * Подпись чипа-метки ВНУТРИ карточки — #96272C (Figma
     * 3z0f6dgev4HMwBAHPjTjPo, node 3053:8540). Тёмная бордовая, а не
     * `brand.primary` (#B33036): на светлой бордовой подложке чипа сам
     * фирменный цвет даёт слишком низкий контраст, и макет называет именно
     * этот, более тёмный оттенок.
     */
    brand: "#96272C",
    /** Подпись под заголовком экрана — тёмная, не приглушённая. Отдельный
     * токен, потому что в макете это #171717, а не общий text.primary
     * (#1B1B1B): оттенки соседние, но макет называет именно этот. */
    subtitle: "#171717",
    /** Pure black used specifically for menu item name/price in the design. */
    strong: "#000000",
    /** Text placed directly over photos/scrim. */
    onDark: "#FFFFFF",
    /** Подпись месяца под числом на кадре афиши (node 3053:8888) — #E2E2E2.
     * Приглушённо-белая: месяц вторичен рядом с числом, но всё ещё лежит на
     * фотографии, где обычный серый нечитаем. */
    onPhotoMuted: "#E2E2E2",
    /**
     * Подпись «заведение · дата · время» на кадре афиши — белый с
     * прозрачностью 85 % (Figma 3z0f6dgev4HMwBAHPjTjPo, узлы 3452:13202
     * карточки списка и 3452:13245 карточки афиши). Отдельный токен, а не
     * `onPhotoMuted` (#E2E2E2, сплошной): здесь макет называет прозрачность,
     * и подпись слегка пропускает фотографию под собой.
     */
    onPhotoSubtitle: "rgba(255, 255, 255, 0.85)",
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
    /**
     * Тот же белый лист, но прозрачный — начало затухания у края
     * горизонтального ряда. Отдельный токен, потому что «прозрачный» в
     * градиенте обязан быть ТЕМ ЖЕ цветом с нулевой прозрачностью: чистый
     * `transparent` на iOS даёт серую кайму по краям перехода.
     */
    surfaceTransparent: "rgba(255, 255, 255, 0)",
    /** Neutral pill chip background (hours, price, menu tag chips). */
    chip: "#F1F1F1",
    /**
     * Приглушённая подложка блока внутри белого экрана — #F8F8F8 (в макетах
     * это переменная `background/subtle`): карточка брони, вторичная кнопка,
     * дорожка переключателя вкладок. Светлее фона экрана (#F5F5F5), потому что
     * лежит НА белом, а не под ним.
     */
    subtle: "#F8F8F8",
    /** Slightly different chip background used on the search bar + filter row. */
    chipAlt: "#F3F2F2",
    /**
     * Подложка чипа-метки внутри карточки — фирменный цвет с прозрачностью
     * 15% (Figma node 3053:8539, rgba(179,48,54,0.15)). Заменил прежнюю серую
     * подложку по правке владельца от 2026-08-20: «чипы сейчас все красного
     * цвета».
     *
     * ЭТО НЕ ЧИП-ФИЛЬТР. Ряды «На сегодня / Рестораны / События» остались
     * прежними: выбранный сплошной `brand.primary` с белым текстом,
     * невыбранный светло-серый. Разный смысл — разный вид: фильтр это
     * переключатель, а чип в карточке это подпись.
     */
    chipBrand: "rgba(179, 48, 54, 0.15)",
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
    /**
     * Круглая подложка под кнопкой ПОВЕРХ фотографии — сердечко избранного
     * (Figma 3z0f6dgev4HMwBAHPjTjPo, node 3053:8506). Белая с прозрачностью
     * 20%: держит иконку читаемой и на светлом блюде, и на тёмном зале.
     */
    photoControl: "rgba(255, 255, 255, 0.2)",
    /**
     * Затемнение под датой на кадре карточки афиши (node 3053:8885) —
     * rgba(0,0,0,0.3). Легче общего `scrim`: под ним лежит только дата в две
     * строки, а не текст во всю карточку, и более плотная заливка убила бы
     * саму фотографию.
     */
    photoDate: "rgba(0, 0, 0, 0.3)",
    /** Bottom gradient over promo banner photos so caption text stays legible. */
    bannerGradientTop: "rgba(0, 0, 0, 0)",
    bannerGradientBottom: "rgba(0, 0, 0, 0.7)",
    /** Sticky booking-button footer shadow. */
    footerShadow: "rgba(0, 0, 0, 0.08)",
    /** Backdrop behind a modal confirmation dialog. Darker than `scrim`
     * because it covers a white screen, not a photo. */
    dialogScrim: "rgba(0, 0, 0, 0.45)",
    /**
     * Затемнение поверх фотографии в шапке главной. Ровно чёрный с 20 %, как
     * в макете (3z0f6dgev4HMwBAHPjTjPo, node 3102:11986: поверх заливки-кадра
     * лежит сплошная чёрная с прозрачностью 0.2). Было 0.45 — под прежний,
     * более светлый кадр; новый (бокал у бархатного занавеса) сам по себе
     * тёмный, средняя яркость под приветствием ~60 из 255, и белый текст
     * читается уже при 20 %.
     */
    headerScrim: "rgba(0, 0, 0, 0.2)",
    /**
     * Затемнение поверх фотографии в шапке гастрогида (макет
     * dVjT37j984ErvOmzxlx29p, node 1099:6802 — `rgba(0,0,0,0.3)`). Легче, чем
     * `headerScrim` (0.2): на этом кадре светлый только верх, и заголовок в
     * 24 pt требует более плотного затемнения.
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
    /**
     * Затемнение кадра КАРТОЧКИ СПИСКА «Афиша» (node 3452:13199): сверху
     * прозрачное, на середине 20 %, у нижнего края 86 %. Три стопа, а не два:
     * подпись лежит в самом низу кадра, и линейное затухание из прозрачного в
     * 0.86 съедало бы фотографию уже на середине.
     */
    eventCardGradient: ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.2)", "rgba(0, 0, 0, 0.86)"],
    /**
     * Затемнение кадра КАРТОЧКИ АФИШИ (node 3452:13227): прозрачное → 10 % на
     * 49.8 % высоты → сплошной чёрный у низа. Плотнее, чем у карточки списка:
     * поверх него лежит название в 28 pt, а кадр вдвое выше.
     */
    eventHeroGradient: ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.1)", "#000000"],
    /**
     * Круглая подложка плавающих кнопок на кадре афиши (node 3452:13234) —
     * белая с прозрачностью 92 %. Не `photoControl` (20 %): в этом макете
     * кнопки почти непрозрачные, а глиф в них тёмный.
     */
    photoControlLight: "rgba(255, 255, 255, 0.92)",
    /**
     * Подложка метки-пилюли на кадре афиши (node 3452:13249) — белая с
     * прозрачностью 30 %, с размытием под ней.
     */
    heroPill: "rgba(255, 255, 255, 0.3)",
  },
} as const;

export type ColorToken = typeof colors;
