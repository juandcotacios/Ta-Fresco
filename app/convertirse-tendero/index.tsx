import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import { guardarMiTienda, obtenerMiTienda } from "@/src/services/tiendaService";
import {
  crearSolicitud,
  obtenerMiSolicitud,
  SolicitudTiendaConId,
} from "@/src/services/solicitudesService";
import { Rol } from "@/src/services/usuariosService";

export default function ConvertirseTenderoScreen() {
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
        <ActivityIndicator size="large" color="#83c41a" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 55 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Vende en Ta-Fresco</Text>
      </View>

      <View style={styles.introBox}>
        <Ionicons name="storefront" size={32} color="#83c41a" />
        <Text style={styles.introText}>
          Creá tu tienda y empezá a subir tus productos de Corabastos para que los tenderos
          de la app puedan comprarte directamente.
        </Text>
      </View>

      {pendiente && (
        <View style={styles.infoBox}>
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
        editable={!pendiente}
      />

      <Text style={styles.label}>Descripción (opcional)</Text>
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: "top" }]}
        value={descripcion}
        onChangeText={setDescripcion}
        placeholder="Cuéntale a los tenderos qué vendes"
        multiline
        editable={!pendiente}
      />

      <TouchableOpacity
        style={[styles.createBtn, pendiente && { backgroundColor: "#ccc" }]}
        onPress={handleCrear}
        disabled={saving || pendiente}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 20, fontWeight: "bold", color: "#333" },
  introBox: {
    backgroundColor: "#EAF6D8",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    marginBottom: 24,
  },
  introText: {
    color: "#333",
    fontSize: 13,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 19,
  },
  errorBox: { backgroundColor: "#FFEBEE", padding: 10, borderRadius: 8, marginBottom: 14 },
  errorText: { color: "#D32F2F", fontSize: 13 },
  infoBox: { backgroundColor: "#FFF8E1", padding: 12, borderRadius: 8, marginBottom: 14 },
  infoText: { color: "#8a6d00", fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, color: "#666", marginBottom: 6, marginTop: 10, fontWeight: "600" },
  input: { backgroundColor: "#F5F5F5", borderRadius: 10, padding: 14, fontSize: 15 },
  createBtn: {
    backgroundColor: "#83c41a",
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 26,
  },
  createBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  footerNote: {
    textAlign: "center",
    color: "#999",
    fontSize: 12,
    marginTop: 14,
    marginBottom: 20,
  },
});