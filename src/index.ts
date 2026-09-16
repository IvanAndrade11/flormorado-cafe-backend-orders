import { Hono } from "hono";

import { health, orders } from "@/routes";
import { sendPendingDigest } from "@/services/digest";
import type { Env } from "@/types/env";

export const app = new Hono<{ Bindings: Env }>();

app.route("/health", health);
app.route("/orders", orders);

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
