import { colors, radius, shadow } from "@/constants/designSystem";
import { db } from "@/src/config/firebase";
import { useCart } from "@/src/contexts/CartContext";
import { ProductoTendero, TiendaConId } from "@/src/services/tiendaService";
import { obtenerPromedioProducto } from "@/src/services/valoracionesService";
import { getOriginalPrice } from "@/src/utils/pricing";
import { alTopeDeStock, estaAgotado } from "@/src/utils/stock";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function TiendaDetalleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cart, addToCart, decreaseCart } = useCart();

  const [tienda, setTienda] = useState<TiendaConId | null>(null);
  const [productos, setProductos] = useState<ProductoTendero[]>([]);
  const [ratings, setRatings] = useState<Record<string, { promedio: number; cantidad: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    getDoc(doc(db, "tiendas", id)).then((snap) => {
      if (snap.exists()) {
        setTienda({ id: snap.id, ...(snap.data() as any) });
      }
    });

    const q = query(collection(db, "Productos"), where("proveedorId", "==", id));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setProductos(data);
        setLoading(false);
        data.forEach((p: any) => {
          obtenerPromedioProducto(p.id).then((r) => {
            setRatings((prev) => ({ ...prev, [p.id]: r }));
          });
        });
      },
      (error) => {
        console.log(error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{tienda?.nombre || "Tienda"}</Text>
          {!!tienda?.descripcion && <Text style={styles.subtitle}>{tienda.descripcion}</Text>}
        </View>
      </View>

      <FlatList
        data={productos}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ padding: 12 }}
        columnWrapperStyle={{ gap: 12 }}
        ListEmptyComponent={
          <Text style={styles.empty}>Esta tienda todavía no tiene productos.</Text>
        }
        renderItem={({ item }) => {
          const cartItem = cart.find((c) => c.id === item.id);
          const qty = cartItem ? cartItem.quantity : 0;
          const hasDiscount = !!item.discountPercent && item.discountPercent > 0;
          const finalPrice = item.price;
          const originalPrice = getOriginalPrice(item.price, item.discountPercent);
          const sinStock = estaAgotado(item.stock);
          const alTope = alTopeDeStock(qty, item.stock);

          return (
            <View style={styles.card}>
              {hasDiscount && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>-{item.discountPercent}%</Text>
                </View>
              )}
              <View>
                <Image
                  source={{ uri: item.imageUrl || "https://via.placeholder.com/150" }}
                  style={styles.image}
                />
                {sinStock && (
                  <View style={styles.agotadoBadge}>
                    <Text style={styles.agotadoBadgeText}>AGOTADO</Text>
                  </View>
                )}
              </View>
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              {!sinStock && item.stock <= 10 && (
                <Text style={styles.stockText}>Quedan {item.stock}</Text>
              )}

              {ratings[item.id] && ratings[item.id].cantidad > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                  <Ionicons name="star" size={11} color="#f0a500" />
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginLeft: 3 }}>
                    {ratings[item.id].promedio.toFixed(1)} ({ratings[item.id].cantidad})
                  </Text>
                </View>
              )}
              <View style={styles.priceRow}>
                <Text style={styles.price}>${finalPrice.toLocaleString()}</Text>
                {!!originalPrice && <Text style={styles.oldPrice}>${originalPrice.toLocaleString()}</Text>}
              </View>

              {sinStock ? (
                <View style={[styles.addBtn, { backgroundColor: "#ccc" }]}>
                  <Text style={[styles.addBtnText, { color: "#666" }]}>Agotado</Text>
                </View>
              ) : qty === 0 ? (
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => addToCart({ ...item, quantity: 1 })}
                >
                  <Ionicons name="cart-outline" size={16} color={colors.white} />
                  <Text style={styles.addBtnText}>Agregar</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => decreaseCart(item.id)}
                  >
                    <Ionicons name={qty === 1 ? "trash-outline" : "remove"} size={14} color={colors.danger} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{qty}</Text>
                  <TouchableOpacity
                    style={[styles.qtyBtn, { backgroundColor: alTope ? "#ccc" : colors.primary }]}
                    onPress={alTope ? undefined : () => addToCart({ ...item, quantity: 1 })}
                    disabled={alTope}
                  >
                    <Ionicons name="add" size={14} color={colors.white} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: "center", alignItems: "center",
    marginRight: 10,
  },
  title: { fontSize: 20, fontWeight: "bold", color: colors.textPrimary },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40, width: "100%" },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 10,
    marginBottom: 12,
    position: "relative",
    ...shadow.card,
  },
  discountBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  discountBadgeText: { color: colors.white, fontSize: 10, fontWeight: "bold" },
  agotadoBadge: { position: "absolute", top: 4, left: 4, backgroundColor: colors.danger, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, zIndex: 2 },
  agotadoBadgeText: { color: colors.white, fontSize: 9, fontWeight: "bold" },
  stockText: { fontSize: 10, color: colors.warning, marginBottom: 2 },
  image: { width: "100%", height: 90, resizeMode: "contain", marginBottom: 6 },
  name: { fontSize: 13, fontWeight: "600", color: colors.textPrimary, height: 34 },
  priceRow: { flexDirection: "row", alignItems: "center", marginVertical: 4 },
  price: { fontSize: 15, fontWeight: "bold", color: colors.primary },
  oldPrice: { marginLeft: 6, color: colors.textMuted, fontSize: 12, textDecorationLine: "line-through" },
  addBtn: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: { color: colors.white, fontWeight: "bold", fontSize: 12, marginLeft: 4 },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  qtyBtn: {
    backgroundColor: colors.dangerLight,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: { fontWeight: "bold", color: colors.textPrimary },
});
