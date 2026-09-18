import type { Env } from "@/types/env";

export interface CustomerListItem {
  id: number;
  phone: string;
  name: string;
  surname: string;
  email: string;
  city: string;
  whatsapp_marketing: number;
  marketing_updated_at: string;
  created_at: string;
  updated_at: string;
  pedidos: number;
  total_comprado: number;
}

// `pedidos` y `total_comprado` se calculan aquí, nunca se guardan en
// `customers` — la misma regla que ya sigue `persistOrder`.
export const listCustomers = async (env: Env): Promise<CustomerListItem[]> => {
  const rows = await env.DB.prepare(
    `SELECT customers.*,
            COUNT(orders.id) AS pedidos,
            COALESCE(SUM(orders.total), 0) AS total_comprado
     FROM customers
     LEFT JOIN orders ON orders.customer_id = customers.id
     GROUP BY customers.id
     ORDER BY customers.updated_at DESC`,
  ).all<CustomerListItem>();

  return rows.results;
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
