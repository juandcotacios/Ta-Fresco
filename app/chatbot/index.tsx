import { useAppTheme } from '@/src/contexts/ThemeContext';
// chatbot/index.tsx
import { radius, shadow, spacing } from "@/constants/designSystem";
import { db } from "@/src/config/firebase";
import { findMatchingCategory, matchesSearchToken, normalizeSearchText, productMatchesCategory } from "@/src/utils/productSearch";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface ProductoChat {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  proveedorId: string;
  discountPercent: number;
}

// Las mismas categorías que usan home.tsx y ofertas.tsx.
const normalizar = normalizeSearchText;

interface Intencion {
  /** Si el mensaje contiene cualquiera de estas palabras (ya normalizadas), dispara la respuesta. */
  palabras: string[];
  respuesta: string;
  acceso?: { label: string; route: string };
}

interface RespuestaBot {
  text: string;
  access?: Intencion["acceso"];
  /** Uso interno para dar prioridad a coincidencias reales del catálogo. */
  catalogMatch?: boolean;
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
      "¡Hola! 👋 Soy el asistente de Ta Fresco. Puedo buscarte productos, o contarte cómo comprar, vender, pagar, hacer seguimiento a tu pedido o calificar productos. ¿Qué necesitas?",
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
    acceso: { label: "Ir al carrito", route: "/cart" },
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
      "El checkout muestra contraentrega, Nequi y tarjeta como opciones de demostración. Ninguna genera un cobro; Nequi tampoco envía una notificación. Usa solo datos ficticios.",
  },
  {
    palabras: ["crear cuenta", "crear una cuenta", "registrarme", "registrar usuario", "cuenta nueva"],
    respuesta: "Puedes crear tu cuenta con tu correo y una contraseña desde Registro. La app te pedirá aceptar los términos y la política de datos antes de continuar.",
    acceso: { label: "Crear una cuenta", route: "/register" },
  },
  {
    palabras: ["iniciar sesion", "entrar a mi cuenta", "ya tengo cuenta", "ir al login"],
    respuesta: "Inicia sesión con tu correo y contraseña o usa la opción de Google disponible en la pantalla de acceso.",
    acceso: { label: "Iniciar sesión", route: "/login" },
  },
  {
    palabras: ["cancelar", "como cancelo", "anular pedido"],
    respuesta:
      "Por ahora la cancelación la hace la tienda o un administrador, no el tendero directamente. Si necesitas cancelar algo, contacta a la tienda; si llegan a cancelarlo, verás el motivo en \"Mis pedidos\".",
  },
  {
    palabras: ["mi pedido", "seguimiento", "estado de mi pedido", "rastrear", "donde esta mi pedido", "mis pedidos"],
    respuesta:
      "Ve a \"Mis pedidos\" (desde tu perfil) para ver el estado de cada uno: pendiente, confirmado, en camino o entregado. Si tu pedido tiene productos de varias tiendas, cada tienda avanza por separado.",
    acceso: { label: "Ver mis pedidos", route: "/pedidos" },
  },
  {
    palabras: [
      "ser tendero",
      "ser mayorista",
      "tener tienda",
      "como vendo",
      "como vender",
      "vender en ta fresco",
      "abrir tienda",
      "convertirme en tendero",
      "convertirme en mayorista",
      "quiero vender",
    ],
    respuesta:
      "Para vender, entra a tu perfil y toca \"Vende en Ta Fresco\". Envías el nombre y la descripción de tu tienda, un administrador la revisa, y al aprobarla ya puedes agregar tus productos: no tienes que volver a escribir nada.",
    acceso: { label: "Solicitar una tienda", route: "/convertirse-tendero" },
  },
  {
    palabras: ["calificar", "resena", "reseña", "opinar", "dejar estrellas", "puntuar"],
    respuesta:
      "Puedes calificar los productos de un pedido una vez que la tienda lo marque como \"entregado\". Entra a \"Mis pedidos\" y ahí aparece el botón para calificar. Ojo: una calificación no se puede editar después de enviarla.",
  },
  {
    palabras: ["oferta", "descuento", "promocion", "promociones", "rebaja"],
    respuesta: "Revisa la pestaña \"Ofertas\": ahí están todos los productos con descuento activo, filtrables por categoría.",
    acceso: { label: "Ver ofertas", route: "/ofertas" },
  },
  {
    palabras: ["direccion", "direcciones", "domicilio guardado", "cambiar direccion"],
    respuesta: "Puedes crear o actualizar tus direcciones desde Perfil → Mis direcciones. Al confirmar una compra también podrás elegir dónde recibirla.",
    acceso: { label: "Ir a mi perfil", route: "/profile" },
  },
  {
    palabras: ["carrito", "mi compra", "ver carrito"],
    respuesta: "En el carrito puedes revisar cantidades, subtotal, costo de envío y completar la compra cuando alcances el mínimo.",
    acceso: { label: "Abrir carrito", route: "/cart" },
  },
  {
    palabras: ["perfil", "mis datos", "editar cuenta", "cambiar foto", "cambiar telefono"],
    respuesta: "Desde tu perfil puedes actualizar tu nombre, teléfono, foto y direcciones, además de revisar tus pedidos.",
    acceso: { label: "Abrir mi perfil", route: "/profile" },
  },
  {
    palabras: ["tienda", "tiendas", "buscar tienda", "ver tiendas"],
    respuesta: "Explora las tiendas disponibles para consultar sus productos y comprar directamente desde su catálogo.",
    acceso: { label: "Explorar tiendas", route: "/tiendas" },
  },
  {
    palabras: ["gracias", "listo", "de una", "ok"],
    respuesta: "¡Con gusto! Si necesitas algo más, aquí estoy.",
  },
];

