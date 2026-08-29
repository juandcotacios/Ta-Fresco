import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

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
    label: "Usuarios",
    desc: "Ver usuarios y cambiar su rol (cliente / tendero / admin)",
    icon: "people-outline" as const,
    route: "/admin/usuarios",
  },
];

export default function AdminHomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 55 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Panel de Administración</Text>
      </View>

      {OPCIONES.map((op) => (
        <TouchableOpacity key={op.route} style={styles.card} onPress={() => router.push(op.route as any)}>
          <View style={styles.iconCircle}>
            <Ionicons name={op.icon} size={24} color="#83c41a" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.cardTitle}>{op.label}</Text>
            <Text style={styles.cardDesc}>{op.desc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 22, fontWeight: "bold", color: "#333" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#eee",
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#EAF6D8",
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { fontWeight: "bold", fontSize: 15, color: "#333" },
  cardDesc: { color: "#888", fontSize: 12, marginTop: 3 },
});