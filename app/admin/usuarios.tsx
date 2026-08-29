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
import {
  obtenerTodosLosUsuarios,
  actualizarRolUsuario,
  UsuarioConId,
  Rol,
} from "@/src/services/usuariosService";

const ROLES: { value: Rol; label: string; color: string }[] = [
  { value: "cliente", label: "Cliente", color: "#888" },
  { value: "tendero", label: "Tendero", color: "#3b82f6" },
  { value: "admin", label: "Admin", color: "#D32F2F" },
];

export default function AdminUsuariosScreen() {
  const router = useRouter();
  const auth = getAuth();
  const miUid = auth.currentUser?.uid;

  const [usuarios, setUsuarios] = useState<UsuarioConId[]>([]);
  const [loading, setLoading] = useState(true);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cargar = async () => {
    console.log("Cargando lista de usuarios...");
    setLoading(true);
    try {
      const data = await obtenerTodosLosUsuarios();
      console.log("Usuarios cargados:", data.length);
      setUsuarios(data);
    } catch (error) {
      console.log("Error cargando usuarios:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [])
  );

  const cambiarRol = async (usuario: UsuarioConId, nuevoRol: Rol) => {
    console.log("=== Intentando cambiar rol ===");
    console.log("Mi uid (admin logueado):", miUid);
    console.log("Usuario objetivo:", usuario.id, usuario.email);
    console.log("Rol actual:", usuario.role, "-> Rol nuevo:", nuevoRol);

    if (usuario.id === miUid && nuevoRol !== "admin") {
      console.log("Bloqueado: intentando quitarte admin a vos mismo");
      setErrorMsg("No podés quitarte el rol de admin a vos mismo desde aquí.");
      return;
    }

    setErrorMsg(null);
    setCambiandoId(usuario.id);
    try {
      await actualizarRolUsuario(usuario.id, nuevoRol);
      console.log("Rol actualizado en Firestore correctamente");
      await cargar();
    } catch (error: any) {
      console.log("ERROR actualizando rol:", error);
      setErrorMsg(error?.message || "No se pudo cambiar el rol.");
    } finally {
      setCambiandoId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Usuarios</Text>
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
          data={usuarios}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.empty}>No hay usuarios.</Text>}
          renderItem={({ item }) => {
            const rolActual = item.role || "cliente";
            const cambiando = cambiandoId === item.id;
            return (
              <View style={styles.card}>
                <Text style={styles.name}>{item.nickname || "Sin nombre"}</Text>
                <Text style={styles.email}>{item.email}</Text>

                <View style={styles.rolesRow}>
                  {ROLES.map((r) => {
                    const activo = rolActual === r.value;
                    return (
                      <TouchableOpacity
                        key={r.value}
                        disabled={cambiando}
                        onPress={() => cambiarRol(item, r.value)}
                        style={[
                          styles.roleChip,
                          { borderColor: r.color },
                          activo && { backgroundColor: r.color },
                        ]}
                      >
                        {cambiando ? (
                          <ActivityIndicator size="small" color={activo ? "#fff" : r.color} />
                        ) : (
                          <Text style={[styles.roleChipText, activo && { color: "#fff" }]}>
                            {r.label}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
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
  name: { fontWeight: "bold", fontSize: 15, color: "#333" },
  email: { color: "#888", fontSize: 12, marginTop: 2, marginBottom: 10 },
  rolesRow: { flexDirection: "row" },
  roleChip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    minWidth: 70,
    alignItems: "center",
  },
  roleChipText: { fontSize: 12, fontWeight: "600", color: "#333" },
});