import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { getAuth } from "firebase/auth";
import {
  suscribirsePedidosUsuario,
  Pedido,
  EstadoPedido,
  ESTADO_LABELS,
  ORDEN_ESTADOS,
} from "@/src/services/pedidosService";

function StatusStepper({ status }: { status: EstadoPedido }) {
  if (status === "cancelado") {
    return (
      <View style={{ marginTop: 10 }}>
        <Text style={{ color: ESTADO_LABELS.cancelado.color, fontWeight: "bold" }}>
          Pedido cancelado
        </Text>
      </View>
    );
  }

  const currentIndex = ORDEN_ESTADOS.indexOf(status);

  return (
    <View style={stepperStyles.row}>
      {ORDEN_ESTADOS.map((estado, index) => {
        const reached = index <= currentIndex;
        const isLast = index === ORDEN_ESTADOS.length - 1;
        return (
          <React.Fragment key={estado}>
            <View style={stepperStyles.stepContainer}>
              <View
                style={[
                  stepperStyles.dot,
                  { backgroundColor: reached ? ESTADO_LABELS[estado].color : "#E0E0E0" },
                ]}
              />
              <Text
                style={[
                  stepperStyles.stepLabel,
                  { color: reached ? "#333" : "#AAA", fontWeight: reached ? "bold" : "normal" },
                ]}
              >
                {ESTADO_LABELS[estado].label}
              </Text>
            </View>
            {!isLast && (
              <View
                style={[
                  stepperStyles.line,
                  { backgroundColor: index < currentIndex ? ESTADO_LABELS[estado].color : "#E0E0E0" },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export default function PedidosScreen() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    // onSnapshot mantiene esta lista actualizada en tiempo real: si el estado
    // de un pedido cambia (por ejemplo desde el panel de gestión), se refleja
    // aquí al instante, sin recargar la pantalla.
    const unsubscribe = suscribirsePedidosUsuario(user.uid, (data) => {
      setPedidos(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.pedidoId}>Pedido #{item.id.slice(0, 6).toUpperCase()}</Text>
                <Text style={styles.fecha}>{formatFecha(item.createdAt)}</Text>
              </View>

              <StatusStepper status={item.status} />

              <View style={styles.divider} />

              {item.items.map((prod) => (
                <Text key={prod.id} style={styles.itemLine}>
                  {prod.quantity}x {prod.name}
                </Text>
              ))}

              {item.address && (
                <Text style={styles.addressLine}>
                  📍 {item.address.name} — {item.address.addressLine}
                </Text>
              )}

              <Text style={styles.total}>Total: ${item.total.toLocaleString()}</Text>
            </View>
          )}
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
  fecha: { color: "#888", fontSize: 12 },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 10 },
  itemLine: { color: "#555", fontSize: 14, marginBottom: 2 },
  addressLine: { color: "#666", fontSize: 12, marginTop: 8 },
  total: { marginTop: 8, fontWeight: "bold", fontSize: 15, color: "#83c41a" },
});

const stepperStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", marginTop: 12 },
  stepContainer: { alignItems: "center", width: 60 },
  dot: { width: 14, height: 14, borderRadius: 7, marginBottom: 4 },
  stepLabel: { fontSize: 10, textAlign: "center" },
  line: { flex: 1, height: 2, marginTop: 6 },
});