import {
  ArrowLeft,
  BookOpen,
  Clock,
  Compass,
  Export,
  FadersHorizontal,
  GlobeSimple,
  Heart,
  InstagramLogo,
  MagnifyingGlass,
  MapPin,
  Phone,
  UserCircle,
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
 */
export type { IconProps };
export {
  ArrowLeft,
  BookOpen,
  Clock,
  Compass,
  Export,
  FadersHorizontal,
  GlobeSimple,
  Heart,
  InstagramLogo,
  MagnifyingGlass,
  MapPin,
  Phone,
  UserCircle,
  WhatsappLogo,
  X,
};
