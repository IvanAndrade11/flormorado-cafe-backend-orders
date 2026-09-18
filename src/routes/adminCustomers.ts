import { Hono } from "hono";

import { listCustomers, optOutCustomer } from "@/services/customers";
import type { Env } from "@/types/env";

export const adminCustomers = new Hono<{ Bindings: Env }>();

adminCustomers.get("/", async (c) => {
  const customers = await listCustomers(c.env);
  return c.json({ clientes: customers });
});

adminCustomers.patch("/:id/opt-out", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "id_invalido" }, 400);

  const updated = await optOutCustomer(c.env, id, new Date());
  if (!updated) return c.json({ error: "cliente_no_encontrado" }, 404);

  return c.json({ ok: true });
});
