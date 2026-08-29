import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/src/config/firebase";
import { useCart } from "@/src/contexts/CartContext";
import { TiendaConId, ProductoTendero } from "@/src/services/tiendaService";

export default function TiendaDetalleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cart, addToCart, decreaseCart, removeFromCart } = useCart();

  const [tienda, setTienda] = useState<TiendaConId | null>(null);
  const [productos, setProductos] = useState<ProductoTendero[]>([]);
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
        setProductos(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        setLoading(false);
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
        <ActivityIndicator size="large" color="#83c41a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#333" />
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

          return (
            <View style={styles.card}>
              {hasDiscount && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>-{item.discountPercent}%</Text>
                </View>
              )}
              <Image
                source={{ uri: item.imageUrl || "https://via.placeholder.com/150" }}
                style={styles.image}
              />
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.price}>${finalPrice.toLocaleString()}</Text>

              {qty === 0 ? (
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => addToCart({ ...item, quantity: 1 })}
                >
                  <Ionicons name="cart-outline" size={16} color="#fff" />
                  <Text style={styles.addBtnText}>Agregar</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => (qty > 1 ? decreaseCart(item.id) : removeFromCart(item.id))}
                  >
                    <Ionicons name={qty === 1 ? "trash-outline" : "remove"} size={14} color="#D32F2F" />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{qty}</Text>
                  <TouchableOpacity
                    style={[styles.qtyBtn, { backgroundColor: "#83c41a" }]}
                    onPress={() => addToCart({ ...item, quantity: 1 })}
                  >
                    <Ionicons name="add" size={14} color="#fff" />
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
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: { fontSize: 20, fontWeight: "bold", color: "#333" },
  subtitle: { color: "#888", fontSize: 13, marginTop: 4 },
  empty: { textAlign: "center", color: "#999", marginTop: 40, width: "100%" },
  card: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
    position: "relative",
  },
  discountBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#D32F2F",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  discountBadgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  image: { width: "100%", height: 90, resizeMode: "contain", marginBottom: 6 },
  name: { fontSize: 13, fontWeight: "600", color: "#333", height: 34 },
  price: { fontSize: 15, fontWeight: "bold", color: "#83c41a", marginVertical: 4 },
  addBtn: {
    flexDirection: "row",
    backgroundColor: "#83c41a",
    borderRadius: 20,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12, marginLeft: 4 },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#eee",
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  qtyBtn: {
    backgroundColor: "#FFEBEE",
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: { fontWeight: "bold", color: "#333" },
});