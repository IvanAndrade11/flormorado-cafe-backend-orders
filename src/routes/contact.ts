import { Hono } from "hono";

import { contactRequestSchema } from "@/schemas/contact";
import { sendEmail } from "@/services/resend";
import {
  contactNotificationHtml,
  contactNotificationSubject,
} from "@/templates/contactNotification";
import type { Env } from "@/types/env";

export const contact = new Hono<{ Bindings: Env }>();

contact.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (body === null) {
    return c.json({ error: "json_invalido" }, 400);
  }

  const parsed = contactRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "datos_invalidos",
        campos: parsed.error.issues.map((i) => ({
          campo: i.path.join("."),
          mensaje: i.message,
        })),
      },
      400,
    );
  }

  const request = parsed.data;

  // A diferencia de un pedido, este mensaje no se guarda en ningún lado: el
  // correo es el único registro que queda. Por eso, a diferencia de
  // routes/orders.ts, se espera el resultado de Resend antes de responder —
  // si falla hay que devolver un error para que el frontend reintente, en vez
  // de un 201 que dejaría el mensaje perdido sin que nadie lo note.
  const sent = await sendEmail({
    apiKey: c.env.RESEND_API_KEY,
    from: c.env.ORDERS_EMAIL_FROM,
    to: c.env.ORDERS_EMAIL_TO,
    replyTo: request.email,
    subject: contactNotificationSubject(request.subject),
    html: contactNotificationHtml(request),
  });

  if (!sent.ok) {
    return c.json({ error: "no_se_pudo_enviar" }, 502);
  }

  return c.json({ enviado: true }, 201);
});
