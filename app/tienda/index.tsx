import { colors, radius, shadow } from "@/constants/designSystem";
import { guardarMiTienda, obtenerMiTienda } from "@/src/services/tiendaService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 55 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Mi Tienda</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Nombre de tu tienda</Text>
        <TextInput
          style={styles.input}
          value={nombre}
          onChangeText={setNombre}
          placeholder="Ej: Frutas y Verduras El Paisa"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: "top" }]}
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="Cuéntale a los clientes qué vendes"
          placeholderTextColor={colors.textMuted}
          multiline
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleGuardar} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Guardar</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.productsBtn} onPress={() => router.push("/tienda/productos")}>
        <Ionicons name="pricetags-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
        <Text style={styles.productsBtnText}>Gestionar mis productos</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.productsBtn} onPress={() => router.push("/tienda/pedidos")}>
        <Ionicons name="receipt-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
        <Text style={styles.productsBtnText}>Pedidos de mi tienda</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: "center", alignItems: "center",
    marginRight: 12,
    ...shadow.card,
  },
  title: { fontSize: 22, fontWeight: "bold", color: colors.textPrimary },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 18, ...shadow.card },
  label: { fontSize: 13, color: colors.textSecondary, marginBottom: 6, marginTop: 14, fontWeight: "600" },
  input: { backgroundColor: colors.background, borderRadius: 10, padding: 14, fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: radius.pill,
    alignItems: "center",
    marginTop: 24,
    ...shadow.button,
  },
  saveBtnText: { color: colors.white, fontWeight: "bold", fontSize: 16 },
  productsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    marginTop: 16,
  },
  productsBtnText: { color: colors.primary, fontWeight: "bold", fontSize: 15 },
});