function buscarIntencion(mensaje: string): Intencion | null {
  const tokens = normalizar(mensaje).split(/[^a-z0-9]+/).filter(Boolean);
  for (const intencion of INTENCIONES) {
    if (intencion.palabras.some((palabra) => {
      const clave = normalizar(palabra).split(/[^a-z0-9]+/).filter(Boolean);
      // Las intenciones son acciones concretas; aquí no usamos tolerancia difusa,
      // porque palabras parecidas en consultas de productos causan respuestas erróneas.
      return clave.length > 0 && clave.every((parte) => tokens.includes(parte));
    })) {
      return intencion;
    }
  }
  return null;
}

const PALABRAS_AUXILIARES = new Set([
  "a", "al", "algo", "algun", "alguna", "algunos", "algunas", "alguien", "al", "algun",
  "buscar", "busco", "buscame", "buscando", "explorar", "explora", "quiero", "quisiera", "necesito", "necesita", "estoy", "dime", "saber", "si", "hay", "tienen", "tiene", "tienes",
  "vende", "vender", "venden", "vendes", "esta", "estan", "queda", "quedan", "comprar", "compro", "adquirir", "tal",
  "tienda", "tiendas", "tendero", "tenderos",
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "en", "por", "para", "con",
  "que", "cual", "cuales", "como", "donde", "cuanto", "cuanta", "cuantos", "cuantas", "es", "son",
  "me", "puedes", "podrias", "favor", "precio", "precios", "cuesta", "cuestan", "vale", "valen",
  "producto", "productos", "disponible", "disponibles", "stock", "agotado", "agotada", "tienen",
  "oferta", "ofertas", "descuento", "descuentos", "promocion", "promociones", "quiero", "ver",
]);

const tokensDeBusqueda = (texto: string) => normalizar(texto).split(/[^a-z0-9]+/)
  .filter((token) => token.length > 1 && !PALABRAS_AUXILIARES.has(token));

