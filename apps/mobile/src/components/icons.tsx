import {
  ArrowLeft,
  BookOpen,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Clock,
  Compass,
  Export,
  FadersHorizontal,
  ForkKnife,
  GlobeSimple,
  Heart,
  Info,
  InstagramLogo,
  MagnifyingGlass,
  MapPin,
  Minus,
  Note,
  Phone,
  Plus,
  UserCircle,
  Users,
  WarningCircle,
  WhatsappLogo,
  X,
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
 * CheckCircle, ForkKnife, Info, Minus, Plus, Users, Note, WarningCircle) come
 * from the same Phosphor set for visual consistency. They were NOT read off
 * the Figma nodes — the Figma MCP tools were unavailable in the session that
 * built this flow (see the delivery note in conventions/bookeat-frontend.md),
 * so the glyph choice is ours and must be reconciled with the design.
 */
export type { IconProps };
export {
  ArrowLeft,
  BookOpen,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Clock,
  Compass,
  Export,
  FadersHorizontal,
  ForkKnife,
  GlobeSimple,
  Heart,
  Info,
  InstagramLogo,
  MagnifyingGlass,
  MapPin,
  Minus,
  Note,
  Phone,
  Plus,
  UserCircle,
  Users,
  WarningCircle,
  WhatsappLogo,
  X,
};
