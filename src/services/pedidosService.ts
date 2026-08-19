import {
  addDoc,
  collection,
  getDocs,
  doc,
  updateDoc,
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
  paymentMethod: "cash" | "card";
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
    paymentMethod: (data.paymentMethod || "cash") as "cash" | "card",
    createdAt: data.createdAt || null,
  };
}

/**
 * Crea un pedido en Firestore a partir del carrito actual.
 * Devuelve el id del pedido creado.
 */
export async function crearPedido(
  userId: string,
  items: PedidoItem[],
  subtotal: number,
  envio: number,
  address?: PedidoAddress | null,
  paymentMethod: "cash" | "card" = "cash"
): Promise<string> {
  if (!userId) throw new Error("Usuario no autenticado.");
  if (!items || items.length === 0) throw new Error("El carrito está vacío.");

  const total = subtotal + envio;

  const docRef = await addDoc(collection(db, "pedidos"), {
    userId,
    items,
    subtotal,
    envio,
    total,
    status: "pendiente" as EstadoPedido,
    address: address || null,
    paymentMethod,
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

/**
 * Se suscribe en tiempo real a los pedidos de un usuario.
 * Llama a `callback` cada vez que algo cambia (nuevo pedido, cambio de estado, etc).
 * Devuelve una función para cancelar la suscripción (llamarla al desmontar la pantalla).
 */
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
 * Se suscribe en tiempo real a TODOS los pedidos (todos los usuarios).
 * Uso temporal: panel de gestión mientras no existan roles de proveedor.
 */
export function suscribirseTodosLosPedidos(
  callback: (pedidos: Pedido[]) => void
): Unsubscribe {
  const q = query(collection(db, "pedidos"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(mapPedido));
  });
}

/** Actualiza el estado de un pedido (usado por el panel de gestión). */
export async function actualizarEstadoPedido(
  pedidoId: string,
  nuevoEstado: EstadoPedido
): Promise<void> {
  await updateDoc(doc(db, "pedidos", pedidoId), { status: nuevoEstado });
}

/** Texto y color por estado, para mostrar en pantalla. */
export const ESTADO_LABELS: Record<EstadoPedido, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "#f0a500" },
  confirmado: { label: "Confirmado", color: "#3b82f6" },
  en_camino: { label: "En camino", color: "#8b5cf6" },
  entregado: { label: "Entregado", color: "#22c55e" },
  cancelado: { label: "Cancelado", color: "#ef4444" },
};