/**
 * Lógica pura del ciclo de vida de un pedido: estados, transición válida entre
 * ellos, y el cálculo del estado "resumen" de un pedido con varias tiendas.
 *
 * Vive separada de pedidosService.ts (que sí depende de Firebase) a propósito:
 * así se puede probar con pruebas unitarias simples -ver
 * pedidosEstadoMachine.test.ts- sin tener que levantar ni simular Firestore.
 * pedidosService.ts importa todo esto y lo vuelve a exportar, así que ninguna
 * pantalla que ya importaba estos nombres desde ahí tiene que cambiar.
 */

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

/** Texto y color por estado, para mostrar en pantalla. */
export const ESTADO_LABELS: Record<EstadoPedido, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "#f0a500" },
  confirmado: { label: "Confirmado", color: "#3b82f6" },
  en_camino: { label: "En camino", color: "#8b5cf6" },
  entregado: { label: "Entregado", color: "#22c55e" },
  cancelado: { label: "Cancelado", color: "#ef4444" },
};

/**
 * Accede a ESTADO_LABELS con una red de seguridad. `item.status` y las llaves
 * de `estadosPorProveedor` vienen directo de Firestore sin pasar por el tipo
 * `EstadoPedido`; un dato legado, un valor todavía no migrado, o un campo que
 * llegó vacío hacían que `ESTADO_LABELS[x]` diera `undefined` y la pantalla
 * tronara al leer `.label`/`.color`. Con esto, un valor desconocido muestra
 * "Desconocido" en gris en vez de romper la pantalla (SEG-N03).
 */
export function labelEstado(estado: unknown): { label: string; color: string } {
  if (typeof estado === "string" && estado in ESTADO_LABELS) {
    return ESTADO_LABELS[estado as EstadoPedido];
  }
  return { label: "Desconocido", color: "#9ca3af" };
}

/**
 * Calcula el estado "resumen" de un pedido a partir del estado de cada tienda:
 * es el más atrasado de todos (si una tienda va en "pendiente" y otra en
 * "en_camino", el resumen sigue en "pendiente" hasta que la más lenta avance).
 * Las tiendas canceladas no cuentan para este cálculo, salvo que todas lo estén.
 */
export function calcularEstadoGlobal(
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

/** Lo que resulta de que el admin fuerce un estado sobre TODO el pedido de una vez. */
export interface ResultadoEstadoAdmin {
  /** Estado de cada tienda después del cambio: las finales quedan intactas. */
  nuevosEstados: Record<string, EstadoPedido>;
  /** Tiendas que de verdad cambiaron de estado en esta operación (para el motivo de cancelación). */
  proveedoresQueCambian: string[];
}

/**
 * Uso del ADMIN: aplica un mismo estado nuevo sobre todas las tiendas del
 * pedido a la vez, pero solo a las que de verdad avanzan con este cambio:
 * - Una tienda en un estado final (entregado o cancelado) nunca se toca.
 * - Si `nuevoEstado` es un paso de la secuencia normal (no "cancelado"), solo
 *   se mueven las tiendas que estén ATRÁS de ese punto; una que ya iba igual
 *   de adelantada o más (por ejemplo, otra tienda del mismo pedido que ya
 *   confirmó aparte) se deja como está, nunca retrocede.
 * - Si `nuevoEstado` es "cancelado", se cancelan todas las tiendas activas
 *   (cancelar es válido desde cualquier punto de la secuencia), excepto las
 *   que ya son finales.
 */
export function aplicarEstadoAdmin(
  estadosActuales: Record<string, EstadoPedido>,
  proveedorIds: string[],
  nuevoEstado: EstadoPedido
): ResultadoEstadoAdmin {
  const nuevosEstados: Record<string, EstadoPedido> = { ...estadosActuales };
  const proveedoresQueCambian: string[] = [];
  const indiceNuevo = ORDEN_ESTADOS.indexOf(nuevoEstado);
  proveedorIds.forEach((id) => {
    const actual = estadosActuales[id] || "pendiente";
    if (esEstadoFinal(actual)) return; // ya entregó o canceló: no se toca
    if (nuevoEstado !== "cancelado" && ORDEN_ESTADOS.indexOf(actual) >= indiceNuevo) {
      return; // ya está en ese punto de la secuencia o más adelante: no se toca
    }
    nuevosEstados[id] = nuevoEstado;
    proveedoresQueCambian.push(id);
  });
  return { nuevosEstados, proveedoresQueCambian };
}

/**
 * Unidades que hay que devolver al inventario al cancelar, por id de producto.
 * Solo cuentan los ítems de tiendas que todavía estaban en un estado ACTIVO
 * (ni cancelado ni entregado). Omitir también "entregado" es a propósito: si
 * una tienda ya marcó su parte como entregada, esa mercancía ya salió del
 * inventario para siempre, y un "cancelar todo" del admin sobre el resto del
 * pedido no le puede devolver unidades que ya se entregaron. `soloProveedorId`
 * limita el cálculo a una tienda (cancelación hecha por el tendero); sin él
 * aplica a todo el pedido (admin).
 */
export function unidadesADevolver(
  items: PedidoItem[],
  estadosPorProveedor: Record<string, EstadoPedido>,
  estadoGlobal: EstadoPedido,
  soloProveedorId?: string
): Record<string, number> {
  const unidades: Record<string, number> = {};
  for (const item of items) {
    if (soloProveedorId && item.proveedorId !== soloProveedorId) continue;
    const estadoPrevio = item.proveedorId
      ? estadosPorProveedor[item.proveedorId] ?? estadoGlobal
      : estadoGlobal;
    if (esEstadoFinal(estadoPrevio)) continue;
    unidades[item.id] = (unidades[item.id] || 0) + item.quantity;
  }
  return unidades;
}

/**
 * Un pedido (o la parte de una tienda dentro de él) ya "entregado" o
 * "cancelado" es un estado final: no se puede reabrir, avanzar ni volver a
 * cancelar. Sin este freno, nada impedía que una llamada repetida, un botón
 * presionado dos veces, o una pantalla nueva reescribiera un pedido que ya
 * había terminado su ciclo.
 */
export function esEstadoFinal(estado: EstadoPedido): boolean {
  return estado === "entregado" || estado === "cancelado";
}

/**
 * Valida que el cambio de estado tenga sentido: no se puede tocar un pedido
 * que ya está en un estado final, y el único salto permitido fuera de la
 * secuencia normal es cancelar (desde cualquier estado activo). Avanzar de
 * estado solo puede ser al siguiente paso, nunca saltarse uno ni retroceder.
 */
export function validarTransicionEstado(estadoActual: EstadoPedido, nuevoEstado: EstadoPedido): void {
  if (esEstadoFinal(estadoActual)) {
    throw new Error(
      `Este pedido ya está "${ESTADO_LABELS[estadoActual].label}" y no se puede modificar.`
    );
  }
  if (nuevoEstado === "cancelado") return; // cancelar es válido desde cualquier estado activo
  const indiceActual = ORDEN_ESTADOS.indexOf(estadoActual);
  const indiceNuevo = ORDEN_ESTADOS.indexOf(nuevoEstado);
  if (indiceNuevo !== indiceActual + 1) {
    throw new Error("No se puede saltar ni retroceder un estado del pedido.");
  }
}
