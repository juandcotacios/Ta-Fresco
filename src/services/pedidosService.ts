import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/src/config/firebase";

export interface PedidoItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export type EstadoPedido =
  | "pendiente"
  | "confirmado"
  | "en_camino"
  | "entregado"
  | "cancelado";

export interface Pedido {
  id: string;
  userId: string;
  items: PedidoItem[];
  subtotal: number;
  envio: number;
  total: number;
  status: EstadoPedido;
  createdAt: Timestamp | null;
}

/**
 * Crea un pedido en Firestore a partir del carrito actual.
 * Devuelve el id del pedido creado.
 */
export async function crearPedido(
  userId: string,
  items: PedidoItem[],
  subtotal: number,
  envio: number
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
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Trae el historial de pedidos de un usuario, del más reciente al más antiguo.
 */
export async function obtenerPedidosUsuario(userId: string): Promise<Pedido[]> {
  if (!userId) return [];

  const q = query(
    collection(db, "pedidos"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      userId: data.userId,
      items: data.items || [],
      subtotal: data.subtotal || 0,
      envio: data.envio || 0,
      total: data.total || 0,
      status: (data.status || "pendiente") as EstadoPedido,
      createdAt: data.createdAt || null,
    };
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