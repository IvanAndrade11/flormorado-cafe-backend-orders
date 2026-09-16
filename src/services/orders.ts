import type { Catalog } from "@/schemas/catalog";
import type { OrderRequest } from "@/schemas/order";
import type { Env } from "@/types/env";
import {
  computeTotals,
  parseCopPrice,
  type PricedLine,
  type Totals,
} from "@/utils/constants";

export type PricingFailure =
  | { code: "producto_inexistente"; productId: string }
  | { code: "producto_agotado"; productId: string }
  | { code: "precio_desactualizado"; productId: string; actual: number }
  | { code: "total_no_coincide"; actual: number };

export interface PricedOrder {
  lines: PricedLine[];
  totals: Totals;
}

/**
 * Arma las líneas del pedido con los precios del catálogo, ignorando los que
 * mandó el navegador. Los precios del cliente solo se comparan: si difieren es
 * que su carrito quedó viejo (se guarda 14 días) y los precios cambiaron desde
 * entonces, y cobrarle otra cosa sin avisarle sería incorrecto.
 */
export const priceOrder = (
  request: OrderRequest,
  catalog: Catalog,
): PricedOrder | { failures: PricingFailure[] } => {
  const failures: PricingFailure[] = [];
  const lines: PricedLine[] = [];

  for (const item of request.items) {
    const product = catalog.products.find((p) => p.id === item.productId);

    if (!product) {
      failures.push({
        code: "producto_inexistente",
        productId: item.productId,
      });
      continue;
    }

    if (!product.stock) {
      failures.push({ code: "producto_agotado", productId: item.productId });
      continue;
    }

    const unitPrice = parseCopPrice(product.price);
    if (unitPrice !== item.unitPrice) {
      failures.push({
        code: "precio_desactualizado",
        productId: item.productId,
        actual: unitPrice,
      });
    }

    lines.push({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      size: product.size,
      grinding: item.grinding,
      quantity: item.quantity,
      unitPrice,
      shippingPrice: product.shippingPrice,
    });
  }

  if (failures.length > 0) return { failures };

  const totals = computeTotals(lines);
  if (totals.total !== request.declaredTotal) {
    return { failures: [{ code: "total_no_coincide", actual: totals.total }] };
  }

  return { lines, totals };
};

/**
 * Camino degradado: ConfigCat no respondió. Se acepta el pedido con lo que
 * mandó el navegador y se marca como no verificado, porque perder una venta es
 * peor que registrar un precio que alguien revisará antes de despachar.
 */
export const priceFromClient = (request: OrderRequest): PricedOrder => ({
  lines: request.items.map((item) => ({
    productId: item.productId,
    name: null,
    brand: null,
    size: null,
    grinding: item.grinding,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    shippingPrice: 0,
  })),
  totals: {
    subtotal: request.declaredTotal,
    shipping: 0,
    total: request.declaredTotal,
  },
});

const pad = (n: number, width: number) => String(n).padStart(width, "0");

// Colombia es UTC−5 y no usa horario de verano, así que un desplazamiento fijo
// alcanza. Sin esto, todo pedido que entra después de las 7pm queda numerado
// con la fecha del día siguiente, y el negocio lo ve como "pedido del 16"
// cuando llegó la tarde del 15. `created_at` se sigue guardando en UTC.
const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000;

/** Fecha calendario en Colombia, para el número de pedido: "20260915" */
export const colombianDayStamp = (now: Date): string => {
  const local = new Date(now.getTime() + COLOMBIA_OFFSET_MS);
  return `${local.getUTCFullYear()}${pad(local.getUTCMonth() + 1, 2)}${pad(local.getUTCDate(), 2)}`;
};

/** Número legible por el que el cliente pregunta: FM-20260915-001 */
export const buildOrderId = async (db: D1Database, now: Date) => {
  const prefix = `FM-${colombianDayStamp(now)}-`;

  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE id LIKE ?1")
    .bind(`${prefix}%`)
    .first<{ n: number }>();

  return `${prefix}${pad((row?.n ?? 0) + 1, 3)}`;
};

export interface PersistArgs {
  orderId: string;
  request: OrderRequest;
  priced: PricedOrder;
  pricesVerified: boolean;
  now: Date;
}

export const persistOrder = async (env: Env, args: PersistArgs) => {
  const { orderId, request, priced, pricesVerified, now } = args;
  const { contact, delivery, payment } = request;

  const insertOrder = env.DB.prepare(
    `INSERT INTO orders (
       id, created_at, status, idempotency_key,
       customer_name, customer_surname, email, phone, whatsapp_opt_in, notify_whatsapp,
       city, neighborhood, address, additional_info,
       document_type, document_number, payment_method, bre_key,
       subtotal, shipping, total, prices_verified
     ) VALUES (?1,?2,'nuevo',?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21)`,
  ).bind(
    orderId,
    now.toISOString(),
    request.idempotencyKey,
    contact.name,
    contact.surname,
    contact.email,
    contact.phone,
    contact.whatsappOptIn ? 1 : 0,
    payment.notifyByWhatsApp ? 1 : 0,
    delivery.city,
    delivery.neighborhood,
    delivery.address,
    delivery.additionalInfo ?? null,
    payment.documentType,
    payment.documentNumber,
    payment.method,
    payment.method === "bre_b" ? payment.breKey : null,
    priced.totals.subtotal,
    priced.totals.shipping,
    priced.totals.total,
    pricesVerified ? 1 : 0,
  );

  const insertItems = priced.lines.map((line) =>
    env.DB.prepare(
      `INSERT INTO order_items (order_id, product_id, name, brand, grinding, size, unit_price, quantity)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`,
    ).bind(
      orderId,
      line.productId,
      line.name ?? line.productId,
      line.brand,
      line.grinding,
      line.size,
      line.unitPrice,
      line.quantity,
    ),
  );

  // Un solo batch: el pedido y sus líneas entran juntos o no entra ninguno.
  await env.DB.batch([insertOrder, ...insertItems]);
};

/** Deja rastro de si el correo al cliente salió, para que el panel lo muestre. */
export const recordEmailStatus = (env: Env, orderId: string, status: string) =>
  env.DB.prepare("UPDATE orders SET email_status = ?2 WHERE id = ?1")
    .bind(orderId, status.slice(0, 200))
    .run();

export const findByIdempotencyKey = (env: Env, key: string) =>
  env.DB.prepare(
    "SELECT id, total, prices_verified FROM orders WHERE idempotency_key = ?1",
  )
    .bind(key)
    .first<{ id: string; total: number; prices_verified: number }>();
