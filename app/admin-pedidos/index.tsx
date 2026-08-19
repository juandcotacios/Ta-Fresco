import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  suscribirseTodosLosPedidos,
  actualizarEstadoPedido,
  Pedido,
  EstadoPedido,
  ESTADO_LABELS,
  ORDEN_ESTADOS,
} from "@/src/services/pedidosService";

export default function AdminPedidosScreen() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  useEffect(() => {
    const unsubscribe = suscribirseTodosLosPedidos(setPedidos);
    return () => unsubscribe();
  }, []);

  const avanzarEstado = async (pedido: Pedido) => {
    const currentIndex = ORDEN_ESTADOS.indexOf(pedido.status);
    if (currentIndex === -1 || currentIndex === ORDEN_ESTADOS.length - 1) return;
    const siguiente = ORDEN_ESTADOS[currentIndex + 1];
    try {
      await actualizarEstadoPedido(pedido.id, siguiente);
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "No se pudo actualizar el estado.");
    }
  };

  const cancelarPedido = (pedido: Pedido) => {
    Alert.alert("Cancelar pedido", `¿Cancelar el pedido #${pedido.id.slice(0, 6).toUpperCase()}?`, [
      { text: "No", style: "cancel" },
      {
        text: "Sí, cancelar",
        style: "destructive",
        onPress: async () => {
          try {
            await actualizarEstadoPedido(pedido.id, "cancelado" as EstadoPedido);
          } catch (error) {
            console.log(error);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Panel de Pedidos (temporal)</Text>
      </View>

      <Text style={styles.warning}>
        ⚠️ Panel provisional visible para cualquier usuario logueado, hasta que exista el rol de proveedor.
      </Text>

      <FlatList
        data={pedidos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>No hay pedidos todavía.</Text>}
        renderItem={({ item }) => {
          const estado = ESTADO_LABELS[item.status];
          const esFinal = item.status === "entregado" || item.status === "cancelado";
          const currentIndex = ORDEN_ESTADOS.indexOf(item.status);
          const siguienteLabel =
            currentIndex >= 0 && currentIndex < ORDEN_ESTADOS.length - 1
              ? ESTADO_LABELS[ORDEN_ESTADOS[currentIndex + 1]].label
              : null;

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.pedidoId}>#{item.id.slice(0, 6).toUpperCase()}</Text>
                <View style={[styles.badge, { backgroundColor: estado.color }]}>
                  <Text style={styles.badgeText}>{estado.label}</Text>
                </View>
              </View>

              <Text style={styles.total}>Total: ${item.total.toLocaleString()}</Text>
              {item.address && (
                <Text style={styles.addressLine}>
                  📍 {item.address.name} — {item.address.addressLine}
                </Text>
              )}

              {!esFinal && (
                <View style={styles.actions}>
                  {siguienteLabel && (
                    <TouchableOpacity style={styles.advanceBtn} onPress={() => avanzarEstado(item)}>
                      <Text style={styles.advanceBtnText}>Avanzar a: {siguienteLabel}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelarPedido(item)}>
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 55,
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  backBtn: { marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  warning: {
    backgroundColor: "#FFF3E0",
    color: "#EF6C00",
    fontSize: 12,
    padding: 10,
    marginHorizontal: 16,
    borderRadius: 8,
  },
  empty: { textAlign: "center", color: "#999", marginTop: 30 },
  card: {
    backgroundColor: "#f9f9f9",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pedidoId: { fontWeight: "bold", fontSize: 15, color: "#333" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  total: { marginTop: 8, fontWeight: "bold", fontSize: 15, color: "#83c41a" },
  addressLine: { color: "#666", fontSize: 12, marginTop: 4 },
  actions: { flexDirection: "row", marginTop: 12 },
  advanceBtn: {
    backgroundColor: "#83c41a",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 10,
  },
  advanceBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  cancelBtn: {
    backgroundColor: "#FFEBEE",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  cancelBtnText: { color: "#D32F2F", fontWeight: "bold", fontSize: 13 },
});