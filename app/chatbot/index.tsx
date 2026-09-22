// chatbot/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/src/config/firebase";

interface ProductoChat {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  proveedorId: string;
}

// Las mismas 5 categorías que usan home.tsx y ofertas.tsx.
const CATEGORIAS = ["Verduras", "Frutas", "Tubérculos", "Hortalizas", "Abarrotes"];

const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

interface Intencion {
  /** Si el mensaje contiene cualquiera de estas palabras (ya normalizadas), dispara la respuesta. */
  palabras: string[];
  respuesta: string;
}

/**
 * Respuestas fijas para lo más frecuente de la app. Cada una está redactada
 * a partir del comportamiento real del código (mínimo de compra, costo de
 * envío, quién puede cancelar, etc.), no de suposiciones.
 */
const INTENCIONES: Intencion[] = [
  {
    palabras: ["hola", "buenas", "ola", "hey", "que mas", "buenos dias", "buenas tardes"],
    respuesta:
      "¡Hola! 👋 Soy el asistente de Ta-Fresco. Puedo buscarte productos, o contarte cómo comprar, vender, pagar, hacer seguimiento a tu pedido o calificar productos. ¿Qué necesitas?",
  },
  {
    palabras: [
      "como compro",
      "como comprar",
      "hacer un pedido",
      "como pido",
      "como hago un pedido",
      "quiero comprar",
    ],
    respuesta:
      "Para comprar: agrega productos al carrito desde el inicio o desde una tienda, revisa que llegues al pedido mínimo de $100.000, elige tu dirección y método de pago, y confirma. Podrás seguir el estado desde \"Mis pedidos\".",
  },
  {
    palabras: ["minimo", "pedido minimo", "monto minimo", "cuanto es el minimo"],
    respuesta: "El pedido mínimo es de $100.000. El carrito te muestra cuánto te falta si aún no lo alcanzas.",
  },
  {
    palabras: ["envio", "domicilio", "costo de envio", "cuanto cuesta el envio", "cuanto vale el envio"],
    respuesta: "El envío tiene un costo fijo de $3.500, que se suma al total de tu pedido.",
  },
  {
    palabras: [
      "metodo de pago",
      "metodos de pago",
      "como pago",
      "formas de pago",
      "puedo pagar con",
      "aceptan nequi",
      "aceptan tarjeta",
    ],
    respuesta:
      "Puedes pagar contraentrega (efectivo), con Nequi o con tarjeta. Eliges la opción al confirmar tu pedido en el carrito.",
  },
  {
    palabras: ["cancelar", "como cancelo", "anular pedido"],
    respuesta:
      "Por ahora la cancelación la hace la tienda o un administrador, no el comprador directamente. Si necesitas cancelar algo, contacta a la tienda; si llegan a cancelarlo, verás el motivo en \"Mis pedidos\".",
  },
  {
    palabras: ["mi pedido", "seguimiento", "estado de mi pedido", "rastrear", "donde esta mi pedido", "mis pedidos"],
    respuesta:
      "Ve a \"Mis pedidos\" (desde tu perfil) para ver el estado de cada uno: pendiente, confirmado, en camino o entregado. Si tu pedido tiene productos de varias tiendas, cada tienda avanza por separado.",
  },
  {
    palabras: [
      "vender",
      "ser tendero",
      "tener tienda",
      "como vendo",
      "abrir tienda",
      "convertirme en tendero",
      "quiero vender",
    ],
    respuesta:
      "Para vender, entra a tu perfil y toca \"Vende en Ta-Fresco\". Envías el nombre y la descripción de tu tienda, un administrador la revisa, y al aprobarla ya puedes agregar tus productos: no tienes que volver a escribir nada.",
  },
  {
    palabras: ["calificar", "resena", "reseña", "opinar", "dejar estrellas", "puntuar"],
    respuesta:
      "Puedes calificar los productos de un pedido una vez que la tienda lo marque como \"entregado\". Entra a \"Mis pedidos\" y ahí aparece el botón para calificar. Ojo: una calificación no se puede editar después de enviarla.",
  },
  {
    palabras: ["oferta", "descuento", "promocion", "promociones", "rebaja"],
    respuesta: "Revisa la pestaña \"Ofertas\": ahí están todos los productos con descuento activo, filtrables por categoría.",
  },
  {
    palabras: ["gracias", "listo", "de una", "ok"],
    respuesta: "¡Con gusto! Si necesitas algo más, aquí estoy.",
  },
];

function buscarIntencion(mensaje: string): string | null {
  const texto = normalizar(mensaje);
  for (const intencion of INTENCIONES) {
    if (intencion.palabras.some((p) => texto.includes(normalizar(p)))) {
      return intencion.respuesta;
    }
  }
  return null;
}

