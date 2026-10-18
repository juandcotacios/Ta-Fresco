/**
 * Único lugar que decide si un producto está agotado, o si la cantidad que
 * ya hay en el carrito llegó al tope de stock disponible, para mostrarlo en
 * pantalla (badge "AGOTADO", botón "Agregar" deshabilitado, etc).
 *
 * Antes cada pantalla (inicio, ofertas, una tienda, el carrito) copiaba a
 * mano estas mismas dos líneas. Bastaba con que UNA de esas copias tuviera
 * un error para que esa pantalla sola dejara agregar y comprar algo agotado
 * sin que las demás se enteraran — así pasó en el carrito, donde "productos
 * que te podrían gustar" leía el stock con `data.stock || 99`: como 0 es
 * "falsy" en JavaScript, un producto realmente agotado (stock: 0) terminaba
 * mostrado con un stock falso de 99, se podía agregar sin problema, y el
 * carrito lo contaba como comprable. Ahora todas las pantallas llaman a
 * estas dos funciones en vez de repetir la regla cada una por su lado.
 *
 * Un stock ausente, nulo o inválido se trata como agotado (0), nunca como
 * "ilimitado": es la lectura conservadora correcta para decidir si se debe
 * dejar agregar algo al carrito.
 */
export function estaAgotado(stock: number | null | undefined): boolean {
  return (stock ?? 0) <= 0;
}

/** true si la cantidad ya en el carrito llegó al stock disponible de ese producto. */
export function alTopeDeStock(cantidad: number, stock: number | null | undefined): boolean {
  return cantidad >= (stock ?? 0);
}
