import { useAppTheme } from '@/src/contexts/ThemeContext';
import { colors, radius, shadow } from "@/constants/designSystem";
import {
  actualizarRolUsuario,
  obtenerTodosLosUsuarios,
  Rol,
  UsuarioConId,
} from "@/src/services/usuariosService";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Las etiquetas son solo lo que se muestra en pantalla; el valor guardado en
// Firestore (value) sigue siendo "cliente"/"tendero"/"admin" como siempre,
// así ninguna cuenta existente se rompe por este cambio de nombre.
const ROLES: { value: Rol; label: string; color: string }[] = [
  { value: "cliente", label: "Tendero", color: colors.textMuted },
  { value: "tendero", label: "Mayorista", color: colors.info },
  { value: "admin", label: "Administrador", color: colors.danger },
];

export default function AdminUsuariosScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Usuarios</Text>
      </View>

      {errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
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
                          <ActivityIndicator size="small" color={activo ? colors.white : r.color} />
                        ) : (
                          <Text style={[styles.roleChipText, activo && { color: colors.white }]}>
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

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: "center", alignItems: "center",
    marginRight: 10,
    ...shadow.card,
  },
  title: { fontSize: 20, fontWeight: "bold", color: colors.textPrimary },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
  errorBox: {
    backgroundColor: colors.dangerLight,
    marginHorizontal: 16,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorText: { color: colors.danger, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    ...shadow.card,
  },
  name: { fontWeight: "bold", fontSize: 15, color: colors.textPrimary },
  email: { color: colors.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 10 },
  // "Administrador" es más largo que "Admin", así que las fichas ahora
  // pueden pasar a una segunda línea en vez de salirse de la pantalla.
  rolesRow: { flexDirection: "row", flexWrap: "wrap" },
  roleChip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    minWidth: 60,
    alignItems: "center",
  },
  roleChipText: { fontSize: 12, fontWeight: "600", color: colors.textPrimary },
});
