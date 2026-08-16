import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { getAuth } from "firebase/auth";
import { useFocusEffect } from "expo-router";
import {
  obtenerPedidosUsuario,
  Pedido,
  ESTADO_LABELS,
} from "@/src/services/pedidosService";

export default function PedidosScreen() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargarPedidos = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setPedidos([]);
      setLoading(false);
      return;
    }
    try {
      const data = await obtenerPedidosUsuario(user.uid);
      setPedidos(data);
    } catch (error) {
      console.log("Error cargando pedidos:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      cargarPedidos();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    cargarPedidos();
  };

  const formatFecha = (timestamp: any) => {
    if (!timestamp?.toDate) return "";
    const fecha = timestamp.toDate();
    return fecha.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#83c41a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mis pedidos</Text>

      {pedidos.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>Todavía no has hecho ningún pedido.</Text>
        </View>
      ) : (
        <FlatList
          data={pedidos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const estado = ESTADO_LABELS[item.status];
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.pedidoId}>Pedido #{item.id.slice(0, 6).toUpperCase()}</Text>
                  <View style={[styles.badge, { backgroundColor: estado.color }]}>
                    <Text style={styles.badgeText}>{estado.label}</Text>
                  </View>
                </View>

                <Text style={styles.fecha}>{formatFecha(item.createdAt)}</Text>

                {item.items.map((prod) => (
                  <Text key={prod.id} style={styles.itemLine}>
                    {prod.quantity}x {prod.name}
                  </Text>
                ))}

                <Text style={styles.total}>Total: ${item.total.toLocaleString()}</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  empty: { color: "#999", fontSize: 16 },
  card: {
    backgroundColor: "#f9f9f9",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  pedidoId: { fontWeight: "bold", fontSize: 15, color: "#333" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  fecha: { color: "#888", fontSize: 12, marginBottom: 8 },
  itemLine: { color: "#555", fontSize: 14, marginBottom: 2 },
  total: { marginTop: 8, fontWeight: "bold", fontSize: 15, color: "#83c41a" },
});