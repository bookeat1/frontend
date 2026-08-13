import {
  ArrowLeft,
  Bell,
  BellSimple,
  BookOpen,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  ChatCircle,
  Check,
  CheckCircle,
  Clock,
  Compass,
  Export,
  FadersHorizontal,
  ForkKnife,
  GearSix,
  GlobeSimple,
  Heart,
  Info,
  InstagramLogo,
  MagnifyingGlass,
  MapPin,
  Minus,
  Note,
  Percent,
  Phone,
  Plus,
  Question,
  SealPercent,
  Shield,
  SignOut,
  ThumbsUp,
  Trash,
  User,
  UserCircle,
  Users,
  Warning,
  WarningCircle,
  WhatsappLogo,
  WifiSlash,
  Wrench,
  X,
  XCircle,
  type IconProps,
} from "phosphor-react-native";

/**
 * Single import point for every icon glyph used in the app. Icons are the
 * exact Phosphor icons referenced by name in the Figma component descriptions
 * (Heart, Export, ArrowLeft, Clock, GlobeSimple, WhatsappLogo, InstagramLogo,
 * MapPin, Phone, X, MagnifyingGlass, FadersHorizontal, Compass, BookOpen,
 * UserCircle) rendered via `react-native-svg` under the hood. We use the
 * upstream icon package instead of hand-copying the raw per-vector-layer SVG
 * fragments `download_assets` returns for these — those come back split into
 * many small path pieces per icon (and get truncated past 20 assets per
 * node), so reassembling them by hand risked subtly wrong icons. This keeps
 * the exact same glyphs with no Figma link ever committed to the repo.
 *
 * The reservation-flow additions (CalendarBlank, CaretLeft/Right/Down,
 * CheckCircle, ForkKnife, Info, Minus, Plus, User, Users, Note, WarningCircle) come
 * from the same Phosphor set for visual consistency. Most were picked without
 * Figma access (see the delivery note in conventions/bookeat-frontend.md); the
 * design-conformance pass of 2026-07-25 confirmed four of them against the
 * Reservation spec (node 471:3880): CalendarBlank and User in the date/guests
 * pills, CaretDown in those pills, X as the screen's close control. The rest
 * (CaretLeft/Right, CheckCircle, ForkKnife, Info, Minus, Plus, Users, Note,
 * WarningCircle) are still ours and must be reconciled with the design.
 *
 * XCircle is the circled X drawn to the left of the "Cancel" label on the
 * Reservation detail screen (node 488:9876) — read off the reference render
 * design-ref/screen-cancel-1.png, which has no per-node spec.
 *
 * CaretUp and Check were added for the Filters bottom-sheet (read off the
 * figma reference PNG of the expanded sheet): CaretUp flips the collapsible
 * section header when it is open, Check is the tick inside the square
 * amenity checkboxes.
 *
 * ChatCircle, Question, ThumbsUp and SignOut were added for the «Профиль»
 * vitrina (read off the Figma profile reference): ChatCircle marks «Мои
 * отзывы», Question «Центр помощи», ThumbsUp «Оценить приложение», and SignOut
 * the «Выйти из аккаунта» row. Same Phosphor set as the rest.
 *
 * Bell and Shield were added for the «Настройки» group card (Figma node
 * 906:10384): Bell leads the «Уведомления» toggle row, Shield the «Безопасность»
 * row. Same Phosphor set as the rest.
 *
 * Percent was added for the «Уведомления» inbox screen (notifications render
 * 2026-08-06): the tinted leading icon of a promo/discount notification row
 * («−20% на завтраки»). Bell (reminder) and ForkKnife (booking) reuse the
 * existing glyphs. Same Phosphor set as the rest.
 *
 * WifiSlash, Warning, Wrench, BellSimple and SealPercent are the empty/error
 * «Состояния» template icons (Figma file 7rBjjTjp4FbxV9SCJmypWF, section
 * «Состояния», node 997:10239). Each is the exact Phosphor glyph named in that
 * section: WifiSlash → «Нет подключения», Warning → «Не удалось загрузить»,
 * Wrench → «Идут технические работы», BellSimple → notifications «Все» empty,
 * SealPercent → notifications «Акции» empty. CalendarBlank, Clock, Heart and
 * MagnifyingGlass (the remaining state icons) already existed. Same set.
 */
export type { IconProps };
export {
  ArrowLeft,
  Bell,
  BellSimple,
  BookOpen,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  ChatCircle,
  Check,
  CheckCircle,
  Clock,
  Compass,
  Export,
  FadersHorizontal,
  ForkKnife,
  GearSix,
  GlobeSimple,
  Heart,
  Info,
  InstagramLogo,
  MagnifyingGlass,
  MapPin,
  Minus,
  Note,
  Percent,
  Phone,
  Plus,
  Question,
  SealPercent,
  Shield,
  SignOut,
  ThumbsUp,
  Trash,
  User,
  UserCircle,
  Users,
  Warning,
  WarningCircle,
  WhatsappLogo,
  WifiSlash,
  Wrench,
  X,
  XCircle,
};
