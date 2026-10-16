import {
  collection,
  getDocs,
  doc,
  onSnapshot,
  runTransaction,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  Transaction,
  DocumentReference,
} from "firebase/firestore";
import { db } from "@/src/config/firebase";
import {
  PedidoItem,
  EstadoPedido,
  ORDEN_ESTADOS,
  ESTADO_LABELS,
  calcularEstadoGlobal,
  aplicarEstadoAdmin,
  unidadesADevolver,
  validarTransicionEstado,
  labelEstado,
} from "./pedidosEstadoMachine";

// El estado del pedido (tipos, transición válida entre estados, cálculo del
// estado resumen) vive en pedidosEstadoMachine.ts, sin depender de Firebase,
// para poder probarlo con pruebas unitarias. Se re-exporta todo acá para que
// ninguna pantalla que ya importaba estos nombres desde este archivo tenga que cambiar.
export type { PedidoItem, EstadoPedido };
export { ORDEN_ESTADOS, ESTADO_LABELS, unidadesADevolver, labelEstado };

export interface PedidoAddress {
  name: string;
  addressLine: string;
}

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
  /** Motivo que dio cada tienda (o el admin) al cancelar su parte del pedido. */
  motivosCancelacion?: Record<string, string>;
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
    motivosCancelacion: data.motivosCancelacion || undefined,
  };
}

/**
 * Lee el stock actual de los productos a los que hay que devolver unidades.
 * Va antes de cualquier escritura (regla de las transacciones). Si un producto
 * ya fue eliminado del catálogo no hay a dónde devolver, y se omite.
 */
async function leerStockParaDevolver(
  transaction: Transaction,
  unidades: Record<string, number>
): Promise<{ ref: DocumentReference; stock: number; cantidad: number }[]> {
  const lecturas: { ref: DocumentReference; stock: number; cantidad: number }[] = [];
  for (const [productoId, cantidad] of Object.entries(unidades)) {
    const ref = doc(db, "Productos", productoId);
    const snap = await transaction.get(ref);
    if (snap.exists()) lecturas.push({ ref, stock: (snap.data() as any).stock ?? 0, cantidad });
  }
  return lecturas;
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
 *
 * Trae los 300 más recientes en vez de la colección completa: sin este tope,
 * el panel se pone cada vez más lento (y cada vez más caro de leer) a medida
 * que crece el histórico. Si algún día el admin necesita ver más atrás de los
 * últimos 300, hay que agregar paginación real ("cargar más"); subir solo el
 * número acá no resuelve ese caso.
 */
export function suscribirseTodosLosPedidos(
  callback: (pedidos: Pedido[]) => void
): Unsubscribe {
  const q = query(collection(db, "pedidos"), orderBy("createdAt", "desc"), limit(300));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(mapPedido));
  });
}

/**
 * Uso del ADMIN: fuerza un mismo estado nuevo sobre todas las tiendas ACTIVAS
 * de un pedido a la vez (una anulación general por encima de cada tendero
 * individual). Las tiendas que ya llegaron a un estado final (entregado o
 * cancelado) se dejan intactas -ver aplicarEstadoAdmin()-, así que esto nunca
 * retrocede a una tienda que ya iba más adelante que las demás, ni revive ni
 * repone stock de una tienda que ya entregó o ya había cancelado su parte.
 */
export async function actualizarEstadoPedido(
  pedidoId: string,
  nuevoEstado: EstadoPedido,
  motivo?: string
): Promise<void> {
  const pedidoRef = doc(db, "pedidos", pedidoId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(pedidoRef);
    if (!snap.exists()) throw new Error("El pedido ya no existe.");
    const data = snap.data() as any;
    validarTransicionEstado((data.status || "pendiente") as EstadoPedido, nuevoEstado);
    const proveedorIds: string[] = data.proveedorIds || [];
    const estadosActuales: Record<string, EstadoPedido> = data.estadosPorProveedor || {};
    const { nuevosEstados, proveedoresQueCambian } = aplicarEstadoAdmin(
      estadosActuales,
      proveedorIds,
      nuevoEstado
    );
    // El resumen se recalcula a partir de cómo quedó cada tienda (no se asume
    // que sea igual a nuevoEstado): si alguna tienda activa quedó sin tocar
    // por estar ya en un estado final, el resumen refleja eso.
    const nuevoGlobal = calcularEstadoGlobal(nuevosEstados, proveedorIds);

    // Al cancelar, las unidades vuelven al inventario (lecturas antes de
    // escribir). unidadesADevolver ya omite cualquier tienda en un estado
    // final (incluida "entregado"), así que nunca repone mercancía que una
    // tienda ya entregó o que ya estaba cancelada antes de esta operación.
    const devolver =
      nuevoEstado === "cancelado"
        ? unidadesADevolver(data.items || [], estadosActuales, data.status || "pendiente")
        : {};
    const reposiciones = await leerStockParaDevolver(transaction, devolver);
    reposiciones.forEach((r) => transaction.update(r.ref, { stock: r.stock + r.cantidad }));

    const updateData: Record<string, unknown> = {
      estadosPorProveedor: nuevosEstados,
      status: nuevoGlobal,
    };
    // El admin cancela todo el pedido de una vez: el motivo aplica solo a las
    // tiendas que de verdad cambiaron en esta operación (nunca a una que ya
    // estaba en un estado final, que ni se tocó).
    if (nuevoEstado === "cancelado" && motivo?.trim() && proveedoresQueCambian.length > 0) {
      const motivosPrevios: Record<string, string> = data.motivosCancelacion || {};
      const motivosNuevos = { ...motivosPrevios };
      proveedoresQueCambian.forEach((id) => {
        motivosNuevos[id] = motivo.trim();
      });
      updateData.motivosCancelacion = motivosNuevos;
    }
    transaction.update(pedidoRef, updateData);
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
  nuevoEstado: EstadoPedido,
  motivo?: string
): Promise<void> {
  const pedidoRef = doc(db, "pedidos", pedidoId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(pedidoRef);
    if (!snap.exists()) throw new Error("El pedido ya no existe.");
    const data = snap.data() as any;
    const proveedorIds: string[] = data.proveedorIds || [];
    const estadosActuales: Record<string, EstadoPedido> = data.estadosPorProveedor || {};
    validarTransicionEstado(estadosActuales[proveedorId] || "pendiente", nuevoEstado);
    const nuevosEstados = { ...estadosActuales, [proveedorId]: nuevoEstado };
    const nuevoGlobal = calcularEstadoGlobal(nuevosEstados, proveedorIds);

    // Al cancelar, solo se devuelven las unidades de ESTA tienda.
    const devolver =
      nuevoEstado === "cancelado"
        ? unidadesADevolver(data.items || [], estadosActuales, data.status || "pendiente", proveedorId)
        : {};
    const reposiciones = await leerStockParaDevolver(transaction, devolver);
    reposiciones.forEach((r) => transaction.update(r.ref, { stock: r.stock + r.cantidad }));

    const updateData: Record<string, unknown> = {
      estadosPorProveedor: nuevosEstados,
      status: nuevoGlobal,
    };
    // El tendero solo cancela SU tienda: el motivo se guarda solo para esa tienda,
    // sin tocar lo que otras tiendas del mismo pedido hayan escrito.
    if (nuevoEstado === "cancelado" && motivo?.trim()) {
      const motivosPrevios: Record<string, string> = data.motivosCancelacion || {};
      updateData.motivosCancelacion = { ...motivosPrevios, [proveedorId]: motivo.trim() };
    }
    transaction.update(pedidoRef, updateData);
  });
}