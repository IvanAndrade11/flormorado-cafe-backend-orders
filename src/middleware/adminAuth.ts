import type { MiddlewareHandler } from "hono";

import type { Env } from "@/types/env";
import { safeEqual } from "@/utils/security";

// Protege /admin/*. Un solo usuario (el negocio), así que la clave misma es
// el token: sin login, sin sesiones, sin expiración. `ADMIN_PASSWORD` nunca
// viaja al frontend — vive solo en el almacén de secretos de Cloudflare.
export const adminAuth: MiddlewareHandler<{ Bindings: Env }> = async (
  c,
  next,
) => {
  // Estas respuestas llevan datos personales de los clientes: que ningún
  // navegador ni proxy intermedio las guarde.
  c.header("Cache-Control", "no-store");

  const header = c.req.header("Authorization") ?? "";
  const [scheme, token] = header.split(" ");

  // Sin clave configurada no hay contra qué comparar: se rechaza todo en vez
  // de dejar que una cadena vacía coincida con una clave vacía.
  if (
    !c.env.ADMIN_PASSWORD ||
    scheme !== "Bearer" ||
    !token ||
    !(await safeEqual(token, c.env.ADMIN_PASSWORD))
  ) {
    return c.json({ error: "no_autorizado" }, 401);
  }

  await next();
};
