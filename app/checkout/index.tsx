import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { useCart } from "@/src/contexts/CartContext";
import { crearPedido } from "@/src/services/pedidosService";

const ENVIO = 3500;

export default function CheckoutScreen() {
  const { cart, clearCart } = useCart();
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);

  const total = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cart]);

  const handleConfirmarPedido = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Inicia sesión", "Debes iniciar sesión para confirmar un pedido.");
      return;
    }
    if (cart.length === 0) {
      Alert.alert("Carrito vacío", "Agrega productos antes de confirmar el pedido.");
      return;
    }

    setEnviando(true);
    try {
      await crearPedido(user.uid, cart, total, ENVIO);
      clearCart();
      Alert.alert("¡Pedido confirmado!", "Tu pedido fue registrado correctamente.", [
        {
          text: "Ver mis pedidos",
          onPress: () => router.replace("/pedidos"),
        },
      ]);
    } catch (error: any) {
      console.log("Error creando pedido:", error);
      Alert.alert("Error", error?.message || "No se pudo confirmar el pedido. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
        <Text style={styles.title}>Resumen del pedido</Text>

        {cart.length === 0 ? (
          <Text style={styles.empty}>Tu carrito está vacío.</Text>
        ) : (
          cart.map((item) => (
            <View key={item.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>${item.price.toLocaleString()}</Text>
              </View>
              <Text style={styles.qty}>x {item.quantity}</Text>
            </View>
          ))
        )}

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>Subtotal</Text>
          <Text style={styles.summaryValue}>${total.toLocaleString()}</Text>
        </View>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>Envío</Text>
          <Text style={styles.summaryValue}>${ENVIO.toLocaleString()}</Text>
        </View>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>${(total + ENVIO).toLocaleString()}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payButton, enviando && { opacity: 0.7 }]}
          onPress={handleConfirmarPedido}
          disabled={enviando}
        >
          {enviando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payButtonText}>Confirmar pedido</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 15, color: "#333" },
  item: {
    flexDirection: "row",
    paddingVertical: 15,
    borderBottomColor: "#f0f0f0",
    borderBottomWidth: 1,
    alignItems: "center",
  },
  itemName: { fontSize: 16, fontWeight: "600", color: "#333" },
  itemPrice: { color: "#83c41a", marginTop: 4, fontWeight: "bold" },
  qty: { fontSize: 16, fontWeight: "bold", color: "#555" },
  summaryBox: { flexDirection: "row", justifyContent: "space-between", marginTop: 15 },
  summaryText: { fontSize: 16, color: "#666" },
  summaryValue: { fontSize: 16, fontWeight: "600", color: "#333" },
  totalBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    paddingVertical: 15,
    borderTopColor: "#eee",
    borderTopWidth: 1,
    marginBottom: 20,
  },
  totalLabel: { fontSize: 20, fontWeight: "bold", color: "#333" },
  totalValue: { fontSize: 22, fontWeight: "bold", color: "#83c41a" },
  footer: { padding: 20, borderTopWidth: 1, borderColor: "#eee", backgroundColor: "#fff" },
  payButton: {
    backgroundColor: "#83c41a",
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
    shadowColor: "#83c41a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    elevation: 5,
  },
  payButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  empty: { fontSize: 16, color: "#999", marginVertical: 20, textAlign: "center" },
});