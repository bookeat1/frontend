import { Platform } from "react-native";

const fontFamily = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "System",
});

export const typography = {
  fontFamily,
  h1: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: "700" as const },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: "600" as const },
  bodyLg: { fontSize: 16, lineHeight: 22, fontWeight: "400" as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: "600" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
  captionMedium: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const },
  button: { fontSize: 16, lineHeight: 20, fontWeight: "700" as const },
} as const;

export type TypographyToken = typeof typography;
