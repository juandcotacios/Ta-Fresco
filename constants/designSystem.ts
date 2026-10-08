/**
 * Sistema de diseño de Ta Fresco.
 * Paleta "vibrante y fresca": fondos claros, verde como color de marca,
 * tarjetas redondeadas y sombras suaves. Se usa en todas las pantallas
 * para que la app se vea consistente de principio a fin.
 */
import { ViewStyle } from "react-native";

export const colors = {
  // Marca
  primary: "#16A34A",
  primaryDark: "#15803D",
  primaryDarker: "#0F5C2E",
  primaryLight: "#DCFCE7",
  accent: "#84CC16",

  // Base
  background: "#F7F9F7",
  surface: "#FFFFFF",
  ink: "#1C2B22", // charcoal con tinte verde, hereda la pantalla de bienvenida original

  // Texto
  textPrimary: "#1F2937",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  textOnPrimary: "#FFFFFF",

  // Bordes / separadores
  border: "#E7ECE8",
  divider: "#EEF2EF",

  // Estados
  success: "#16A34A",
  successLight: "#DCFCE7",
  danger: "#E53935",
  dangerLight: "#FDECEA",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  info: "#2563EB",
  infoLight: "#DBEAFE",

  white: "#FFFFFF",
  black: "#000000",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: "800" as const },
  h2: { fontSize: 22, fontWeight: "800" as const },
  h3: { fontSize: 18, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  bodyBold: { fontSize: 15, fontWeight: "700" as const },
  small: { fontSize: 13, fontWeight: "400" as const },
  tiny: { fontSize: 11, fontWeight: "600" as const },
};

/** Fuente decorativa usada para textos puntuales (ya empaquetada en la app). */
export const accentFont = "Poppins-Regular";

export const shadow: Record<"card" | "floating" | "button", ViewStyle> = {
  card: {
    shadowColor: "#0F2E1B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  floating: {
    shadowColor: "#0F2E1B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  button: {
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
};
