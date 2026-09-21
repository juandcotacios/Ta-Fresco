import {
  addDoc,
  collection,
  getDocs,
  doc,
  updateDoc,
  onSnapshot,
  runTransaction,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/src/config/firebase";

export interface PedidoItem {
  /**
   * Id del documento en `Productos`. En `valoraciones` este mismo dato se llama
   * `productoId`; el nombre `id` se conserva aquí para no romper los pedidos ya guardados.
   */
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  proveedorId?: string;
}

export interface PedidoAddress {
  name: string;
  addressLine: string;
}

export type EstadoPedido =
  | "pendiente"
  | "confirmado"
  | "en_camino"
  | "entregado"
  | "cancelado";

/** Orden de avance normal (sin contar "cancelado", que es un estado aparte). */
export const ORDEN_ESTADOS: EstadoPedido[] = [
  "pendiente",
  "confirmado",
  "en_camino",
  "entregado",
];

export interface Pedido {
  id: string;
  userId: string;
  items: PedidoItem[];
  subtotal: number;
  envio: number;
  total: number;
  /** Estado "resumen": el más atrasado entre todas las tiendas del pedido. */
  status: EstadoPedido;
  /** Estado independiente de cada tienda dentro de este pedido. */
  estadosPorProveedor: Record<string, EstadoPedido>;
  address: PedidoAddress | null;
  paymentMethod: "cash" | "card" | "nequi";
  proveedorIds: string[];
  createdAt: Timestamp | null;
}

function mapPedido(docSnap: any): Pedido {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    userId: data.userId,
    items: data.items || [],
    subtotal: data.subtotal || 0,
    envio: data.envio || 0,
    total: data.total || 0,
    status: (data.status || "pendiente") as EstadoPedido,
    estadosPorProveedor: data.estadosPorProveedor || {},
    address: data.address || null,
    paymentMethod: (data.paymentMethod || "cash") as "cash" | "card" | "nequi",
    proveedorIds: data.proveedorIds || [],
    createdAt: data.createdAt || null,
  };
}

/**
 * Calcula el estado "resumen" de un pedido a partir del estado de cada tienda:
 * es el más atrasado de todos (si una tienda va en "pendiente" y otra en
 * "en_camino", el resumen sigue en "pendiente" hasta que la más lenta avance).
 * Las tiendas canceladas no cuentan para este cálculo, salvo que todas lo estén.
 */
function calcularEstadoGlobal(
  estadosPorProveedor: Record<string, EstadoPedido>,
  proveedorIds: string[]
): EstadoPedido {
  const estados = proveedorIds.map((id) => estadosPorProveedor[id] || "pendiente");
  const activos = estados.filter((e) => e !== "cancelado");
  if (activos.length === 0) return "cancelado";
  const indices = activos.map((e) => ORDEN_ESTADOS.indexOf(e));
  const minIndex = Math.min(...indices);
  return ORDEN_ESTADOS[minIndex];
}

/** Devuelve el estado de UNA tienda puntual dentro de un pedido. */
export function obtenerEstadoProveedor(pedido: Pedido, proveedorId: string): EstadoPedido {
  return pedido.estadosPorProveedor?.[proveedorId] ?? pedido.status;
}

/**
 * Reduce un ítem al shape exacto de `PedidoItem`.
 *
 * TypeScript no marca error de propiedades excedentes cuando se pasa una
 * variable (p. ej. el `CartItem[]` del carrito) donde se espera `PedidoItem[]`,
 * así que sin este paso Firestore terminaba guardando también `category`,
 * `stock` y `discountPercent`. Los opcionales solo se incluyen si tienen valor,
 * porque Firestore rechaza campos `undefined`.
 */
function toPedidoItem(item: PedidoItem): PedidoItem {
  const limpio: PedidoItem = {
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
  };
  if (item.imageUrl) limpio.imageUrl = item.imageUrl;
  if (item.proveedorId) limpio.proveedorId = item.proveedorId;
  return limpio;
}

/**
 * Crea un pedido y descuenta el stock de cada producto, todo dentro de una
 * misma transacción: si algún producto ya no tiene stock suficiente en el
 * momento exacto de confirmar, NADA se guarda (ni el pedido ni el descuento)
 * y se lanza un error explicando cuál producto falló. Esto evita que dos
 * compradores se lleven "el último" al mismo tiempo.
 */
