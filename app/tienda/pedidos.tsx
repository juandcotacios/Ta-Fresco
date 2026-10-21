import { useAppTheme } from '@/src/contexts/ThemeContext';
import { colors, radius, shadow } from "@/constants/designSystem";
import { db } from "@/src/config/firebase";
import {
  actualizarEstadoProveedor,
  ESTADO_LABELS,
  EstadoPedido,
  labelEstado,
  obtenerEstadoProveedor,
  ORDEN_ESTADOS,
  Pedido,
  suscribirsePedidosDeProveedor,
} from "@/src/services/pedidosService";
import { Comprador } from "@/src/services/usuariosService";
import { avisar } from "@/src/utils/dialogos";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function PedidosDeMiTiendaScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
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

  // Cancelación en línea (dentro de la misma tarjeta) en vez de una ventana
  // emergente del navegador, con un motivo obligatorio. El tendero solo
  // cancela SU parte del pedido; el resto de tiendas no se ven afectadas.
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [enviandoCancelacion, setEnviandoCancelacion] = useState(false);

  const confirmarCancelacion = async (pedido: Pedido) => {
    if (!user || !motivoCancelacion.trim()) return;
    setEnviandoCancelacion(true);
    try {
      await actualizarEstadoProveedor(pedido.id, user.uid, "cancelado" as EstadoPedido, motivoCancelacion);
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
            const estado = labelEstado(estadoPropio);
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
                  cancelandoId === item.id ? (
                    <View style={styles.cancelForm}>
                      <Text style={styles.cancelFormLabel}>¿Por qué cancelas este pedido?</Text>
                      <TextInput
                        style={styles.cancelInput}
                        placeholder="Ej: no queda stock"
                        placeholderTextColor={colors.textMuted}
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
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
  itemLine: { color: colors.textSecondary, fontSize: 14, marginBottom: 2 },
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
  cancelForm: {
    marginTop: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
  },
  cancelFormLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  cancelInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    minHeight: 50,
    textAlignVertical: "top",
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelFormActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
  cancelFormBackBtn: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 10,
    backgroundColor: "#F0F0F0",
  },
  cancelFormBackText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  cancelFormConfirmBtn: { backgroundColor: colors.danger, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginLeft: 10 },
  cancelFormConfirmText: { color: colors.white, fontWeight: "600", fontSize: 13 },
});
