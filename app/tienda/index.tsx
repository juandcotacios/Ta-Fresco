import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { obtenerMiTienda, guardarMiTienda } from "@/src/services/tiendaService";

export default function MiTiendaScreen() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");

  useEffect(() => {
    const cargar = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      const tienda = await obtenerMiTienda(user.uid);
      if (tienda) {
        setNombre(tienda.nombre || "");
        setDescripcion(tienda.descripcion || "");
      }
      setLoading(false);
    };
    cargar();
  }, []);

  const handleGuardar = async () => {
    if (!user) return;
    if (nombre.trim().length < 3) {
      Alert.alert("Nombre muy corto", "Ponle un nombre a tu tienda (mínimo 3 caracteres).");
      return;
    }
    setSaving(true);
    try {
      await guardarMiTienda(user.uid, nombre.trim(), descripcion.trim());
      Alert.alert("Guardado", "La información de tu tienda quedó actualizada.");
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "No se pudo guardar la tienda.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
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
        <Text style={styles.title}>Mi Tienda</Text>
      </View>

      <Text style={styles.label}>Nombre de tu tienda</Text>
      <TextInput
        style={styles.input}
        value={nombre}
        onChangeText={setNombre}
        placeholder="Ej: Frutas y Verduras El Paisa"
      />

      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: "top" }]}
        value={descripcion}
        onChangeText={setDescripcion}
        placeholder="Cuéntale a los clientes qué vendes"
        multiline
      />

      <TouchableOpacity style={styles.saveBtn} onPress={handleGuardar} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.productsBtn} onPress={() => router.push("/tienda/productos")}>
        <Ionicons name="pricetags-outline" size={20} color="#83c41a" style={{ marginRight: 8 }} />
        <Text style={styles.productsBtnText}>Gestionar mis productos</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "bold", color: "#333" },
  label: { fontSize: 13, color: "#666", marginBottom: 6, marginTop: 14, fontWeight: "600" },
  input: { backgroundColor: "#F5F5F5", borderRadius: 10, padding: 14, fontSize: 15 },
  saveBtn: {
    backgroundColor: "#83c41a",
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  productsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#83c41a",
    borderRadius: 25,
    paddingVertical: 14,
    marginTop: 16,
  },
  productsBtnText: { color: "#83c41a", fontWeight: "bold", fontSize: 15 },
});