import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import {
  obtenerTodosLosProductos,
  actualizarProducto,
  eliminarProducto,
  ProductoTendero,
} from "@/src/services/tiendaService";

export default function AdminProductosScreen() {
  const router = useRouter();
  const [productos, setProductos] = useState<ProductoTendero[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [borrandoTodos, setBorrandoTodos] = useState(false);

  const cargar = async () => {
    setLoading(true);
    const data = await obtenerTodosLosProductos();
    setProductos(data);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [])
  );

  const huerfanos = productos.filter((p) => !p.proveedorId);

  const abrirEdicion = (p: ProductoTendero) => {
    setEditingId(p.id);
    setDiscountInput(p.discountPercent ? String(p.discountPercent) : "");
  };

  const guardarDescuento = async (p: ProductoTendero) => {
    const num = discountInput.trim() === "" ? 0 : parseInt(discountInput, 10);
    if (isNaN(num) || num < 0 || num > 90) {
      Alert.alert("Descuento inválido", "Escribe un número entre 0 y 90 (o déjalo vacío para quitarlo).");
      return;
    }
    setSaving(true);
    try {
      await actualizarProducto(p.id, { discountPercent: num });
      setEditingId(null);
      cargar();
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "No se pudo actualizar el descuento.");
    } finally {
      setSaving(false);
    }
  };

  const borrarUno = async (p: ProductoTendero) => {
    try {
      await eliminarProducto(p.id);
      cargar();
    } catch (error) {
      console.log(error);
    }
  };

  const borrarTodosLosHuerfanos = async () => {
    if (huerfanos.length === 0) return;
    setBorrandoTodos(true);
    try {
      for (const p of huerfanos) {
        await eliminarProducto(p.id);
      }
      cargar();
    } catch (error) {
      console.log(error);
    } finally {
      setBorrandoTodos(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Gestionar Productos y Descuentos</Text>
      </View>

      {huerfanos.length > 0 && (
        <TouchableOpacity style={styles.huerfanosBanner} onPress={borrarTodosLosHuerfanos} disabled={borrandoTodos}>
          {borrandoTodos ? (
            <ActivityIndicator color="#D32F2F" size="small" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color="#D32F2F" />
              <Text style={styles.huerfanosBannerText}>
                Borrar {huerfanos.length} producto{huerfanos.length > 1 ? "s" : ""} sin tienda asignada
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#83c41a" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={productos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.empty}>No hay productos en el catálogo.</Text>}
          renderItem={({ item }) => {
            const esHuerfano = !item.proveedorId;
            return (
              <View style={[styles.card, esHuerfano && styles.cardHuerfano]}>
                <Image
                  source={{ uri: item.imageUrl || "https://via.placeholder.com/60" }}
                  style={styles.thumb}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.category} · ${item.price.toLocaleString()}</Text>
                  {esHuerfano && <Text style={styles.huerfanoTag}>⚠️ Sin tienda asignada</Text>}

                  {editingId === item.id ? (
                    <View style={styles.editRow}>
                      <TextInput
                        style={styles.discountInput}
                        value={discountInput}
                        onChangeText={setDiscountInput}
                        keyboardType="numeric"
                        placeholder="0-90"
                        autoFocus
                      />
                      <Text style={{ marginLeft: 4, marginRight: 10 }}>%</Text>
                      <TouchableOpacity
                        style={styles.saveSmallBtn}
                        onPress={() => guardarDescuento(item)}
                        disabled={saving}
                      >
                        {saving ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.saveSmallBtnText}>Guardar</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingId(null)} style={{ marginLeft: 8 }}>
                        <Ionicons name="close" size={20} color="#999" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => abrirEdicion(item)} style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>
                        {item.discountPercent ? `Descuento: -${item.discountPercent}%` : "Sin descuento — tocar para poner"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={() => borrarUno(item)} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={20} color="#D32F2F" />
                </TouchableOpacity>
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
  title: { fontSize: 18, fontWeight: "bold", color: "#333", flex: 1 },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
  huerfanosBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFEBEE",
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
  },
  huerfanosBannerText: { color: "#D32F2F", fontSize: 12, fontWeight: "700", marginLeft: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cardHuerfano: { borderColor: "#FFCDD2", backgroundColor: "#FFF8F8" },
  thumb: { width: 50, height: 50, borderRadius: 8, backgroundColor: "#eee" },
  name: { fontWeight: "bold", fontSize: 14, color: "#333" },
  meta: { color: "#888", fontSize: 12, marginTop: 2, marginBottom: 6 },
  huerfanoTag: { color: "#D32F2F", fontSize: 11, fontWeight: "600", marginBottom: 6 },
  discountBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  discountBadgeText: { color: "#EF6C00", fontSize: 12, fontWeight: "600" },
  editRow: { flexDirection: "row", alignItems: "center" },
  discountInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 60,
    fontSize: 14,
  },
  saveSmallBtn: {
    backgroundColor: "#83c41a",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveSmallBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
});