// Réplica exacta de TotalView.tsx del frontend. El total que calcula el backend
// tiene que dar igual al que el cliente vio antes de confirmar; si estas reglas
// se separan, le cobraríamos algo distinto a lo que aceptó.
export const FREE_SHIPPING_FROM = 150000;

/** "45.000" -> 45000. El catálogo trae los precios en formato colombiano. */
export const parseCopPrice = (price: string): number =>
  Number(price.replace(/\./g, ""));

/** 45000 -> "$ 45.000". Mismo formato que ve el cliente en la tienda. */
export const formatCop = (value: number): string =>
  `$ ${new Intl.NumberFormat("es-CO").format(value)}`;

/**
 * Una línea del pedido con su precio ya resuelto. Los campos descriptivos son
 * opcionales porque cuando el catálogo no está disponible solo conocemos lo que
 * mandó el navegador: el id, la molienda y el precio que mostró.
 */
export interface PricedLine {
  productId: string;
  name: string | null;
  brand: string | null;
  size: string | null;
  grinding: string;
  quantity: number;
  unitPrice: number;
  shippingPrice: number;
}

export interface Totals {
  subtotal: number;
  shipping: number;
  total: number;
}

export const computeTotals = (lines: PricedLine[]): Totals => {
  const subtotal = lines.reduce(
    (acc, line) => acc + line.unitPrice * line.quantity,
    0,
  );

  // El envío sale del primer producto del carrito, no de la suma ni del mayor.
  // Se conserva tal cual para no desviarse del frontend; hoy da lo mismo porque
  // los 5 productos comparten shippingPrice = 7000, pero dejaría de darlo si se
  // agrega uno con un envío distinto.
  const shipping =
    lines.length === 0 || subtotal >= FREE_SHIPPING_FROM
      ? 0
      : lines[0].shippingPrice;

  return { subtotal, shipping, total: subtotal + shipping };
};
