import { colors, radius, shadow } from "@/constants/designSystem";
import { auth } from "@/src/config/firebase";
import {
  ESTADO_LABELS,
  EstadoPedido,
  ORDEN_ESTADOS,
  Pedido,
  labelEstado,
  obtenerEstadoProveedor,
  suscribirsePedidosUsuario,
} from "@/src/services/pedidosService";
import {
  crearValoracion,
  obtenerValoracionesUsuario,
} from "@/src/services/valoracionesService";
import { avisar } from "@/src/utils/dialogos";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

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
                  { color: reached ? colors.textPrimary : "#AAA", fontWeight: reached ? "bold" : "normal" },
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
  const router = useRouter();
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

    // Solo los productos con estrellas que aún no fueron calificados: una calificación
    // guardada no se puede modificar, así que reenviarla fallaría.
    const entradas = Object.entries(ratingsPorProducto).filter(
      ([productoId, rating]) => rating > 0 && !calificados.has(`${pedidoActivo.id}:${productoId}`)
    );
    if (entradas.length === 0) return;

    setGuardando(true);
    const guardados: string[] = [];
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
        guardados.push(productoId);
      }
      setModalVisible(false);
    } catch (error) {
      console.log(error);
      avisar(
        "No se pudo guardar",
        guardados.length > 0
          ? "Se guardaron algunas calificaciones, pero otra falló. Las ya enviadas no se pueden modificar; vuelve a intentarlo con las que faltan."
          : "No pudimos guardar tu calificación. Revisa tu conexión e inténtalo de nuevo."
      );
    } finally {
      // Se marcan como calificados los que sí se guardaron, aunque otro haya fallado.
      if (guardados.length > 0) {
        setCalificados((prev) => {
          const nuevo = new Set(prev);
          guardados.forEach((productoId) => nuevo.add(`${pedidoActivo.id}:${productoId}`));
          return nuevo;
        });
      }
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Mis pedidos</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const itemsDelModal = pedidoActivo && proveedorActivo
    ? pedidoActivo.items.filter((i) => i.proveedorId === proveedorActivo)
    : [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Mis pedidos</Text>
      </View>

      {pedidos.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="receipt-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Todavía no has hecho pedidos</Text>
          <Text style={styles.emptySubtitle}>
            Cuando compres algo, aparecerá aquí con su estado y seguimiento.
          </Text>
        </View>
      ) : (
        <FlatList
          data={pedidos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.pedidoId}>Pedido #{item.id.slice(0, 6).toUpperCase()}</Text>
                  <Text style={styles.fecha}>{formatFecha(item.createdAt)}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: labelEstado(item.status).color + "22" }]}>
                  <Text style={[styles.statusPillText, { color: labelEstado(item.status).color }]}>
                    {labelEstado(item.status).label}
                  </Text>
                </View>
              </View>

              <StatusStepper status={item.status} />

              {item.status === "cancelado" &&
                item.proveedorIds.length === 1 &&
                !!item.motivosCancelacion?.[item.proveedorIds[0]] && (
                  <Text style={styles.motivoLine}>
                    Motivo: {item.motivosCancelacion[item.proveedorIds[0]]}
                  </Text>
                )}

              <View style={styles.divider} />

              {item.items.map((prod) => (
                <View key={prod.id} style={styles.itemRow}>
                  <View style={styles.itemQtyBadge}>
                    <Text style={styles.itemQtyText}>{prod.quantity}</Text>
                  </View>
                  <Text style={styles.itemLine} numberOfLines={1}>{prod.name}</Text>
                </View>
              ))}

              {item.proveedorIds.length > 1 && (
                <View style={styles.storeStatuses}>
                  <Text style={styles.storeStatusesTitle}>Estado por tienda</Text>
                  {item.proveedorIds.map((proveedorId, index) => {
                    const estadoTienda = obtenerEstadoProveedor(item, proveedorId);
                    const motivoTienda = item.motivosCancelacion?.[proveedorId];
                    return (
                      <View key={proveedorId} style={styles.storeStatusBlock}>
                        <View style={styles.storeStatusRow}>
                          <Text style={styles.storeStatusName}>Tienda {index + 1}</Text>
                          <Text style={[styles.storeStatusValue, { color: labelEstado(estadoTienda).color }]}>
                            {labelEstado(estadoTienda).label}
                          </Text>
                        </View>
                        {estadoTienda === "cancelado" && !!motivoTienda && (
                          <Text style={styles.motivoLineSmall}>Motivo: {motivoTienda}</Text>
                        )}
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
                          color={todoCalificado ? colors.primary : "#f0a500"}
                        />
                        <Text style={[styles.rateBtnText, todoCalificado && { color: colors.primaryDark }]}>
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
              placeholderTextColor={colors.textMuted}
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
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Enviar calificaciones</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModalVisible(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textMuted, textAlign: "center" }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: "center", alignItems: "center",
    marginRight: 14,
  },
  title: { fontSize: 20, fontWeight: "bold", color: colors.textPrimary },
  empty: { color: colors.textMuted, fontSize: 16 },
  emptyState: { alignItems: "center", paddingHorizontal: 40, marginTop: 60 },
  emptyIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primaryLight,
    justifyContent: "center", alignItems: "center",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 6, textAlign: "center" },
  emptySubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 18,
    marginBottom: 16,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  pedidoId: { fontWeight: "bold", fontSize: 15, color: colors.textPrimary },
  fecha: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 10 },
  itemRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  itemQtyBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primaryLight,
    justifyContent: "center", alignItems: "center",
    marginRight: 8, paddingHorizontal: 4,
  },
  itemQtyText: { fontSize: 11, fontWeight: "bold", color: colors.primaryDark },
  itemLine: { color: "#555", fontSize: 14, flex: 1 },
  storeStatuses: { marginTop: 10, padding: 10, backgroundColor: colors.background, borderRadius: 10 },
  storeStatusesTitle: { color: "#555", fontSize: 12, fontWeight: "bold", marginBottom: 5 },
  storeStatusBlock: { paddingVertical: 2 },
  storeStatusRow: { flexDirection: "row", justifyContent: "space-between" },
  storeStatusName: { color: colors.textSecondary, fontSize: 12 },
  storeStatusValue: { fontWeight: "bold", fontSize: 12 },
  motivoLine: { color: colors.danger, fontSize: 12, marginTop: 4, fontStyle: "italic" },
  motivoLineSmall: { color: colors.danger, fontSize: 11, marginTop: 2, fontStyle: "italic" },
  addressLine: { color: colors.textSecondary, fontSize: 12, marginTop: 8 },
  total: { marginTop: 8, fontWeight: "bold", fontSize: 15, color: colors.primary },
  rateSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10 },
  rateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warningLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  rateBtnDone: { backgroundColor: colors.successLight },
  rateBtnText: { marginLeft: 6, fontSize: 12, fontWeight: "600", color: "#B45309" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: colors.surface, width: "88%", borderRadius: radius.xl, padding: 22 },
  modalTitle: { fontSize: 17, fontWeight: "bold", color: colors.textPrimary, textAlign: "center", marginBottom: 16 },
  productRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  productName: { flex: 1, fontSize: 13, color: colors.textPrimary, marginRight: 8 },
  yaCalificadoText: { fontSize: 12, color: colors.primary, fontWeight: "600" },
  commentInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    height: 60,
    textAlignVertical: "top",
    marginTop: 14,
    marginBottom: 16,
    fontSize: 13,
    color: colors.textPrimary,
  },
  submitBtn: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 22, alignItems: "center" },
  submitBtnText: { color: colors.white, fontWeight: "bold", fontSize: 15 },
});

const stepperStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", marginTop: 12 },
  stepContainer: { alignItems: "center", width: 60 },
  dot: { width: 14, height: 14, borderRadius: 7, marginBottom: 4 },
  stepLabel: { fontSize: 10, textAlign: "center" },
  line: { flex: 1, height: 2, marginTop: 6 },
});