export async function crearPedido(
  userId: string,
  items: PedidoItem[],
  subtotal: number,
  envio: number,
  address?: PedidoAddress | null,
  paymentMethod: "cash" | "card" | "nequi" = "cash"
): Promise<string> {
  if (!userId) throw new Error("Usuario no autenticado.");
  if (!items || items.length === 0) throw new Error("El carrito está vacío.");

  // Lo que se persiste es exactamente PedidoItem, sin campos extra del carrito.
  const itemsPedido = items.map(toPedidoItem);

  const total = subtotal + envio;
  const proveedorIds = Array.from(
    new Set(items.map((i) => i.proveedorId).filter((id): id is string => !!id))
  );
  const estadosPorProveedor: Record<string, EstadoPedido> = {};
  proveedorIds.forEach((id) => {
    estadosPorProveedor[id] = "pendiente";
  });

  const pedidoRef = doc(collection(db, "pedidos"));

  await runTransaction(db, async (transaction) => {
    // 1) Leer el stock actual de cada producto (todas las lecturas van primero,
    // es una regla de las transacciones de Firestore).
    const stockActual: Record<string, number> = {};
    for (const item of items) {
      const productoRef = doc(db, "Productos", item.id);
      const snap = await transaction.get(productoRef);
      if (!snap.exists()) {
        throw new Error(`El producto "${item.name}" ya no está disponible.`);
      }
      const stock = (snap.data() as any).stock ?? 0;
      if (stock < item.quantity) {
        throw new Error(
          stock === 0
            ? `"${item.name}" se agotó justo ahora.`
            : `Solo quedan ${stock} de "${item.name}" (pediste ${item.quantity}).`
        );
      }
      stockActual[item.id] = stock;
    }

    // 2) Recién ahora se escribe: se descuenta el stock y se crea el pedido.
    for (const item of items) {
      const productoRef = doc(db, "Productos", item.id);
      transaction.update(productoRef, { stock: stockActual[item.id] - item.quantity });
    }

    transaction.set(pedidoRef, {
      userId,
      items: itemsPedido,
      subtotal,
      envio,
      total,
      status: "pendiente" as EstadoPedido,
      estadosPorProveedor,
      address: address || null,
      paymentMethod,
      proveedorIds,
      createdAt: serverTimestamp(),
    });
  });

  return pedidoRef.id;
}

/** Trae el historial de pedidos de un usuario una sola vez (sin tiempo real). */
export async function obtenerPedidosUsuario(userId: string): Promise<Pedido[]> {
  if (!userId) return [];
  const q = query(
    collection(db, "pedidos"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapPedido);
}

/** Se suscribe en tiempo real a los pedidos de un usuario (como comprador). */
export function suscribirsePedidosUsuario(
  userId: string,
  callback: (pedidos: Pedido[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "pedidos"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(mapPedido));
  });
}

/**
 * Se suscribe en tiempo real a los pedidos que contienen al menos un producto
 * de este proveedor (uso: el tendero gestionando sus propios pedidos).
 */
export function suscribirsePedidosDeProveedor(
  proveedorId: string,
  callback: (pedidos: Pedido[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "pedidos"),
    where("proveedorIds", "array-contains", proveedorId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(mapPedido));
  });
}

/**
 * Se suscribe en tiempo real a TODOS los pedidos (todos los usuarios).
 * Uso: panel de administración.
 */
export function suscribirseTodosLosPedidos(
  callback: (pedidos: Pedido[]) => void
): Unsubscribe {
  const q = query(collection(db, "pedidos"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(mapPedido));
  });
}

/**
 * Uso del ADMIN: fuerza el mismo estado para TODAS las tiendas de un pedido
 * a la vez (una anulación general por encima de cada tendero individual).
 */
export async function actualizarEstadoPedido(
  pedidoId: string,
  nuevoEstado: EstadoPedido
): Promise<void> {
  const pedidoRef = doc(db, "pedidos", pedidoId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(pedidoRef);
    if (!snap.exists()) throw new Error("El pedido ya no existe.");
    const data = snap.data() as any;
    const proveedorIds: string[] = data.proveedorIds || [];
    const nuevosEstados: Record<string, EstadoPedido> = {};
    proveedorIds.forEach((id) => {
      nuevosEstados[id] = nuevoEstado;
    });
    transaction.update(pedidoRef, {
      estadosPorProveedor: nuevosEstados,
      status: nuevoEstado,
    });
  });
}

/**
 * Uso del TENDERO: actualiza el estado de SU tienda dentro del pedido, sin
 * afectar a las demás tiendas del mismo pedido. El estado "resumen" del
 * pedido se recalcula solo, como el más atrasado entre todas.
 */
export async function actualizarEstadoProveedor(
  pedidoId: string,
  proveedorId: string,
  nuevoEstado: EstadoPedido
): Promise<void> {
  const pedidoRef = doc(db, "pedidos", pedidoId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(pedidoRef);
    if (!snap.exists()) throw new Error("El pedido ya no existe.");
    const data = snap.data() as any;
    const proveedorIds: string[] = data.proveedorIds || [];
    const estadosActuales: Record<string, EstadoPedido> = data.estadosPorProveedor || {};
    const nuevosEstados = { ...estadosActuales, [proveedorId]: nuevoEstado };
    const nuevoGlobal = calcularEstadoGlobal(nuevosEstados, proveedorIds);
    transaction.update(pedidoRef, {
      estadosPorProveedor: nuevosEstados,
      status: nuevoGlobal,
    });
  });
}

/** Texto y color por estado, para mostrar en pantalla. */
export const ESTADO_LABELS: Record<EstadoPedido, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "#f0a500" },
  confirmado: { label: "Confirmado", color: "#3b82f6" },
  en_camino: { label: "En camino", color: "#8b5cf6" },
  entregado: { label: "Entregado", color: "#22c55e" },
  cancelado: { label: "Cancelado", color: "#ef4444" },
};