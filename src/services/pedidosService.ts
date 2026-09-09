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
    createdAt: data.createdAt || null,
  };
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

  const total = subtotal + envio;
  const proveedorIds = Array.from(
    new Set(items.map((i) => i.proveedorId).filter((id): id is string => !!id))
  );

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
      items,
      subtotal,
      envio,
      total,
      status: "pendiente" as EstadoPedido,
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

/** Actualiza el estado de un pedido (usado por el panel de admin y por el tendero). */
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