import React, { useMemo } from "react"; // Importamos useMemo
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native";
import { useCart } from "@/src/contexts/CartContext";

export default function CheckoutScreen() {
  // 1. Usamos el nombre correcto: 'cart'
  const { cart } = useCart();

  // 2. Calculamos el total aquí mismo (igual que en el Carrito)
  const total = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [cart]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={{paddingBottom: 100}}>
        <Text style={styles.title}>Resumen del pedido</Text>

        {cart.length === 0 ? (
          <Text style={styles.empty}>Tu carrito está vacío.</Text>
        ) : (
          // 3. Iteramos sobre 'cart'
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
          <Text style={styles.summaryValue}>$3,500</Text>
        </View>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total</Text>
          {/* Sumamos el envío al total visual */}
          <Text style={styles.totalValue}>${(total + 3500).toLocaleString()}</Text>
        </View>
      </ScrollView>

      {/* BOTÓN FINAL */}
      <View style={styles.footer}>
        <TouchableOpacity
            style={styles.payButton}
            onPress={() => Alert.alert("Próximamente", "La pasarela de pagos estará lista pronto.")}
        >
            <Text style={styles.payButtonText}>Confirmar pedido</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scroll: {
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
    color: '#333'
  },
  item: {
    flexDirection: "row",
    paddingVertical: 15,
    borderBottomColor: "#f0f0f0",
    borderBottomWidth: 1,
    alignItems: 'center'
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: '#333'
  },
  itemPrice: {
    color: "#83c41a",
    marginTop: 4,
    fontWeight: "bold",
  },
  qty: {
    fontSize: 16,
    fontWeight: "bold",
    color: '#555'
  },
  summaryBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  summaryText: {
    fontSize: 16,
    color: "#666",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: '#333'
  },
  totalBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    paddingVertical: 15,
    borderTopColor: "#eee",
    borderTopWidth: 1,
    marginBottom: 20
  },
  totalLabel: {
    fontSize: 20,
    fontWeight: "bold",
    color: '#333'
  },
  totalValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#83c41a",
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff'
  },
  payButton: {
    backgroundColor: "#83c41a",
    paddingVertical: 16,
    borderRadius: 25, // Bordes redondeados estilo app
    alignItems: "center",
    shadowColor: "#83c41a",
    shadowOffset: {width:0, height: 4},
    shadowOpacity: 0.3,
    elevation: 5
  },
  payButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  empty: {
    fontSize: 16,
    color: "#999",
    marginVertical: 20,
    textAlign: 'center'
  },
});
