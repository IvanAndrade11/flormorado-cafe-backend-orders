import { Hono } from "hono";
import { cors } from "hono/cors";

import { health, orders, whatsapp } from "@/routes";
import { sendPendingDigest } from "@/services/digest";
import type { Env } from "@/types/env";

export const app = new Hono<{ Bindings: Env }>();

// Solo la tienda puede llamar al endpoint desde un navegador. `/health` queda
// abierto a propósito: no expone datos y sirve para verificar el servicio desde
// cualquier parte.
app.use(
  "/orders/*",
  cors({
    origin: (origin, c) => {
      // El middleware de Hono entrega un Context genérico, así que `c.env` no
      // viene tipado con nuestro Env y hay que afirmarlo.
      const configured = (c.env as Env).ALLOWED_ORIGINS ?? "";
      const allowed = configured
        .split(",")
        .map((value: string) => value.trim())
        .filter(Boolean);
      return allowed.includes(origin) ? origin : null;
    },
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  }),
);

app.route("/health", health);
app.route("/orders", orders);
app.route("/webhooks/whatsapp", whatsapp);

export default {
  fetch: app.fetch,

  // Cron `0 13-23,0-1 * * *` (UTC) = cada hora de 8am a 8pm en Colombia.
  // Manda un resumen solo si hay pedidos que el negocio no ha visto.
  scheduled: async (
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) => {
    ctx.waitUntil(sendPendingDigest(env));
  },
} satisfies ExportedHandler<Env>;
