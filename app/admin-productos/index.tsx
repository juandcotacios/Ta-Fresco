import { useAppTheme } from '@/src/contexts/ThemeContext';
import { colors, radius, shadow } from "@/constants/designSystem";
import {
  actualizarProducto,
  eliminarProducto,
  obtenerTodosLosProductos,
  ProductoTendero,
} from "@/src/services/tiendaService";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function AdminProductosScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const [productos, setProductos] = useState<ProductoTendero[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [borrandoTodos, setBorrandoTodos] = useState(false);
  const listRef = useRef<FlatList<ProductoTendero>>(null);

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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Gestionar Productos y Descuentos</Text>
      </View>

      {huerfanos.length > 0 && (
        <TouchableOpacity style={styles.huerfanosBanner} onPress={borrarTodosLosHuerfanos} disabled={borrandoTodos}>
          {borrandoTodos ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.huerfanosBannerText}>
                Borrar {huerfanos.length} producto{huerfanos.length > 1 ? "s" : ""} sin tienda asignada
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={productos}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.empty}>No hay productos en el catálogo.</Text>}
          renderItem={({ item, index }) => {
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
                        returnKeyType="done"
                        onFocus={() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.25 })}
                      />
                      <Text style={{ marginLeft: 4, marginRight: 10, color: colors.textPrimary }}>%</Text>
                      <TouchableOpacity
                        style={styles.saveSmallBtn}
                        onPress={() => guardarDescuento(item)}
                        disabled={saving}
                      >
                        {saving ? (
                          <ActivityIndicator color={colors.white} size="small" />
                        ) : (
                          <Text style={styles.saveSmallBtnText}>Guardar</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingId(null)} style={{ marginLeft: 8 }}>
                        <Ionicons name="close" size={20} color={colors.textMuted} />
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
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </KeyboardAvoidingView>
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
  title: { fontSize: 18, fontWeight: "bold", color: colors.textPrimary, flex: 1 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
  huerfanosBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.dangerLight,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
  },
  huerfanosBannerText: { color: colors.danger, fontSize: 12, fontWeight: "700", marginLeft: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 12,
    ...shadow.card,
  },
  cardHuerfano: { backgroundColor: "#FFF8F8" },
  thumb: { width: 50, height: 50, borderRadius: 8, backgroundColor: colors.background },
  name: { fontWeight: "bold", fontSize: 14, color: colors.textPrimary },
  meta: { color: colors.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 6 },
  huerfanoTag: { color: colors.danger, fontSize: 11, fontWeight: "600", marginBottom: 6 },
  discountBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  discountBadgeText: { color: colors.warningText, fontSize: 12, fontWeight: "600" },
  editRow: { flexDirection: "row", alignItems: "center" },
  discountInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 60,
    fontSize: 14,
    color: colors.textPrimary,
  },
  saveSmallBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveSmallBtnText: { color: colors.white, fontWeight: "bold", fontSize: 12 },
});
