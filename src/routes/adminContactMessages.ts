import { Hono } from "hono";

import { contactMessageStatusUpdateSchema } from "@/schemas/admin";
import {
  listContactMessages,
  updateContactMessageStatus,
} from "@/services/contactMessages";
import type { Env } from "@/types/env";

export const adminContactMessages = new Hono<{ Bindings: Env }>();

adminContactMessages.get("/", async (c) => {
  const messages = await listContactMessages(c.env);
  return c.json({ mensajes: messages });
});

adminContactMessages.patch("/:id/status", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "id_invalido" }, 400);

  const body = await c.req.json().catch(() => null);
  const parsed = contactMessageStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "datos_invalidos" }, 400);
  }

  const updated = await updateContactMessageStatus(
    c.env,
    id,
    parsed.data.status,
  );
  if (!updated) return c.json({ error: "mensaje_no_encontrado" }, 404);

  return c.json({ ok: true });
});