/** Recupera respuestas del catálogo vivo y permite afinar la consulta en lenguaje natural. */
function buscarProductos(
  mensaje: string,
  productos: ProductoChat[],
  storeNames: Record<string, string>
): RespuestaBot {
  const texto = normalizar(mensaje);

  const categoria = findMatchingCategory(texto);
  const tokens = tokensDeBusqueda(texto);
  const tokensProducto = tokens.filter((token) => {
    const esCategoria = categoria && findMatchingCategory(token) === categoria;
    const esNombreDeTienda = Object.values(storeNames).some((nombre) => matchesSearchToken(token, nombre));
    return !esCategoria && !esNombreDeTienda;
  });
  if (tokensProducto.length === 0 && !categoria) {
    return {
      text: "Cuéntame un poco más: puedes escribir el nombre de un producto o categoría, preguntar si hay existencias, consultar un precio o pedirme ayuda con una parte de la app.",
      catalogMatch: false,
    };
  }
  const candidatos = productos.filter((p) => {
    const coincideCategoria = categoria ? productMatchesCategory(p.category, categoria) : true;
    const textoProducto = `${p.name} ${p.category}`;
    return coincideCategoria && tokensProducto.every((token) => matchesSearchToken(token, textoProducto));
  });

  if (candidatos.length === 0) {
    const consulta = tokens.join(" ") || mensaje.trim();
    const sinProductosEnCategoria = categoria && !productos.some((p) => productMatchesCategory(p.category, categoria));
    return {
      text: categoria && sinProductosEnCategoria
        ? `Por ahora no hay productos registrados en la categoría ${categoria}. Puedes revisar otra categoría o explorar las tiendas disponibles.`
        : `No encontré una coincidencia fiable para «${consulta}» en el catálogo. Puedo ayudarte con productos y precios, disponibilidad, tiendas, ofertas, pedidos o formas de pago. ¿Cuál de esos temas quieres revisar?`,
      access: categoria && sinProductosEnCategoria ? { label: "Explorar tiendas", route: "/tiendas" } : undefined,
      catalogMatch: false,
    };
  }

  const primeros = candidatos.slice(0, 5);
  const consultaDisponibilidad = /\b(disponible|disponibilidad|stock|hay|tiene|tienes|tienen|vende|vendes|venden|queda|quedan)\b/.test(texto);
  const consultaPrecio = /\b(precio|cuesta|cuestan|vale|valen)\b/.test(texto);
  if (primeros.length === 1) {
    const producto = primeros[0];
    const tienda = producto.proveedorId ? storeNames[producto.proveedorId] : undefined;
    const detalle = `${producto.stock > 0 ? `${producto.stock} disponibles` : "agotado por ahora"}${tienda ? ` en ${tienda}` : ""}`;
    const text = consultaDisponibilidad
      ? producto.stock > 0
        ? `Sí, tenemos ${producto.name} disponible por $${producto.price.toLocaleString()}. Hay ${detalle}.`
        : `Por ahora no hay unidades de ${producto.name} disponibles${tienda ? ` en ${tienda}` : ""}.`
      : consultaPrecio
        ? `${producto.name} cuesta $${producto.price.toLocaleString()}${producto.stock > 0 ? ` y hay ${detalle}` : `; no hay unidades disponibles por ahora${tienda ? ` en ${tienda}` : ""}`}.`
        : `Encontré ${producto.name}: $${producto.price.toLocaleString()}, ${detalle}.`;
    return {
      text,
      access: producto.proveedorId ? { label: "Ver esta tienda", route: `/tiendas/${producto.proveedorId}` } : undefined,
      catalogMatch: true,
    };
  }
  const lineas = primeros.map((p) => {
    const tienda = p.proveedorId ? storeNames[p.proveedorId] : undefined;
    const precio = p.stock > 0 ? `$${p.price.toLocaleString()}` : "Agotado";
    const oferta = p.discountPercent > 0 ? ` · ${p.discountPercent}% de descuento` : "";
    const disponibilidad = p.stock > 0 ? ` · ${p.stock} disponibles` : "";
    return `• ${p.name} — ${precio}${oferta}${disponibilidad}${tienda ? ` · ${tienda}` : ""}`;
  });
  const extra = candidatos.length > primeros.length ? `\n...y ${candidatos.length - primeros.length} más.` : "";
  const resumen = consultaDisponibilidad
    ? `Sí, encontré ${candidatos.length} presentaciones en el catálogo actual:\n${lineas.join("\n")}${extra}`
    : consultaPrecio
      ? `Estos son los precios que encontré:\n${lineas.join("\n")}${extra}`
      : `Esto encontré en el catálogo actual:\n${lineas.join("\n")}${extra}`;
  return {
    text: resumen,
    catalogMatch: true,
  };
}

