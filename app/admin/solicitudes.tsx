import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import {
  obtenerSolicitudesPendientes,
  aprobarSolicitud,
  rechazarSolicitud,
  SolicitudTiendaConId,
} from "@/src/services/solicitudesService";
import { Comprador } from "@/src/services/usuariosService";

export default function AdminSolicitudesScreen() {
  const router = useRouter();
  const miUid = getAuth().currentUser?.uid;

  const [solicitudes, setSolicitudes] = useState<SolicitudTiendaConId[]>([]);
  const [solicitantes, setSolicitantes] = useState<Record<string, Comprador>>({});
  const [loading, setLoading] = useState(true);
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Confirmación en línea (dentro de la misma tarjeta) en vez de una ventana
  // emergente: null cuando no se está confirmando nada.
  const [confirmando, setConfirmando] = useState<{ id: string; aprobar: boolean } | null>(null);

  const cargar = async () => {
    setLoading(true);
    setConfirmando(null);
    try {
      const data = await obtenerSolicitudesPendientes();
      setSolicitudes(data);

      // Nombre y correo de quien solicita, para que el admin sepa a quién le da el rol.
      const ids = [...new Set(data.map((s) => s.userId))];
      const perfiles = await Promise.all(
        ids.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            return [uid, (snap.data() as Comprador) || {}] as const;
          } catch {
            return [uid, {} as Comprador] as const;
          }
        })
      );
      setSolicitantes(Object.fromEntries(perfiles));
    } catch (error) {
      console.log("Error cargando solicitudes:", error);
      setErrorMsg("No se pudieron cargar las solicitudes.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setErrorMsg(null);
      cargar();
    }, [])
  );

  const resolver = async (solicitud: SolicitudTiendaConId, aprobar: boolean) => {
    if (!miUid) return;
    setErrorMsg(null);
    setResolviendoId(solicitud.id);
    try {
      if (aprobar) await aprobarSolicitud(solicitud, miUid);
      else await rechazarSolicitud(solicitud, miUid);
      setSolicitudes((prev) => prev.filter((s) => s.id !== solicitud.id));
    } catch (error: any) {
      console.log("Error resolviendo solicitud:", error);
      setErrorMsg(error?.message || "No se pudo resolver la solicitud.");
    } finally {
      setResolviendoId(null);
    }
  };

  const formatFecha = (s: SolicitudTiendaConId) => {
    if (!s.createdAt?.toDate) return "";
    return s.createdAt.toDate().toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Solicitudes de tienda</Text>
      </View>

      {errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#83c41a" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={solicitudes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.empty}>No hay solicitudes pendientes.</Text>}
          renderItem={({ item }) => {
            const persona = solicitantes[item.userId];
            const resolviendo = resolviendoId === item.id;
            return (
              <View style={styles.card}>
                <Text style={styles.storeName}>{item.nombre}</Text>
                {!!item.descripcion && <Text style={styles.desc}>{item.descripcion}</Text>}

                <Text style={styles.person}>
                  {persona?.nickname || "Sin nombre"}
                  {persona?.email ? ` · ${persona.email}` : ""}
                </Text>
                {!!formatFecha(item) && <Text style={styles.date}>Enviada el {formatFecha(item)}</Text>}

                {confirmando?.id === item.id ? (
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmText}>
                      {confirmando.aprobar
                        ? `${persona?.nickname || "Este usuario"} pasará a ser tendero.`
                        : "Se rechazará esta solicitud."}
                    </Text>
                    <View style={styles.confirmButtons}>
                      <TouchableOpacity
                        onPress={() => setConfirmando(null)}
                        style={styles.confirmCancelBtn}
                      >
                        <Text style={styles.confirmCancelText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          const aprobar = confirmando.aprobar;
                          setConfirmando(null);
                          resolver(item, aprobar);
                        }}
                        style={[
                          styles.confirmYesBtn,
                          confirmando.aprobar ? styles.approveBtn : styles.rejectSolidBtn,
                        ]}
                      >
                        <Text style={styles.confirmYesText}>
                          {confirmando.aprobar ? "Sí, aprobar" : "Sí, rechazar"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      disabled={resolviendo}
                      onPress={() => setConfirmando({ id: item.id, aprobar: false })}
                      style={[styles.btn, styles.rejectBtn]}
                    >
                      <Text style={styles.rejectText}>Rechazar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={resolviendo}
                      onPress={() => setConfirmando({ id: item.id, aprobar: true })}
                      style={[styles.btn, styles.approveBtn]}
                    >
                      {resolviendo ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.approveText}>Aprobar</Text>
                      )}
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
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  title: { fontSize: 20, fontWeight: "bold", color: "#333" },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
  errorBox: {
    backgroundColor: "#FFEBEE",
    marginHorizontal: 16,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorText: { color: "#D32F2F", fontSize: 13 },
  card: {
    backgroundColor: "#f9f9f9",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  storeName: { fontWeight: "bold", fontSize: 16, color: "#333" },
  desc: { color: "#555", fontSize: 13, marginTop: 4 },
  person: { color: "#666", fontSize: 12, marginTop: 10 },
  date: { color: "#999", fontSize: 11, marginTop: 2 },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  btn: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginLeft: 10,
    minWidth: 96,
    alignItems: "center",
  },
  rejectBtn: { borderWidth: 1.5, borderColor: "#D32F2F" },
  rejectText: { color: "#D32F2F", fontWeight: "600", fontSize: 13 },
  approveBtn: { backgroundColor: "#83c41a" },
  approveText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  confirmRow: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  confirmText: { color: "#333", fontSize: 13, marginBottom: 10 },
  confirmButtons: { flexDirection: "row", justifyContent: "flex-end" },
  confirmCancelBtn: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 10,
    backgroundColor: "#F0F0F0",
  },
  confirmCancelText: { color: "#555", fontWeight: "600", fontSize: 13 },
  confirmYesBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginLeft: 10 },
  confirmYesText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  rejectSolidBtn: { backgroundColor: "#D32F2F" },
});