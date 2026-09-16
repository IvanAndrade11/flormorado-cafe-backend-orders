import { sendEmail } from "@/services/resend";
import {
  digestHtml,
  digestSubject,
  type DigestOrder,
} from "@/templates/ordersDigest";
import type { Env } from "@/types/env";
import type { CITY_LABELS, PAYMENT_LABELS } from "@/utils/constants";

interface OrderRow {
  id: string;
  created_at: string;
  customer_name: string;
  customer_surname: string;
  phone: string;
  city: keyof typeof CITY_LABELS;
  neighborhood: string;
  address: string;
  additional_info: string | null;
  payment_method: keyof typeof PAYMENT_LABELS;
  bre_key: string | null;
  total: number;
  prices_verified: number;
}

interface ItemRow {
  order_id: string;
  name: string;
  grinding: string | null;
  quantity: number;
}

export type DigestOutcome =
  | { sent: false; reason: "sin_pedidos" }
  | { sent: false; reason: "fallo_envio"; error: string }
  | { sent: true; orders: number };

/**
 * Manda un solo correo con los pedidos que el negocio todavía no ha visto y los
 * marca como reportados. Si no hay pedidos nuevos no envía nada: en un día sin
 * ventas la bandeja queda tranquila.
 */
export const sendPendingDigest = async (env: Env): Promise<DigestOutcome> => {
  const { results: orders } = await env.DB.prepare(
    `SELECT id, created_at, customer_name, customer_surname, phone, city,
            neighborhood, address, additional_info, payment_method, bre_key,
            total, prices_verified
       FROM orders
      WHERE digest_sent = 0
      ORDER BY created_at ASC`,
  ).all<OrderRow>();

  if (orders.length === 0) return { sent: false, reason: "sin_pedidos" };

  const placeholders = orders.map((_, i) => `?${i + 1}`).join(",");
  const { results: items } = await env.DB.prepare(
    `SELECT order_id, name, grinding, quantity
       FROM order_items
      WHERE order_id IN (${placeholders})
      ORDER BY id ASC`,
  )
    .bind(...orders.map((o) => o.id))
    .all<ItemRow>();

  const payload: DigestOrder[] = orders.map((order) => ({
    id: order.id,
    createdAt: order.created_at,
    customer: `${order.customer_name} ${order.customer_surname}`,
    phone: order.phone,
    city: order.city,
    neighborhood: order.neighborhood,
    address: order.address,
    additionalInfo: order.additional_info,
    paymentMethod: order.payment_method,
    breKey: order.bre_key,
    total: order.total,
    pricesVerified: order.prices_verified === 1,
    items: items
      .filter((item) => item.order_id === order.id)
      .map((item) => ({
        name: item.name,
        grinding: item.grinding ?? "sin especificar",
        quantity: item.quantity,
      })),
  }));

  const result = await sendEmail({
    apiKey: env.RESEND_API_KEY,
    from: env.ORDERS_EMAIL_FROM,
    to: env.ORDERS_EMAIL_TO,
    subject: digestSubject(payload.length),
    html: digestHtml(payload),
  });

  if (!result.ok)
    return { sent: false, reason: "fallo_envio", error: result.error };

  // Solo se marcan después de que el correo salió: si el envío falla, estos
  // pedidos entran en el resumen de la próxima hora en vez de perderse.
  await env.DB.prepare(
    `UPDATE orders SET digest_sent = 1 WHERE id IN (${placeholders})`,
  )
    .bind(...orders.map((o) => o.id))
    .run();

  return { sent: true, orders: payload.length };
};
