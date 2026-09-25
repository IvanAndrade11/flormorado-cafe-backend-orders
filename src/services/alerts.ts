import { sendEmail } from "@/services/resend";
import {
  failureAlertHtml,
  failureAlertSubject,
  type FailedContactMessage,
  type FailedOrder,
} from "@/templates/failureAlert";
import type { Env } from "@/types/env";

// Un correo que sigue "pendiente" pasado este tiempo no está en camino: el
// envío corre en `waitUntil` y, si el Worker se cortó antes de terminar, el
// estado nunca se actualizó. Antes de este umbral puede estar enviándose.
const STALE_PENDING_MS = 30 * 60 * 1000;

// Tope por aviso para que un pico de fallos no arme un correo gigante; lo que
// sobre sale en el aviso de la hora siguiente.
const MAX_PER_ALERT = 50;

interface OrderRow {
  id: string;
  created_at: string;
  customer_name: string;
  customer_surname: string;
  phone: string;
  email_status: string;
  whatsapp_status: string;
}

interface ContactRow {
  id: number;
  created_at: string;
  name: string;
  email: string;
  email_status: string;
}

export type AlertOutcome =
  | { sent: false; reason: "sin_fallos" }
  | { sent: false; reason: "fallo_envio"; error: string }
  | { sent: true; orders: number; messages: number };

const describe = (channel: string, status: string) =>
  status === "pendiente"
    ? `${channel}: sin confirmar, el envío no terminó`
    : `${channel}: ${status}`;

/**
 * Avisa al negocio de pedidos y mensajes cuya notificación falló. Cada caso se
 * avisa una sola vez: la bandera `failure_alerted` se marca después de que el
 * aviso salió, así que si el envío falla —lo más probable es que Resend sea la
 * causa— el caso se reintenta a la hora siguiente en vez de perderse.
 */
export const sendFailureAlerts = async (
  env: Env,
  now: Date = new Date(),
): Promise<AlertOutcome> => {
  const staleBefore = new Date(now.getTime() - STALE_PENDING_MS).toISOString();

  const [orders, messages] = await Promise.all([
    env.DB.prepare(
      `SELECT id, created_at, customer_name, customer_surname, phone,
              email_status, whatsapp_status
         FROM orders
        WHERE failure_alerted = 0
          AND (email_status LIKE 'fallo%'
               OR whatsapp_status LIKE 'fallo%'
               OR (email_status = 'pendiente' AND created_at < ?1))
        ORDER BY created_at ASC
        LIMIT ?2`,
    )
      .bind(staleBefore, MAX_PER_ALERT)
      .all<OrderRow>(),
    env.DB.prepare(
      `SELECT id, created_at, name, email, email_status
         FROM contact_messages
        WHERE failure_alerted = 0
          AND (email_status LIKE 'fallo%'
               OR (email_status = 'pendiente' AND created_at < ?1))
        ORDER BY created_at ASC
        LIMIT ?2`,
    )
      .bind(staleBefore, MAX_PER_ALERT)
      .all<ContactRow>(),
  ]);

  if (orders.results.length === 0 && messages.results.length === 0) {
    return { sent: false, reason: "sin_fallos" };
  }

  // La consulta trae el pedido si falló cualquiera de los dos canales; aquí se
  // vuelve a decidir cuál, para no listar como fallido un correo que sigue en
  // camino cuando lo que falló fue el WhatsApp.
  const emailFailed = (order: OrderRow) =>
    order.email_status.startsWith("fallo") ||
    (order.email_status === "pendiente" && order.created_at < staleBefore);

  const failedOrders: FailedOrder[] = orders.results.map((order) => ({
    id: order.id,
    createdAt: order.created_at,
    customer: `${order.customer_name} ${order.customer_surname}`,
    phone: order.phone,
    failures: [
      ...(emailFailed(order)
        ? [describe("Correo al cliente", order.email_status)]
        : []),
      ...(order.whatsapp_status.startsWith("fallo")
        ? [describe("WhatsApp", order.whatsapp_status)]
        : []),
    ],
  }));

  const failedMessages: FailedContactMessage[] = messages.results.map(
    (message) => ({
      id: message.id,
      createdAt: message.created_at,
      name: message.name,
      email: message.email,
      failure: describe("Correo al negocio", message.email_status),
    }),
  );

  const result = await sendEmail({
    apiKey: env.RESEND_API_KEY,
    from: env.ORDERS_EMAIL_FROM,
    to: env.ORDERS_EMAIL_TO,
    subject: failureAlertSubject(failedOrders.length + failedMessages.length),
    html: failureAlertHtml(failedOrders, failedMessages),
  });

  if (!result.ok) {
    console.error("alerta_fallos_no_enviada", { error: result.error });
    return { sent: false, reason: "fallo_envio", error: result.error };
  }

  const statements = [
    ...(failedOrders.length > 0
      ? [
          env.DB.prepare(
            `UPDATE orders SET failure_alerted = 1
              WHERE id IN (${failedOrders.map((_, i) => `?${i + 1}`).join(",")})`,
          ).bind(...failedOrders.map((order) => order.id)),
        ]
      : []),
    ...(failedMessages.length > 0
      ? [
          env.DB.prepare(
            `UPDATE contact_messages SET failure_alerted = 1
              WHERE id IN (${failedMessages.map((_, i) => `?${i + 1}`).join(",")})`,
          ).bind(...failedMessages.map((message) => message.id)),
        ]
      : []),
  ];

  await env.DB.batch(statements);

  return {
    sent: true,
    orders: failedOrders.length,
    messages: failedMessages.length,
  };
};