/** Busca en el catálogo real: por categoría si el mensaje la menciona, si no por nombre. */
function buscarProductos(
  mensaje: string,
  productos: ProductoChat[],
  storeNames: Record<string, string>
): string {
  const texto = normalizar(mensaje);

  const categoria = CATEGORIAS.find((c) => texto.includes(normalizar(c)));
  const candidatos = categoria
    ? productos.filter((p) => normalizar(p.category) === normalizar(categoria))
    : productos.filter((p) => normalizar(p.name).includes(texto));

  if (candidatos.length === 0) {
    return "No encontré productos con ese nombre. Prueba con otra palabra, o pregúntame cómo comprar, vender, pagar o hacer seguimiento a tu pedido.";
  }

  const primeros = candidatos.slice(0, 5);
  const lineas = primeros.map((p) => {
    const tienda = p.proveedorId ? storeNames[p.proveedorId] : undefined;
    const precio = p.stock > 0 ? `$${p.price.toLocaleString()}` : "Agotado";
    return `• ${p.name} — ${precio}${tienda ? ` (${tienda})` : ""}`;
  });
  const extra = candidatos.length > primeros.length ? `\n...y ${candidatos.length - primeros.length} más.` : "";

  return `Encontré esto:\n${lineas.join("\n")}${extra}`;
}

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<{ from: "user" | "bot"; text: string }[]>([
    {
      from: "bot",
      text: "¡Hola! 👋 Soy tu asistente Ta-Fresco. Pregúntame por un producto, o por cómo comprar, vender, pagar, hacer seguimiento a tu pedido o calificar productos.",
    },
  ]);
  const [input, setInput] = useState("");
  const [productos, setProductos] = useState<ProductoChat[]>([]);
  const [storeNames, setStoreNames] = useState<Record<string, string>>({});
  const flatListRef = useRef<FlatList>(null as any);
  const router = useRouter();

  // Catálogo real en tiempo real, igual que en home.tsx y ofertas.tsx.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "Productos"),
      (snapshot) => {
        setProductos(
          snapshot.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              name: data.name || "Producto",
              price: data.price || 0,
              category: data.category || "Varios",
              stock: data.stock ?? 0,
              proveedorId: data.proveedorId || "",
            };
          })
        );
      },
      (error) => console.log(error)
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "tiendas"),
      (snapshot) => {
        const names: Record<string, string> = {};
        snapshot.docs.forEach((store) => {
          names[store.id] = String(store.data().nombre || "Tienda de Corabastos");
        });
        setStoreNames(names);
      },
      (error) => console.log(error)
    );
    return () => unsubscribe();
  }, []);

  const sendMessage = () => {
    if (!input.trim()) return;

    const texto = input;
    setMessages((prev) => [...prev, { from: "user", text: texto }]);
    setInput("");

    const respuestaIntencion = buscarIntencion(texto);
    const respuesta = respuestaIntencion ?? buscarProductos(texto, productos, storeNames);

    setTimeout(() => {
      setMessages((prev) => [...prev, { from: "bot", text: respuesta }]);
    }, 500);
  };

  useEffect(() => {
    // Scroll to bottom cuando hay nuevos mensajes
    setTimeout(() => {
      flatListRef.current?.scrollToEnd?.({ animated: true });
    }, 80);
  }, [messages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: "padding", android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 80, android: 60 })}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chatbot</Text>
      </View>

      {/* MENSAJES */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 12 }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.message,
              item.from === "user" ? styles.userMessage : styles.botMessage,
            ]}
          >
            <Text style={[styles.messageText, item.from === "user" && styles.userMessageText]}>
              {item.text}
            </Text>
          </View>
        )}
        style={{ flex: 1 }}
      />

      {/* INPUT */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje..."
          value={input}
          onChangeText={setInput}
          placeholderTextColor="#999"
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F7" },

  header: {
    backgroundColor: "#83c41a",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 55,
    paddingVertical: 14,
    elevation: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginLeft: 12,
  },

  message: {
    marginVertical: 6,
    marginHorizontal: 4,
    padding: 12,
    borderRadius: 12,
    maxWidth: "80%",
  },
  userMessage: {
    backgroundColor: "#83c41a",
    alignSelf: "flex-end",
  },
  botMessage: {
    backgroundColor: "#e9e9e9",
    alignSelf: "flex-start",
  },
  messageText: { color: "#000", fontSize: 15, lineHeight: 20 },
  userMessageText: { color: "#fff" },

  inputContainer: {
    flexDirection: "row",
    padding: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 42,
    borderColor: "#e6e6e6",
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    color: "#222",
  },
  sendButton: {
    backgroundColor: "#83c41a",
    marginLeft: 10,
    padding: 10,
    borderRadius: 20,
  },
});