import type { Env } from "@/types/env";

export interface CustomerListItem {
  id: number;
  phone: string;
  name: string;
  surname: string;
  email: string;
  document_type: string;
  document_number: string;
  city: string;
  whatsapp_marketing: number;
  marketing_updated_at: string;
  created_at: string;
  updated_at: string;
  /** Cuándo se atendió una solicitud de supresión. NULL = ficha vigente. */
  suppressed_at: string | null;
  pedidos: number;
  total_comprado: number;
}

export interface ListCustomersArgs {
  limit: number;
  offset: number;
  q?: string;
  /** 1 = solo quienes autorizaron novedades, 0 = solo los que están de baja. */
  marketing?: 0 | 1;
}

// `q` busca por lo que se usa para ubicar a un cliente: nombre completo,
// celular, correo o documento.
const CUSTOMER_FILTERS = `(?1 IS NULL
    OR customers.phone LIKE ?1
    OR customers.email LIKE ?1
    OR customers.document_number LIKE ?1
    OR (customers.name || ' ' || customers.surname) LIKE ?1)
  AND (?2 IS NULL OR customers.whatsapp_marketing = ?2)`;

// `pedidos` y `total_comprado` se calculan aquí, nunca se guardan en
// `customers` — la misma regla que ya sigue `persistOrder`.
export const listCustomers = async (
  env: Env,
  args: ListCustomersArgs,
): Promise<{ customers: CustomerListItem[]; total: number }> => {
  const q = args.q ? `%${args.q}%` : null;
  const marketing = args.marketing ?? null;

  const [rows, countRow] = await Promise.all([
    env.DB.prepare(
      `SELECT customers.*,
              COUNT(orders.id) AS pedidos,
              COALESCE(SUM(orders.total), 0) AS total_comprado
       FROM customers
       LEFT JOIN orders ON orders.customer_id = customers.id
       WHERE ${CUSTOMER_FILTERS}
       GROUP BY customers.id
       ORDER BY customers.updated_at DESC
       LIMIT ?3 OFFSET ?4`,
    )
      .bind(q, marketing, args.limit, args.offset)
      .all<CustomerListItem>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM customers WHERE ${CUSTOMER_FILTERS}`,
    )
      .bind(q, marketing)
      .first<{ n: number }>(),
  ]);

  return { customers: rows.results, total: countRow?.n ?? 0 };
};

export interface CustomerOrderRow {
  id: string;
  created_at: string;
  status: string;
  payment_method: string;
  total: number;
  whatsapp_opt_in: number;
  marketing_consent_version: string | null;
  privacy_policy_version: string | null;
  terms_version: string | null;
}

/**
 * El historial trae, por cada pedido, lo que el cliente respondió en la casilla
 * de novedades y qué versión del texto vio: esa es la prueba del consentimiento
 * bajo la Ley 1581, que vive en `orders` y no en `customers`.
 */
export const getCustomerDetail = async (env: Env, id: number) => {
  const customer = await env.DB.prepare(
    `SELECT customers.*,
            COUNT(orders.id) AS pedidos,
            COALESCE(SUM(orders.total), 0) AS total_comprado
     FROM customers
     LEFT JOIN orders ON orders.customer_id = customers.id
     WHERE customers.id = ?1
     GROUP BY customers.id`,
  )
    .bind(id)
    .first<CustomerListItem>();

  if (!customer) return null;

  const history = await env.DB.prepare(
    `SELECT id, created_at, status, payment_method, total,
            whatsapp_opt_in, marketing_consent_version, privacy_policy_version,
            terms_version
     FROM orders
     WHERE customer_id = ?1
     ORDER BY created_at DESC`,
  )
    .bind(id)
    .all<CustomerOrderRow>();

  return { customer, history: history.results };
};

/** Lo que queda en una ficha suprimida: no es un dato, es la marca de que ahí hubo uno. */
const SUPRIMIDO = "(suprimido)";

export type SuppressOutcome =
  | { code: "cliente_no_encontrado" }
  | { code: "ya_suprimido" }
  | { code: "suprimido"; mensajesBorrados: number };

/**
 * Supresión del artículo 8 de la Ley 1581. No borra todo, y eso es deliberado:
 * los pedidos son soporte contable y la ley permite negar la supresión cuando
 * hay un deber legal de conservar. Se anonimiza la ficha, se borran los
 * mensajes de contacto —donde no existe ese deber— y queda la constancia de
 * que la solicitud se atendió. Ver `migrations/0009`.
 */
export const suppressCustomer = async (
  env: Env,
  id: number,
  now: Date,
): Promise<SuppressOutcome> => {
  const customer = await env.DB.prepare(
    "SELECT id, email, suppressed_at FROM customers WHERE id = ?1",
  )
    .bind(id)
    .first<{ id: number; email: string; suppressed_at: string | null }>();

  if (!customer) return { code: "cliente_no_encontrado" };
  // Repetir la supresión no debe volver a escribir: `suppressed_at` es la fecha
  // en que se atendió la solicitud, no la del último clic en el botón.
  if (customer.suppressed_at) return { code: "ya_suprimido" };

  const timestamp = now.toISOString();
  const [, mensajes] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE customers
          SET name = ?2, surname = ?2, email = ?2,
              document_type = ?2, document_number = ?2, city = ?2,
              phone = ?3,
              whatsapp_marketing = 0,
              marketing_updated_at = CASE
                WHEN whatsapp_marketing = 1 THEN ?4
                ELSE marketing_updated_at
              END,
              suppressed_at = ?4,
              updated_at = ?4
        WHERE id = ?1`,
    ).bind(id, SUPRIMIDO, `suprimido-${id}`, timestamp),
    env.DB.prepare("DELETE FROM contact_messages WHERE email = ?1").bind(
      customer.email,
    ),
  ]);

  return { code: "suprimido", mensajesBorrados: mensajes.meta.changes };
};

/** Revocación exigida por la Ley 1581: en cualquier momento, no solo en el próximo pedido. */
export const optOutCustomer = async (
  env: Env,
  id: number,
  now: Date,
): Promise<boolean> => {
  const result = await env.DB.prepare(
    `UPDATE customers
     SET whatsapp_marketing = 0, marketing_updated_at = ?2, updated_at = ?2
     WHERE id = ?1`,
  )
    .bind(id, now.toISOString())
    .run();

  return result.meta.changes > 0;
};
