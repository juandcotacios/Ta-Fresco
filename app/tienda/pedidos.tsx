import { colors, radius, shadow } from "@/constants/designSystem";
import { db } from "@/src/config/firebase";
import {
  actualizarEstadoProveedor,
  ESTADO_LABELS,
  EstadoPedido,
  obtenerEstadoProveedor,
  ORDEN_ESTADOS,
  Pedido,
  suscribirsePedidosDeProveedor,
} from "@/src/services/pedidosService";
import { Comprador } from "@/src/services/usuariosService";
import { avisar, confirmar } from "@/src/utils/dialogos";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function PedidosDeMiTiendaScreen() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [compradores, setCompradores] = useState<Record<string, Comprador>>({});

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const unsubscribe = suscribirsePedidosDeProveedor(user.uid, (data) => {
      setPedidos(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    pedidos.forEach((p) => {
      if (p.userId && !compradores[p.userId]) {
        getDoc(doc(db, "users", p.userId))
          .then((snap) => {
            if (snap.exists()) {
              const data = snap.data() as any;
              setCompradores((prev) => ({
                ...prev,
                [p.userId]: { nickname: data.nickname, phone: data.phone, email: data.email },
              }));
            }
          })
          .catch((e) => console.log(e));
      }
    });
  }, [pedidos]);

  const avanzarEstado = async (pedido: Pedido) => {
    if (!user) return;
    const estadoPropio = obtenerEstadoProveedor(pedido, user.uid);
    const currentIndex = ORDEN_ESTADOS.indexOf(estadoPropio);
    if (currentIndex === -1 || currentIndex === ORDEN_ESTADOS.length - 1) return;
    const siguiente = ORDEN_ESTADOS[currentIndex + 1];
    try {
      await actualizarEstadoProveedor(pedido.id, user.uid, siguiente);
    } catch (error) {
      console.log(error);
      avisar("Error", "No se pudo actualizar el estado.");
    }
  };

  const cancelarPedido = (pedido: Pedido) => {
    confirmar(
      "Cancelar pedido",
      `¿Cancelar el pedido #${pedido.id.slice(0, 6).toUpperCase()}? Las unidades volverán al inventario.`,
      async () => {
        try {
          if (user) await actualizarEstadoProveedor(pedido.id, user.uid, "cancelado" as EstadoPedido);
        } catch (error) {
          console.log(error);
          avisar("Error", "No se pudo cancelar el pedido.");
        }
      },
      "Sí, cancelar",
      true
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pedidos de mi tienda</Text>
      </View>

      {loading ? (
        <Text style={{ textAlign: "center", marginTop: 40, color: colors.textMuted }}>Cargando...</Text>
      ) : (
        <FlatList
          data={pedidos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={styles.empty}>Todavía no te han hecho ningún pedido.</Text>
          }
          renderItem={({ item }) => {
            const estadoPropio = user ? obtenerEstadoProveedor(item, user.uid) : item.status;
            const estado = ESTADO_LABELS[estadoPropio];
            const esFinal = estadoPropio === "entregado" || estadoPropio === "cancelado";
            const currentIndex = ORDEN_ESTADOS.indexOf(estadoPropio);
            const siguienteLabel =
              currentIndex >= 0 && currentIndex < ORDEN_ESTADOS.length - 1
                ? ESTADO_LABELS[ORDEN_ESTADOS[currentIndex + 1]].label
                : null;

            const misItems = item.items.filter((i) => i.proveedorId === user?.uid);
            const comprador = compradores[item.userId];

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.pedidoId}>#{item.id.slice(0, 6).toUpperCase()}</Text>
                  <View style={[styles.badge, { backgroundColor: estado.color }]}>
                    <Text style={styles.badgeText}>{estado.label}</Text>
                  </View>
                </View>

                <View style={styles.compradorBox}>
                  <Ionicons name="person-circle-outline" size={16} color={colors.textSecondary} />
                  <View style={{ marginLeft: 6, flex: 1 }}>
                    <Text style={styles.compradorNombre}>{comprador?.nickname || "Cargando..."}</Text>
                    {!!comprador?.phone && <Text style={styles.compradorDato}>📞 {comprador.phone}</Text>}
                  </View>
                </View>

                {misItems.map((prod) => (
                  <Text key={prod.id} style={styles.itemLine}>
                    {prod.quantity}x {prod.name}
                  </Text>
                ))}

                {item.proveedorIds.length > 1 && (
                  <Text style={styles.independentStatus}>
                    Este estado corresponde solo a los productos de tu tienda.
                  </Text>
                )}

                {item.address && (
                  <Text style={styles.addressLine}>
                    📍 {item.address.name} — {item.address.addressLine}
                  </Text>
                )}
                <Text style={styles.paymentLine}>
                  💳 {item.paymentMethod === "card" ? "Tarjeta" : item.paymentMethod === "nequi" ? "Nequi" : "Contraentrega"}
                </Text>

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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 55,
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: "center", alignItems: "center",
    marginRight: 10,
    ...shadow.card,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: colors.textPrimary },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 30 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
    ...shadow.card,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  pedidoId: { fontWeight: "bold", fontSize: 15, color: colors.textPrimary },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: "bold" },
  compradorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  compradorNombre: { fontWeight: "bold", fontSize: 13, color: colors.textPrimary },
  compradorDato: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  itemLine: { color: "#555", fontSize: 14, marginBottom: 2 },
  independentStatus: { color: colors.primaryDark, fontSize: 12, marginTop: 7, fontWeight: "600" },
  addressLine: { color: colors.textSecondary, fontSize: 12, marginTop: 6 },
  paymentLine: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  actions: { flexDirection: "row", marginTop: 12 },
  advanceBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 10,
  },
  advanceBtnText: { color: colors.white, fontWeight: "bold", fontSize: 13 },
  cancelBtn: {
    backgroundColor: colors.dangerLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  cancelBtnText: { color: colors.danger, fontWeight: "bold", fontSize: 13 },
});
