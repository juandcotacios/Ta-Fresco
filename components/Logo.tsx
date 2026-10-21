import React from "react";
import {
  Image,
  View,
  Text,
  StyleSheet,
} from "react-native";
import type { ImageSourcePropType } from "react-native";
import { useAppTheme } from "@/src/contexts/ThemeContext";
import { colors as brandColors } from "@/constants/designSystem";

const DEFAULT_LOGO_IMAGE = require("../assets/images/ta-fresco-logo.png");

type LogoSize = "sm" | "md" | "lg";
type LogoVariant = "dark" | "light";

type LogoProps = {
  /** "dark" = texto oscuro, para fondos claros. "light" = texto blanco, para fondos oscuros (ej. bienvenida). */
  variant?: LogoVariant;
  size?: LogoSize;
  /** Oculta el símbolo y deja solo el texto (para espacios muy angostos). */
  showBadge?: boolean;
  /** Permite sustituir el símbolo de marca en usos especiales. */
  imageSource?: ImageSourcePropType;
  style?: object;
};

const SIZES: Record<LogoSize, { badge: number; font: number; gap: number }> = {
  sm: { badge: 26, font: 15, gap: 6 },
  md: { badge: 38, font: 19, gap: 8 },
  lg: { badge: 68, font: 30, gap: 12 },
};

/**
 * Marca compacta de Ta Fresco, compartida por las pantallas de la app.
 */
export default function Logo({
  variant = "dark",
  size = "md",
  showBadge = true,
  imageSource = DEFAULT_LOGO_IMAGE,
  style,
}: LogoProps) {
  const { colors } = useAppTheme();
  const s = SIZES[size];
  const textColor = variant === "light" ? colors.white : colors.textPrimary;

  return (
    <View style={[styles.row, style]}>
      {showBadge && (
        <View
          style={[
            styles.badge,
            { width: s.badge, height: s.badge, borderRadius: s.badge * 0.2, marginRight: s.gap },
          ]}
        >
          <Image
            source={imageSource}
            style={{ width: s.badge, height: s.badge, borderRadius: s.badge * 0.2 }}
            resizeMode="cover"
          />
        </View>
      )}
      <Text style={[styles.word, { fontSize: s.font, color: textColor }]}>
        Ta <Text style={{ color: variant === "light" ? colors.accent : colors.primary }}>Fresco</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  badge: {
    backgroundColor: brandColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  word: {
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
