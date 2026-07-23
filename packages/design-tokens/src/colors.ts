/**
 * Color tokens.
 *
 * NOTE: exact brand colors were not verified against the Figma file
 * (fileKey 7rBjjTjp4FbxV9SCJmypWF) because Figma MCP tools were not
 * available in this working session. These are placeholder values in a
 * typical "restaurant booking" palette and MUST be reconciled with the
 * real design tokens (get_variable_defs) before this ships to users.
 */
export const colors = {
  brand: {
    primary: "#FF5A36",
    primaryDark: "#E2451F",
    primaryLight: "#FFE4DA",
  },
  neutral: {
    0: "#FFFFFF",
    50: "#F7F7F8",
    100: "#EFEFF1",
    200: "#E1E1E5",
    300: "#C7C7CE",
    400: "#9A9AA5",
    500: "#71717A",
    600: "#52525B",
    700: "#3A3A41",
    800: "#232327",
    900: "#131316",
  },
  semantic: {
    success: "#1F9254",
    successBg: "#E6F5EC",
    error: "#D6392E",
    errorBg: "#FCEAE9",
    warning: "#B9750B",
    warningBg: "#FBF0DD",
  },
  overlay: {
    scrim: "rgba(19, 19, 22, 0.55)",
    imageGradient: "rgba(19, 19, 22, 0.65)",
  },
} as const;

export type ColorToken = typeof colors;
