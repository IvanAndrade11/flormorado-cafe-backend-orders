import { Hono } from "hono";

import { orderStatusUpdateSchema } from "@/schemas/admin";
import {
  getOrderDetail,
  listOrders,
  updateOrderStatus,
} from "@/services/orders";
import type { Env } from "@/types/env";

export const adminOrders = new Hono<{ Bindings: Env }>();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

adminOrders.get("/", async (c) => {
  const limit = Math.min(
    Number(c.req.query("limit")) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const offset = Math.max(Number(c.req.query("offset")) || 0, 0);
  const q = c.req.query("q")?.trim() || undefined;
  const status = c.req.query("status")?.trim() || undefined;

  const { orders, total } = await listOrders(c.env, {
    limit,
    offset,
    q,
    status,
  });

  return c.json({ pedidos: orders, total });
});

adminOrders.get("/:id", async (c) => {
  const detail = await getOrderDetail(c.env, c.req.param("id"));
  if (!detail) return c.json({ error: "pedido_no_encontrado" }, 404);

  return c.json(detail);
});

adminOrders.patch("/:id/status", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = orderStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "datos_invalidos" }, 400);
  }

  const result = await updateOrderStatus(
    c.env,
    c.req.param("id"),
    parsed.data.status,
    new Date(),
  );

  if ("code" in result) {
    const httpStatus = result.code === "pedido_no_encontrado" ? 404 : 409;
    return c.json(
      {
        error: result.code,
        ...("permitidos" in result ? { permitidos: result.permitidos } : {}),
      },
      httpStatus,
    );
  }

  return c.json({ ok: true });
});
