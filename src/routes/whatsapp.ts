import { Hono } from "hono";

import { verifyWebhookSignature } from "@/services/whatsapp";
import type { Env } from "@/types/env";

export const whatsapp = new Hono<{ Bindings: Env }>();

// Meta llama a este GET cada vez que guardas o editas la URL de devolución de
// llamada o el verify token en el panel de la app. Si no respondemos el
// hub.challenge tal cual lo mandó, Meta nunca marca el webhook como
// verificado y no deja avanzar el registro del número.
whatsapp.get("/", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (
    mode === "subscribe" &&
    !!challenge &&
    token === c.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return c.text(challenge, 200);
  }

  return c.text("token_invalido", 403);
});

// Si un POST falla, Meta reintenta con frecuencia decreciente durante 7 días,
// así que por ahora basta con reconocer la entrega una vez validada la firma.
// Procesar el contenido (estados de entrega, respuestas de clientes) es
// trabajo de cuando se integre el envío en la fase 7.
whatsapp.post("/", async (c) => {
  const body = await c.req.text();
  const signature = c.req.header("x-hub-signature-256");
  const valid = await verifyWebhookSignature(
    c.env.WHATSAPP_APP_SECRET,
    body,
    signature,
  );

  if (!valid) return c.text("firma_invalida", 403);

  return c.text("ok", 200);
});
