/**
 * En el catálogo `price` siempre es el precio que paga el cliente. Cuando un
 * producto tiene descuento, el precio original se deriva de ese valor para
 * poder presentarlo de la misma forma en todas las pantallas.
 */
export function getOriginalPrice(price: number, discountPercent?: number): number | null {
  const discount = Number(discountPercent) || 0;
  if (discount <= 0 || discount >= 100) return null;

  return Math.round(price / (1 - discount / 100));
}

export function hasDiscount(discountPercent?: number): boolean {
  return (Number(discountPercent) || 0) > 0;
}
