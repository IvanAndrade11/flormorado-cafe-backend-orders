import { Hono } from "hono";

import { getCustomerDetail, listCustomers } from "@/services/customers";
import type { Env } from "@/types/env";

export const adminCustomers = new Hono<{ Bindings: Env }>();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

adminCustomers.get("/", async (c) => {
  const limit = Math.min(
    Number(c.req.query("limit")) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const offset = Math.max(Number(c.req.query("offset")) || 0, 0);
  const q = c.req.query("q")?.trim() || undefined;

  const { customers, total } = await listCustomers(c.env, {
    limit,
    offset,
    q,
  });

  return c.json({ clientes: customers, total });
});

adminCustomers.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "id_invalido" }, 400);

  const detail = await getCustomerDetail(c.env, id);
  if (!detail) return c.json({ error: "cliente_no_encontrado" }, 404);

  return c.json({ cliente: detail.customer, historial: detail.history });
});
