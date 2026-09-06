import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/config/firebase";
import {
  suscribirsePedidosUsuario,
  Pedido,
  EstadoPedido,
  ESTADO_LABELS,
  ORDEN_ESTADOS,
  obtenerEstadoProveedor,
} from "@/src/services/pedidosService";
import {
  crearValoracion,
  obtenerValoracionesUsuario,
} from "@/src/services/valoracionesService";

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
  // Set de "pedidoId:productoId" ya calificados
  const [calificados, setCalificados] = useState<Set<string>>(new Set());

  const [modalVisible, setModalVisible] = useState(false);
  const [pedidoActivo, setPedidoActivo] = useState<Pedido | null>(null);
  const [proveedorActivo, setProveedorActivo] = useState<string | null>(null);
  const [ratingsPorProducto, setRatingsPorProducto] = useState<Record<string, number>>({});
  const [comentario, setComentario] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargarCalificados = async (userId: string) => {
    const valoraciones = await obtenerValoracionesUsuario(userId);
    setCalificados(new Set(valoraciones.map((v) => `${v.pedidoId}:${v.productoId}`)));
  };

  useEffect(() => {
    // currentUser puede ser null justo después de un F5 mientras Firebase
    // restaura la sesión. Esperar el cambio de autenticación evita quedarse
    // sin la suscripción de pedidos de la sesión ya existente.
    let unsubscribePedidos: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribePedidos?.();
      setPedidos([]);

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      cargarCalificados(user.uid);
      unsubscribePedidos = suscribirsePedidosUsuario(user.uid, (data) => {
        setPedidos(data);
        setLoading(false);
      });
    });

    return () => {
      unsubscribePedidos?.();
      unsubscribeAuth();
    };
  }, []);

  const productosPendientesDeCalificar = (pedido: Pedido, proveedorId: string) => {
    return pedido.items.filter(
      (i) => i.proveedorId === proveedorId && !calificados.has(`${pedido.id}:${i.id}`)
    );
  };

  const abrirCalificar = (pedido: Pedido, proveedorId: string) => {
    setPedidoActivo(pedido);
    setProveedorActivo(proveedorId);
    setRatingsPorProducto({});
    setComentario("");
    setModalVisible(true);
  };

  const enviarValoraciones = async () => {
    const user = auth.currentUser;
    if (!user || !pedidoActivo || !proveedorActivo) return;

    const entradas = Object.entries(ratingsPorProducto).filter(([, rating]) => rating > 0);
    if (entradas.length === 0) return;

    setGuardando(true);
    try {
      for (const [productoId, rating] of entradas) {
        const item = pedidoActivo.items.find((i) => i.id === productoId);
        await crearValoracion(
          pedidoActivo.id,
          proveedorActivo,
          productoId,
          item?.name || "Producto",
          user.uid,
          rating,
          comentario
        );
      }
      setCalificados((prev) => {
        const nuevo = new Set(prev);
        entradas.forEach(([productoId]) => nuevo.add(`${pedidoActivo.id}:${productoId}`));
        return nuevo;
      });
      setModalVisible(false);
    } catch (error) {
      console.log(error);
    } finally {
      setGuardando(false);
    }
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

  const itemsDelModal = pedidoActivo && proveedorActivo
    ? pedidoActivo.items.filter((i) => i.proveedorId === proveedorActivo)
    : [];

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

              {item.proveedorIds.length > 1 && (
                <View style={styles.storeStatuses}>
                  <Text style={styles.storeStatusesTitle}>Estado por tienda</Text>
                  {item.proveedorIds.map((proveedorId, index) => {
                    const estadoTienda = obtenerEstadoProveedor(item, proveedorId);
                    return (
                      <View key={proveedorId} style={styles.storeStatusRow}>
                        <Text style={styles.storeStatusName}>Tienda {index + 1}</Text>
                        <Text style={[styles.storeStatusValue, { color: ESTADO_LABELS[estadoTienda].color }]}>
                          {ESTADO_LABELS[estadoTienda].label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {item.address && (
                <Text style={styles.addressLine}>
                  📍 {item.address.name} — {item.address.addressLine}
                </Text>
              )}

              <Text style={styles.total}>Total: ${item.total.toLocaleString()}</Text>

              {item.proveedorIds && item.proveedorIds.some(
                (proveedorId) => obtenerEstadoProveedor(item, proveedorId) === "entregado"
              ) && (
                <View style={styles.rateSection}>
                  {item.proveedorIds.map((proveedorId) => {
                    const pendientes = productosPendientesDeCalificar(item, proveedorId);
                    const todoCalificado = pendientes.length === 0;
                    const entregadoPorEstaTienda = obtenerEstadoProveedor(item, proveedorId) === "entregado";
                    if (!entregadoPorEstaTienda) return null;
                    return (
                      <TouchableOpacity
                        key={proveedorId}
                        style={[styles.rateBtn, todoCalificado && styles.rateBtnDone]}
                        onPress={() => !todoCalificado && abrirCalificar(item, proveedorId)}
                        disabled={todoCalificado}
                      >
                        <Ionicons
                          name={todoCalificado ? "checkmark-circle" : "star-outline"}
                          size={16}
                          color={todoCalificado ? "#22c55e" : "#f0a500"}
                        />
                        <Text style={[styles.rateBtnText, todoCalificado && { color: "#22c55e" }]}>
                          {todoCalificado
                            ? "Productos calificados"
                            : `Calificar ${pendientes.length} producto${pendientes.length > 1 ? "s" : ""}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Califica tus productos</Text>

            <ScrollView style={{ maxHeight: 280 }}>
              {itemsDelModal.map((item) => {
                const yaCalificado = pedidoActivo && calificados.has(`${pedidoActivo.id}:${item.id}`);
                const ratingActual = ratingsPorProducto[item.id] || 0;
                return (
                  <View key={item.id} style={styles.productRow}>
                    <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                    {yaCalificado ? (
                      <Text style={styles.yaCalificadoText}>Ya calificado</Text>
                    ) : (
                      <View style={{ flexDirection: "row" }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <TouchableOpacity
                            key={n}
                            onPress={() =>
                              setRatingsPorProducto((prev) => ({ ...prev, [item.id]: n }))
                            }
                          >
                            <Ionicons
                              name={n <= ratingActual ? "star" : "star-outline"}
                              size={22}
                              color="#f0a500"
                              style={{ marginHorizontal: 1 }}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <TextInput
              style={styles.commentInput}
              placeholder="Contanos cómo fue tu experiencia (opcional, aplica a todos)"
              value={comentario}
              onChangeText={setComentario}
              multiline
            />

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (Object.values(ratingsPorProducto).every((r) => !r) || guardando) && { opacity: 0.5 },
              ]}
              onPress={enviarValoraciones}
              disabled={Object.values(ratingsPorProducto).every((r) => !r) || guardando}
            >
              {guardando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Enviar calificaciones</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModalVisible(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: "#999", textAlign: "center" }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  storeStatuses: { marginTop: 10, padding: 10, backgroundColor: "#fff", borderRadius: 10 },
  storeStatusesTitle: { color: "#555", fontSize: 12, fontWeight: "bold", marginBottom: 5 },
  storeStatusRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  storeStatusName: { color: "#777", fontSize: 12 },
  storeStatusValue: { fontWeight: "bold", fontSize: 12 },
  addressLine: { color: "#666", fontSize: 12, marginTop: 8 },
  total: { marginTop: 8, fontWeight: "bold", fontSize: 15, color: "#83c41a" },
  rateSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 10 },
  rateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF8E1",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  rateBtnDone: { backgroundColor: "#E8F5E9" },
  rateBtnText: { marginLeft: 6, fontSize: 12, fontWeight: "600", color: "#EF6C00" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "#fff", width: "88%", borderRadius: 20, padding: 22 },
  modalTitle: { fontSize: 17, fontWeight: "bold", color: "#333", textAlign: "center", marginBottom: 16 },
  productRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  productName: { flex: 1, fontSize: 13, color: "#333", marginRight: 8 },
  yaCalificadoText: { fontSize: 12, color: "#22c55e", fontWeight: "600" },
  commentInput: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 12,
    height: 60,
    textAlignVertical: "top",
    marginTop: 14,
    marginBottom: 16,
    fontSize: 13,
  },
  submitBtn: { backgroundColor: "#83c41a", paddingVertical: 14, borderRadius: 22, alignItems: "center" },
  submitBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
});

const stepperStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", marginTop: 12 },
  stepContainer: { alignItems: "center", width: 60 },
  dot: { width: 14, height: 14, borderRadius: 7, marginBottom: 4 },
  stepLabel: { fontSize: 10, textAlign: "center" },
  line: { flex: 1, height: 2, marginTop: 6 },
});
