import { Hono } from "hono";

import { contactRequestSchema } from "@/schemas/contact";
import {
  findRecentDuplicate,
  persistContactMessage,
  recordContactMessageEmailStatus,
} from "@/services/contactMessages";
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
  const now = new Date();

  // Se guarda antes de notificar, igual que un pedido (FMC-0020): así el
  // panel puede mostrar el mensaje y hacerle seguimiento aunque Resend falle.
  // El frontend reintenta un 502, así que un reintento reutiliza el mensaje
  // reciente con el mismo correo y texto en vez de duplicarlo.
  const duplicate = await findRecentDuplicate(c.env, request, now);
  const id = duplicate
    ? duplicate.id
    : await persistContactMessage(c.env, request, now);

  const sent = await sendEmail({
    apiKey: c.env.RESEND_API_KEY,
    from: c.env.ORDERS_EMAIL_FROM,
    to: c.env.ORDERS_EMAIL_TO,
    replyTo: request.email,
    subject: contactNotificationSubject(request.subject),
    html: contactNotificationHtml(request),
  });

  await recordContactMessageEmailStatus(
    c.env,
    id,
    sent.ok ? "enviado" : `fallo: ${sent.error}`,
  );

  if (!sent.ok) {
    // El mensaje ya quedó guardado, pero seguimos devolviendo un error para
    // que el frontend reintente: si Resend está caído, el negocio no debería
    // depender solo de mirar el panel para enterarse del contacto.
    return c.json({ error: "no_se_pudo_enviar" }, 502);
  }

  return c.json({ enviado: true }, 201);
});
