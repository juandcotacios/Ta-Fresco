import { colors, radius, shadow } from "@/constants/designSystem";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const OPCIONES = [
  {
    label: "Pedidos",
    desc: "Ver y avanzar el estado de todos los pedidos",
    icon: "clipboard-outline" as const,
    route: "/admin-pedidos",
  },
  {
    label: "Productos y Descuentos",
    desc: "Editar el descuento de cualquier producto del catálogo",
    icon: "pricetags-outline" as const,
    route: "/admin-productos",
  },
  {
    label: "Solicitudes de tienda",
    desc: "Aprobar o rechazar quién quiere vender en la app",
    icon: "storefront-outline" as const,
    route: "/admin/solicitudes",
  },
  {
    label: "Usuarios",
    desc: "Ver usuarios y cambiar su rol (Tendero / Mayorista / Administrador)",
    icon: "people-outline" as const,
    route: "/admin/usuarios",
  },
];

export default function AdminHomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 55 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Panel de Administración</Text>
      </View>

      {OPCIONES.map((op) => (
        <TouchableOpacity key={op.route} style={styles.card} onPress={() => router.push(op.route as any)}>
          <View style={styles.iconCircle}>
            <Ionicons name={op.icon} size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.cardTitle}>{op.label}</Text>
            <Text style={styles.cardDesc}>{op.desc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: "center", alignItems: "center",
    marginRight: 12,
    ...shadow.card,
  },
  title: { fontSize: 22, fontWeight: "bold", color: colors.textPrimary },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
    ...shadow.card,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { fontWeight: "bold", fontSize: 15, color: colors.textPrimary },
  cardDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
});
