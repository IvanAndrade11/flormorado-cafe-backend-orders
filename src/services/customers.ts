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
  created_at: string;
  updated_at: string;
  pedidos: number;
  total_comprado: number;
}

export interface ListCustomersArgs {
  limit: number;
  offset: number;
  q?: string;
}

// `q` busca por lo que se usa para ubicar a un cliente: nombre completo,
// celular, correo o documento.
const CUSTOMER_FILTERS = `(?1 IS NULL
    OR customers.phone LIKE ?1
    OR customers.email LIKE ?1
    OR customers.document_number LIKE ?1
    OR (customers.name || ' ' || customers.surname) LIKE ?1)`;

// `pedidos` y `total_comprado` se calculan aquí, nunca se guardan en
// `customers` — la misma regla que ya sigue `persistOrder`.
export const listCustomers = async (
  env: Env,
  args: ListCustomersArgs,
): Promise<{ customers: CustomerListItem[]; total: number }> => {
  const q = args.q ? `%${args.q}%` : null;

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
       LIMIT ?2 OFFSET ?3`,
    )
      .bind(q, args.limit, args.offset)
      .all<CustomerListItem>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM customers WHERE ${CUSTOMER_FILTERS}`,
    )
      .bind(q)
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
}

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
    `SELECT id, created_at, status, payment_method, total
     FROM orders
     WHERE customer_id = ?1
     ORDER BY created_at DESC`,
  )
    .bind(id)
    .all<CustomerOrderRow>();

  return { customer, history: history.results };
};
