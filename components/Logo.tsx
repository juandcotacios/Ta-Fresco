import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/designSystem";

type LogoSize = "sm" | "md" | "lg";
type LogoVariant = "dark" | "light";

type LogoProps = {
  /** "dark" = texto oscuro, para fondos claros. "light" = texto blanco, para fondos oscuros (ej. bienvenida). */
  variant?: LogoVariant;
  size?: LogoSize;
  /** Oculta la insignia circular y deja solo el texto (para espacios muy angostos). */
  showBadge?: boolean;
  style?: object;
};

const SIZES: Record<LogoSize, { badge: number; icon: number; font: number; gap: number }> = {
  sm: { badge: 26, icon: 14, font: 15, gap: 6 },
  md: { badge: 38, icon: 20, font: 19, gap: 8 },
  lg: { badge: 68, icon: 36, font: 30, gap: 12 },
};

/**
 * Logo de Ta Fresco construido con código (ícono + texto), en vez de una imagen
 * fija. Así se ve nítido en cualquier tamaño y es fácil de usar sobre fondos
 * claros u oscuros sin depender de archivos de imagen distintos.
 */
export default function Logo({ variant = "dark", size = "md", showBadge = true, style }: LogoProps) {
  const s = SIZES[size];
  const textColor = variant === "light" ? colors.white : colors.textPrimary;

  return (
    <View style={[styles.row, style]}>
      {showBadge && (
        <View
          style={[
            styles.badge,
            { width: s.badge, height: s.badge, borderRadius: s.badge / 2, marginRight: s.gap },
          ]}
        >
          <Ionicons name="leaf" size={s.icon} color={colors.white} />
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
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  word: {
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
