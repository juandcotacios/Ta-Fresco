import React, { useState } from "react";
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
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import { guardarMiTienda } from "@/src/services/tiendaService";

export default function ConvertirseTenderoScreen() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);
  const [rol, setRol] = useState<"cliente" | "tendero" | "admin" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCrear = async () => {
    if (!user) return;
    setErrorMsg(null);

    if (nombre.trim().length < 3) {
      setErrorMsg("Ponle un nombre a tu tienda (mínimo 3 caracteres).");
      return;
    }

    setSaving(true);
    try {
      const userSnapshot = await getDoc(doc(db, "users", user.uid));
      const userRole = userSnapshot.data()?.role || "cliente";
      setRol(userRole);

      if (userRole === "tendero" || userRole === "admin") {
        await guardarMiTienda(user.uid, nombre.trim(), descripcion.trim());
        router.replace("/tienda/productos");
        return;
      }

      // La app no se autoasigna privilegios: un administrador debe aprobar
      // la solicitud y otorgar el rol de tendero desde un entorno autorizado.
      await addDoc(collection(db, "solicitudesTienda"), {
        userId: user.uid,
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        estado: "pendiente",
        createdAt: serverTimestamp(),
      });
      setErrorMsg("Solicitud enviada. Un administrador debe aprobar tu tienda antes de activarla.");
    } catch (error: any) {
      console.log(error);
      setErrorMsg(error?.message || "No se pudo crear tu tienda. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

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
      />

      <Text style={styles.label}>Descripción (opcional)</Text>
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: "top" }]}
        value={descripcion}
        onChangeText={setDescripcion}
        placeholder="Cuéntale a los tenderos qué vendes"
        multiline
      />

      <TouchableOpacity style={styles.createBtn} onPress={handleCrear} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createBtnText}>{rol === "tendero" || rol === "admin" ? "Crear mi tienda" : "Solicitar tienda"}</Text>
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
