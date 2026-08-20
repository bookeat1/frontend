import React from "react";

/**
 * The icon set in the test runner.
 *
 * WHY A STUB: `phosphor-react-native` draws through `react-native-svg`, whose
 * `react-native` entry point is untranspiled TypeScript — Metro compiles it,
 * Node does not, and importing it fails on the first type annotation
 * ("Unexpected token 'typeof'" out of `src/lib/SvgTouchableMixin.ts`). One
 * component with one icon in it was enough to take a whole test file down
 * before a single assertion ran.
 *
 * Nothing here is worth asserting on: an icon is a glyph, and this suite does
 * not test pixels. What matters is that a component CONTAINING an icon can be
 * rendered at all, so that the logic around it can be tested. Every icon
 * renders the same marked-up span carrying its name, which is enough for a
 * test to say "the fork-and-knife tile is showing" if one ever needs to.
 */
interface StubIconProps {
  size?: number | string;
  color?: string;
  weight?: string;
  [key: string]: unknown;
}

const icon = (name: string) =>
  function StubIcon({ size, color }: StubIconProps) {
    return <span data-testid={`icon-${name}`} data-size={size} data-color={color} />;
  };

export const ArrowLeft = icon("ArrowLeft");
export const BookOpen = icon("BookOpen");
export const Camera = icon("Camera");
export const CalendarBlank = icon("CalendarBlank");
export const CaretDown = icon("CaretDown");
export const CaretLeft = icon("CaretLeft");
export const CaretRight = icon("CaretRight");
export const ChatCircle = icon("ChatCircle");
export const CheckCircle = icon("CheckCircle");
export const Clock = icon("Clock");
export const Compass = icon("Compass");
export const Export = icon("Export");
export const FadersHorizontal = icon("FadersHorizontal");
export const ForkKnife = icon("ForkKnife");
export const GearSix = icon("GearSix");
export const GlobeSimple = icon("GlobeSimple");
export const Heart = icon("Heart");
export const Info = icon("Info");
export const InstagramLogo = icon("InstagramLogo");
export const MagnifyingGlass = icon("MagnifyingGlass");
export const MapPin = icon("MapPin");
export const Minus = icon("Minus");
export const Note = icon("Note");
export const Phone = icon("Phone");
export const Plus = icon("Plus");
export const Question = icon("Question");
export const SignOut = icon("SignOut");
export const ThumbsUp = icon("ThumbsUp");
export const User = icon("User");
export const UserCircle = icon("UserCircle");
export const Users = icon("Users");
export const WarningCircle = icon("WarningCircle");
export const WhatsappLogo = icon("WhatsappLogo");
export const X = icon("X");
export const XCircle = icon("XCircle");

export interface IconProps extends StubIconProps {}
