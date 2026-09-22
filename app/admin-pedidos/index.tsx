import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import {
  suscribirseTodosLosPedidos,
  actualizarEstadoPedido,
  Pedido,
  EstadoPedido,
  ESTADO_LABELS,
  ORDEN_ESTADOS,
} from "@/src/services/pedidosService";
import { avisar } from "@/src/utils/dialogos";
import { Comprador } from "@/src/services/usuariosService";

export default function AdminPedidosScreen() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [compradores, setCompradores] = useState<Record<string, Comprador>>({});

  useEffect(() => {
    const unsubscribe = suscribirseTodosLosPedidos(setPedidos);
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
    const currentIndex = ORDEN_ESTADOS.indexOf(pedido.status);
    if (currentIndex === -1 || currentIndex === ORDEN_ESTADOS.length - 1) return;
    const siguiente = ORDEN_ESTADOS[currentIndex + 1];
    try {
      await actualizarEstadoPedido(pedido.id, siguiente);
    } catch (error) {
      console.log(error);
      avisar("Error", "No se pudo actualizar el estado.");
    }
  };

  // Cancelación en línea (dentro de la misma tarjeta) en vez de una ventana
  // emergente, con un motivo obligatorio. El admin cancela TODO el pedido:
  // el mismo motivo se guarda para cada tienda involucrada.
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [enviandoCancelacion, setEnviandoCancelacion] = useState(false);

  const confirmarCancelacion = async (pedido: Pedido) => {
    if (!motivoCancelacion.trim()) return;
    setEnviandoCancelacion(true);
    try {
      await actualizarEstadoPedido(pedido.id, "cancelado" as EstadoPedido, motivoCancelacion);
      setCancelandoId(null);
      setMotivoCancelacion("");
    } catch (error) {
      console.log(error);
      avisar("Error", "No se pudo cancelar el pedido.");
    } finally {
      setEnviandoCancelacion(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Panel de Pedidos</Text>
      </View>

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
                <Ionicons name="person-circle-outline" size={16} color="#555" />
                <View style={{ marginLeft: 6, flex: 1 }}>
                  <Text style={styles.compradorNombre}>{comprador?.nickname || "Cargando..."}</Text>
                  {!!comprador?.phone && <Text style={styles.compradorDato}>📞 {comprador.phone}</Text>}
                  {!!comprador?.email && <Text style={styles.compradorDato}>✉️ {comprador.email}</Text>}
                </View>
              </View>

              <Text style={styles.total}>Total: ${item.total.toLocaleString()}</Text>
              {item.address && (
                <Text style={styles.addressLine}>
                  📍 {item.address.name} — {item.address.addressLine}
                </Text>
              )}
              <Text style={styles.paymentLine}>
                💳 {item.paymentMethod === "card" ? "Tarjeta" : item.paymentMethod === "nequi" ? "Nequi" : "Contraentrega"}
              </Text>

              {!esFinal && (
                cancelandoId === item.id ? (
                  <View style={styles.cancelForm}>
                    <Text style={styles.cancelFormLabel}>
                      {item.proveedorIds.length > 1
                        ? "¿Por qué cancelas este pedido? Se cancelará en TODAS las tiendas."
                        : "¿Por qué cancelas este pedido?"}
                    </Text>
                    <TextInput
                      style={styles.cancelInput}
                      placeholder="Ej: el cliente pidió cancelar"
                      value={motivoCancelacion}
                      onChangeText={setMotivoCancelacion}
                      multiline
                      autoFocus
                    />
                    <View style={styles.cancelFormActions}>
                      <TouchableOpacity
                        onPress={() => { setCancelandoId(null); setMotivoCancelacion(""); }}
                        style={styles.cancelFormBackBtn}
                      >
                        <Text style={styles.cancelFormBackText}>Atrás</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => confirmarCancelacion(item)}
                        disabled={!motivoCancelacion.trim() || enviandoCancelacion}
                        style={[
                          styles.cancelFormConfirmBtn,
                          (!motivoCancelacion.trim() || enviandoCancelacion) && { opacity: 0.5 },
                        ]}
                      >
                        <Text style={styles.cancelFormConfirmText}>
                          {enviandoCancelacion ? "Cancelando..." : "Confirmar cancelación"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.actions}>
                    {siguienteLabel && (
                      <TouchableOpacity style={styles.advanceBtn} onPress={() => avanzarEstado(item)}>
                        <Text style={styles.advanceBtnText}>Avanzar a: {siguienteLabel}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => { setCancelandoId(item.id); setMotivoCancelacion(""); }}
                    >
                      <Text style={styles.cancelBtnText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                )
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
  compradorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  compradorNombre: { fontWeight: "bold", fontSize: 13, color: "#333" },
  compradorDato: { fontSize: 12, color: "#777", marginTop: 2 },
  total: { marginTop: 8, fontWeight: "bold", fontSize: 15, color: "#83c41a" },
  addressLine: { color: "#666", fontSize: 12, marginTop: 4 },
  paymentLine: { color: "#666", fontSize: 12, marginTop: 4 },
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
  cancelForm: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cancelFormLabel: { color: "#333", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  cancelInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    minHeight: 50,
    textAlignVertical: "top",
  },
  cancelFormActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
  cancelFormBackBtn: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 10,
    backgroundColor: "#F0F0F0",
  },
  cancelFormBackText: { color: "#555", fontWeight: "600", fontSize: 13 },
  cancelFormConfirmBtn: { backgroundColor: "#D32F2F", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginLeft: 10 },
  cancelFormConfirmText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});