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
            whatsapp_opt_in, marketing_consent_version
     FROM orders
     WHERE customer_id = ?1
     ORDER BY created_at DESC`,
  )
    .bind(id)
    .all<CustomerOrderRow>();

  return { customer, history: history.results };
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
