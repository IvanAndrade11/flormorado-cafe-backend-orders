import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import { adminAuth } from "@/middleware/adminAuth";
import { rateLimitByIp } from "@/middleware/rateLimit";
import {
  adminContactMessages,
  adminCustomers,
  adminOrders,
  contact,
  health,
  orders,
  whatsapp,
} from "@/routes";
import { sendFailureAlerts } from "@/services/alerts";
import { sendPendingDigest } from "@/services/digest";
import type { Env } from "@/types/env";

export const app = new Hono<{ Bindings: Env }>();

// El middleware de Hono entrega un Context genérico, así que `c.env` no viene
// tipado con nuestro Env y hay que afirmarlo.
const parseAllowedOrigins = (env: Env): string[] =>
  (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value: string) => value.trim())
    .filter(Boolean);

// Solo la tienda puede llamar a estos endpoints desde un navegador. `/health`
// queda abierto a propósito: no expone datos y sirve para verificar el
// servicio desde cualquier parte.
const storeCors = cors({
  origin: (origin, c) => {
    const allowed = parseAllowedOrigins(c.env as Env);
    return allowed.includes(origin) ? origin : null;
  },
  allowMethods: ["POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "X-Turnstile-Token"],
  maxAge: 86400,
});

// El panel vive en el mismo origen que la tienda (una ruta más del SPA), así
// que reutiliza ALLOWED_ORIGINS. A diferencia de storeCors necesita GET y
// PATCH, y el header Authorization para la clave del panel.
const adminCors = cors({
  origin: (origin, c) => {
    const allowed = parseAllowedOrigins(c.env as Env);
    return allowed.includes(origin) ? origin : null;
  },
  allowMethods: ["GET", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
});

// Todo es JSON para una API: estos encabezados solo cierran vías que un
// navegador podría abrir si algún día una respuesta se interpretara como HTML.
app.use("*", secureHeaders());

// Un pedido con 50 líneas ocupa unos pocos KB; este tope corta cuerpos
// gigantes antes de leerlos y parsearlos.
const smallJsonBody = bodyLimit({
  maxSize: 32 * 1024,
  onError: (c) => c.json({ error: "cuerpo_demasiado_grande" }, 413),
});

// Los límites de tasa se montan después de CORS —para que un 429 también lleve
// los encabezados que el navegador necesita para leerlo— y antes de tocar el
// cuerpo o la base de datos.
app.use("/orders/*", storeCors);
app.use(
  "/orders/*",
  rateLimitByIp((env) => env.ORDER_IP_LIMITER, "orders"),
);
app.use("/orders/*", smallJsonBody);

app.use("/contact/*", storeCors);
app.use(
  "/contact/*",
  rateLimitByIp((env) => env.CONTACT_IP_LIMITER, "contact"),
);
app.use("/contact/*", smallJsonBody);

app.use("/admin/*", adminCors);
// Antes de verificar la clave, para que adivinarla a fuerza bruta tenga techo.
app.use(
  "/admin/*",
  rateLimitByIp((env) => env.ADMIN_IP_LIMITER, "admin"),
);
app.use("/admin/*", adminAuth);

app.route("/health", health);
app.route("/orders", orders);
app.route("/contact", contact);
app.route("/webhooks/whatsapp", whatsapp);
app.route("/admin/orders", adminOrders);
app.route("/admin/customers", adminCustomers);
app.route("/admin/contact-messages", adminContactMessages);

// Sin esto, un error no controlado devuelve el texto por defecto de Hono. Se
// registra solo el mensaje —nunca el cuerpo de la petición, que trae datos
// personales— y el cliente recibe un JSON genérico sin detalles internos.
app.onError((error, c) => {
  console.error("error_no_controlado", {
    path: new URL(c.req.url).pathname,
    message: error.message,
  });
  return c.json({ error: "error_interno" }, 500);
});

app.notFound((c) => c.json({ error: "no_encontrado" }, 404));

export default {
  fetch: app.fetch,

  // Cron `0 13-23,0-1 * * *` (UTC) = cada hora de 8am a 8pm en Colombia.
  // Manda un resumen solo si hay pedidos que el negocio no ha visto, y un aviso
  // aparte si alguna notificación falló.
  scheduled: async (
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) => {
    ctx.waitUntil(sendPendingDigest(env));
    ctx.waitUntil(sendFailureAlerts(env));
  },
} satisfies ExportedHandler<Env>;
