import { useAppTheme } from '@/src/contexts/ThemeContext';
import { colors, radius, shadow, spacing } from "@/constants/designSystem";
import { db } from "@/src/config/firebase";
import {
  crearSolicitud,
  obtenerMiSolicitud,
  SolicitudTiendaConId,
} from "@/src/services/solicitudesService";
import { guardarMiTienda, obtenerMiTienda } from "@/src/services/tiendaService";
import { Rol } from "@/src/services/usuariosService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function ConvertirseTenderoScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [rol, setRol] = useState<Rol>("cliente");
  const [solicitud, setSolicitud] = useState<SolicitudTiendaConId | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const esVendedor = rol === "tendero" || rol === "admin";
  const pendiente = !esVendedor && solicitud?.estado === "pendiente";
  const rechazada = !esVendedor && solicitud?.estado === "rechazada";

  // Al entrar se consulta el rol, la última solicitud y si la tienda ya existe.
  // Cuando el admin aprueba, la tienda se crea sola con esos mismos datos, así
  // que si ya existe no tiene sentido mostrar el formulario otra vez: se manda
  // directo a agregar productos. El formulario solo queda como respaldo para
  // un caso raro: alguien con rol de tendero que, por lo que sea, no tiene
  // tienda todavía (por ejemplo, si un admin le dio el rol a mano).
  useEffect(() => {
    const cargar = async () => {
      if (!user) {
        setCargando(false);
        return;
      }
      try {
        const [userSnap, miSolicitud, miTienda] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          obtenerMiSolicitud(user.uid),
          obtenerMiTienda(user.uid),
        ]);
        const rolActual: Rol = userSnap.data()?.role || "cliente";
        setRol(rolActual);
        setSolicitud(miSolicitud);

        if ((rolActual === "tendero" || rolActual === "admin") && miTienda) {
          router.replace("/tienda/productos");
          return; // se deja "cargando": la pantalla de destino toma el control
        }
      } catch (error) {
        console.log(error);
      }
      setCargando(false);
    };
    cargar();
  }, [user]);

  const handleCrear = async () => {
    if (!user) return;
    setErrorMsg(null);

    if (nombre.trim().length < 3) {
      setErrorMsg("Ponle un nombre a tu tienda (mínimo 3 caracteres).");
      return;
    }

    setSaving(true);
    try {
      // Se vuelve a leer el rol por si un admin lo cambió mientras la pantalla estaba abierta.
      const userSnapshot = await getDoc(doc(db, "users", user.uid));
      const userRole: Rol = userSnapshot.data()?.role || "cliente";
      setRol(userRole);

      if (userRole === "tendero" || userRole === "admin") {
        await guardarMiTienda(user.uid, nombre.trim(), descripcion.trim());
        router.replace("/tienda/productos");
        return;
      }

      // La app no se autoasigna privilegios: un administrador debe aprobar
      // la solicitud desde el panel de administración.
      const ultima = await obtenerMiSolicitud(user.uid);
      if (ultima?.estado === "pendiente") {
        setSolicitud(ultima);
        return;
      }
      await crearSolicitud(user.uid, nombre.trim(), descripcion.trim());
      setSolicitud(await obtenerMiSolicitud(user.uid));
    } catch (error: any) {
      console.log(error);
      setErrorMsg(error?.message || "No se pudo completar la operación. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (cargando) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.xl, paddingTop: 55, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Vende en Ta Fresco</Text>
      </View>

      <View style={styles.introBox}>
        <View style={styles.introIconCircle}>
          <Ionicons name="storefront" size={30} color={colors.primary} />
        </View>
        <Text style={styles.introText}>
          Creá tu tienda y empezá a subir tus productos de Corabastos para que los tenderos
          de la app puedan comprarte directamente.
        </Text>
      </View>

      {pendiente && (
        <View style={styles.infoBox}>
          <Ionicons name="time-outline" size={16} color={colors.warning} />
          <Text style={styles.infoText}>
            {`Tu solicitud de "${solicitud?.nombre}" está pendiente. Un administrador la revisará y, cuando la apruebe, podrás crear tu tienda desde aquí.`}
          </Text>
        </View>
      )}

      {rechazada && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            Tu solicitud anterior no fue aprobada. Puedes enviar una nueva.
          </Text>
        </View>
      )}

      {errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      <Text style={styles.label}>Nombre de tu tienda</Text>
      <TextInput
        style={styles.input}
        value={nombre}
        onChangeText={setNombre}
        placeholder="Ej: Frutas y Verduras El Paisa"
        placeholderTextColor={colors.textMuted}
        editable={!pendiente}
      />

      <Text style={styles.label}>Descripción (opcional)</Text>
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: "top" }]}
        value={descripcion}
        onChangeText={setDescripcion}
        placeholder="Cuéntale a los tenderos qué vendes"
        placeholderTextColor={colors.textMuted}
        multiline
        editable={!pendiente}
      />

      <TouchableOpacity
        style={[styles.createBtn, pendiente && styles.createBtnDisabled]}
        onPress={handleCrear}
        disabled={saving || pendiente}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.createBtnText}>
            {esVendedor ? "Crear mi tienda" : pendiente ? "Solicitud en revisión" : "Solicitar tienda"}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footerNote}>
        Por seguridad, la solicitud de tienda debe ser aprobada por un administrador.
      </Text>
    </ScrollView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
    ...shadow.card,
  },
  title: { fontSize: 20, fontWeight: "bold", color: colors.textPrimary },
  introBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  introIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    ...shadow.card,
  },
  introText: {
    color: colors.textPrimary,
    fontSize: 13,
    textAlign: "center",
    marginTop: spacing.md,
    lineHeight: 19,
  },
  errorBox: { backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  errorText: { color: colors.danger, fontSize: 13 },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.warningLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  infoText: { color: colors.warningText, fontSize: 13, lineHeight: 18, marginLeft: spacing.sm, flex: 1 },
  label: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.md, fontWeight: "600" },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  createBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    marginTop: spacing.xxl,
    ...shadow.button,
  },
  createBtnDisabled: { backgroundColor: colors.textMuted, shadowOpacity: 0, elevation: 0 },
  createBtnText: { color: colors.white, fontWeight: "bold", fontSize: 15 },
  footerNote: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