function buscarOfertas(mensaje: string, productos: ProductoChat[], storeNames: Record<string, string>): RespuestaBot {
  const categoria = findMatchingCategory(mensaje);
  const tokens = tokensDeBusqueda(mensaje).filter((token) => findMatchingCategory(token) !== categoria);
  const todasLasOfertas = productos.filter((p) => p.discountPercent > 0);
  const ofertas = todasLasOfertas
    .filter((p) => !categoria || productMatchesCategory(p.category, categoria))
    .filter((p) => tokens.every((token) => matchesSearchToken(token, `${p.name} ${p.category}`)))
    .sort((a, b) => b.discountPercent - a.discountPercent)
    .slice(0, 5);
  if (ofertas.length === 0) {
    const text = todasLasOfertas.length === 0
      ? "Ahora mismo no veo descuentos activos en el catálogo. Puedes explorar las categorías y volver a consultar más tarde."
      : `No encontré una oferta activa para «${tokens.join(" ") || categoria || "esa categoría"}». Hay descuentos en otros productos del catálogo.`;
    return { text, access: { label: "Ver ofertas", route: "/ofertas" } };
  }
  const lines = ofertas.map((p) => `• ${p.name} — $${p.price.toLocaleString()} (-${p.discountPercent}%)${p.stock > 0 ? " · disponible" : " · agotado"}${storeNames[p.proveedorId] ? ` · ${storeNames[p.proveedorId]}` : ""}`);
  return { text: `Estas son algunas ofertas activas ahora:\n${lines.join("\n")}`, access: { label: "Ver todas las ofertas", route: "/ofertas" } };
}

function buscarTiendas(mensaje: string, storeNames: Record<string, string>): RespuestaBot {
  const tokens = tokensDeBusqueda(mensaje).filter((token) => token !== "tienda" && token !== "tiendas");
  const matches = Object.entries(storeNames).filter(([, name]) => tokens.length === 0 || tokens.every((token) => matchesSearchToken(token, name)));
  if (matches.length === 0) {
    const noHayTiendas = Object.keys(storeNames).length === 0;
    return {
      text: noHayTiendas
        ? "Todavía no hay tiendas disponibles para mostrar. Puedes volver a revisar más tarde o buscar un producto en el catálogo."
        : "No encontré una tienda con ese nombre. Puedo mostrarte todas las tiendas disponibles o buscar directamente un producto.",
      access: { label: "Explorar tiendas", route: "/tiendas" },
    };
  }
  const names = matches.slice(0, 6).map(([, name]) => `• ${name}`).join("\n");
  const masTiendas = matches.length > 6 ? `\nY ${matches.length - 6} más.` : "";
  return { text: `${tokens.length === 0 ? "Estas son algunas tiendas disponibles" : "Estas son las tiendas que coinciden con tu consulta"}:\n${names}${masTiendas}`, access: { label: "Ver todas las tiendas", route: "/tiendas" } };
}

function responder(mensaje: string, productos: ProductoChat[], storeNames: Record<string, string>): RespuestaBot {
  const query = normalizar(mensaje);
  if (/\b(oferta|ofertas|descuento|descuentos|promocion|promociones|rebaja)\b/.test(query)) return buscarOfertas(mensaje, productos, storeNames);
  const producto = buscarProductos(mensaje, productos, storeNames);
  if (producto.catalogMatch) return producto;
  const intencion = buscarIntencion(mensaje);
  if (intencion && intencion.palabras[0] !== "tienda") return { text: intencion.respuesta, access: intencion.acceso };
  if (/\b(tienda|tiendas|tendero|tenderos)\b/.test(query)) return buscarTiendas(mensaje, storeNames);
  if (intencion) return { text: intencion.respuesta, access: intencion.acceso };
  return producto;
}

