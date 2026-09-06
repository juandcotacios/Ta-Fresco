import {
  addDoc,
  collection,
  getDocs,
  doc,
  runTransaction,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/src/config/firebase";

export interface PedidoItem {
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
  status: EstadoPedido;
  address: PedidoAddress | null;
  paymentMethod: "cash" | "card" | "nequi";
  proveedorIds: string[];
  /** Estado independiente de la parte del pedido que atiende cada tienda. */
  estadosPorProveedor: Record<string, EstadoPedido>;
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
    address: data.address || null,
    paymentMethod: (data.paymentMethod || "cash") as "cash" | "card" | "nequi",
    proveedorIds: data.proveedorIds || [],
    // Compatibilidad con pedidos creados antes de los estados por tienda.
    estadosPorProveedor: data.estadosPorProveedor || Object.fromEntries(
      (data.proveedorIds || []).map((proveedorId: string) => [proveedorId, data.status || "pendiente"])
    ),
    createdAt: data.createdAt || null,
  };
}

/**
 * Crea un pedido en Firestore a partir del carrito actual.
 * Calcula automáticamente qué proveedores tienen productos en este pedido
 * (proveedorIds), para que cada tendero pueda ver y avanzar sus propios pedidos.
 * Devuelve el id del pedido creado.
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

  const total = subtotal + envio;
  const proveedorIds = Array.from(
    new Set(items.map((i) => i.proveedorId).filter((id): id is string => !!id))
  );
  const estadosPorProveedor = Object.fromEntries(
    proveedorIds.map((proveedorId) => [proveedorId, "pendiente" as EstadoPedido])
  );

  const docRef = await addDoc(collection(db, "pedidos"), {
    userId,
    items,
    subtotal,
    envio,
    total,
    status: "pendiente" as EstadoPedido,
    address: address || null,
    paymentMethod,
    proveedorIds,
    estadosPorProveedor,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
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
 * Devuelve el estado de la parte atendida por una tienda. Los pedidos antiguos
 * usan temporalmente el estado general hasta que alguien los actualice.
 */
export function obtenerEstadoProveedor(pedido: Pedido, proveedorId: string): EstadoPedido {
  return pedido.estadosPorProveedor?.[proveedorId] || pedido.status || "pendiente";
}

function calcularEstadoGeneral(estados: EstadoPedido[]): EstadoPedido {
  if (estados.length === 0) return "pendiente";
  if (estados.every((estado) => estado === "cancelado")) return "cancelado";

  const activos = estados.filter((estado) => estado !== "cancelado");
  if (activos.every((estado) => estado === "entregado")) return "entregado";

  // El comprador ve el avance más retrasado de las entregas aún activas.
  return activos.reduce((masAtrasado, estado) =>
    ORDEN_ESTADOS.indexOf(estado) < ORDEN_ESTADOS.indexOf(masAtrasado)
      ? estado
      : masAtrasado
  );
}

/** Actualiza solamente el estado de la parte del pedido de una tienda. */
export async function actualizarEstadoProveedor(
  pedidoId: string,
  proveedorId: string,
  nuevoEstado: EstadoPedido
): Promise<void> {
  const pedidoRef = doc(db, "pedidos", pedidoId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(pedidoRef);
    if (!snapshot.exists()) throw new Error("El pedido ya no existe.");

    const data = snapshot.data();
    const proveedorIds = (data.proveedorIds || []) as string[];
    if (!proveedorIds.includes(proveedorId)) {
      throw new Error("Esta tienda no hace parte del pedido.");
    }

    const estadosPorProveedor: Record<string, EstadoPedido> = {
      ...Object.fromEntries(proveedorIds.map((id) => [id, data.status || "pendiente"])),
      ...(data.estadosPorProveedor || {}),
      [proveedorId]: nuevoEstado,
    };

    transaction.update(pedidoRef, {
      estadosPorProveedor,
      status: calcularEstadoGeneral(Object.values(estadosPorProveedor)),
    });
  });
}

/**
 * Actualización global reservada al administrador. Mantiene sincronizados los
 * estados por tienda para que no queden pedidos en un estado incoherente.
 */
export async function actualizarEstadoPedido(
  pedidoId: string,
  nuevoEstado: EstadoPedido
): Promise<void> {
  const pedidoRef = doc(db, "pedidos", pedidoId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(pedidoRef);
    if (!snapshot.exists()) throw new Error("El pedido ya no existe.");
    const proveedorIds = (snapshot.data().proveedorIds || []) as string[];
    transaction.update(pedidoRef, {
      status: nuevoEstado,
      estadosPorProveedor: Object.fromEntries(proveedorIds.map((id) => [id, nuevoEstado])),
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