export default function ChatbotScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [messages, setMessages] = useState<{ from: "user" | "bot"; text: string; access?: Intencion["acceso"] }[]>([
    {
      from: "bot",
      text: "¡Hola! 👋 Soy tu asistente Ta Fresco. Pregúntame por un producto, o por cómo comprar, vender, pagar, hacer seguimiento a tu pedido o calificar productos.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [productos, setProductos] = useState<ProductoChat[]>([]);
  const [storeNames, setStoreNames] = useState<Record<string, string>>({});
  const flatListRef = useRef<FlatList>(null);
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
              discountPercent: Number(data.discountPercent) || 0,
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

  const sendMessage = (message = input) => {
    if (!message.trim()) return;

    const texto = message.trim();
    setMessages((prev) => [...prev, { from: "user", text: texto }]);
    setInput("");

    setIsTyping(true);
    const respuesta = responder(texto, productos, storeNames);

    setTimeout(() => {
      setMessages((prev) => [...prev, { from: "bot", text: respuesta.text, access: respuesta.access }]);
      setIsTyping(false);
    }, 350);
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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerIconCircle}>
          <Ionicons name="chatbubble-ellipses" size={16} color={colors.primary} />
        </View>
        <Text style={styles.headerTitle}>Asistente Ta Fresco</Text>
      </View>

      {/* MENSAJES */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={{ paddingVertical: spacing.lg, paddingHorizontal: spacing.md }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.message,
              item.from === "user" ? styles.userMessage : styles.botMessage,
            ]}
          >
            <>
              <Text style={[styles.messageText, item.from === "user" && styles.userMessageText]}>{item.text}</Text>
              {item.from === "bot" && item.access && (
                <TouchableOpacity style={styles.accessButton} onPress={() => router.push(item.access!.route as any)}>
                  <Text style={styles.accessButtonText}>{item.access.label}</Text>
                  <Ionicons name="arrow-forward" size={15} color={colors.white} />
                </TouchableOpacity>
              )}
            </>
          </View>
        )}
        ListFooterComponent={isTyping ? (
          <View style={[styles.message, styles.botMessage, styles.typingBubble]} accessibilityLabel="El asistente está escribiendo">
            <Text style={styles.typingText}>Buscando en Ta Fresco…</Text>
          </View>
        ) : null}
        style={{ flex: 1 }}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll} contentContainerStyle={styles.suggestions} keyboardShouldPersistTaps="handled">
        {["Ver frutas", "Ofertas", "Cómo comprar", "Mis pedidos", "Explorar tiendas"].map((suggestion) => (
          <TouchableOpacity key={suggestion} style={styles.suggestionChip} onPress={() => sendMessage(suggestion)}>
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* INPUT */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje..."
          value={input}
          onChangeText={setInput}
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={() => sendMessage()}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <TouchableOpacity style={styles.sendButton} onPress={() => sendMessage()}>
          <Ionicons name="send" size={19} color={colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 55,
    paddingVertical: spacing.lg,
    ...shadow.floating,
  },
  backBtn: { marginRight: spacing.md },
  headerIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.white,
  },

  message: {
    marginVertical: 6,
    marginHorizontal: 4,
    padding: spacing.md,
    borderRadius: radius.lg,
    maxWidth: "80%",
  },
  userMessage: {
    backgroundColor: colors.primary,
    alignSelf: "flex-end",
  },
  botMessage: {
    backgroundColor: colors.surface,
    alignSelf: "flex-start",
    ...shadow.card,
  },
  messageText: { color: colors.textPrimary, fontSize: 15, lineHeight: 20 },
  userMessageText: { color: colors.white },

  inputContainer: {
    flexDirection: "row",
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  suggestionsScroll: { height: 50, flexGrow: 0, flexShrink: 0, backgroundColor: colors.background },
  suggestions: { height: 50, alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: spacing.sm },
  suggestionChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  suggestionText: { color: colors.primaryDark, fontWeight: "600", fontSize: 12 },
  accessButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7, marginTop: 10, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  accessButtonText: { color: colors.white, fontWeight: "700", fontSize: 12 },
  typingBubble: { paddingVertical: spacing.sm },
  typingText: { color: colors.textMuted, fontSize: 13, fontStyle: "italic" },
  input: {
    flex: 1,
    height: 42,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  sendButton: {
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
    padding: 10,
    borderRadius: radius.pill,
  },
});
