import type { MiddlewareHandler } from "hono";

import type { Env } from "@/types/env";

// Comparación en tiempo constante: con `===` el tiempo de respuesta depende de
// cuántos caracteres coinciden antes del primer error, lo que en teoría deja
// adivinar la clave carácter por carácter midiendo la latencia.
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
};

// Protege /admin/*. Un solo usuario (el negocio), así que la clave misma es
// el token: sin login, sin sesiones, sin expiración. `ADMIN_PASSWORD` nunca
// viaja al frontend — vive solo en el almacén de secretos de Cloudflare.
export const adminAuth: MiddlewareHandler<{ Bindings: Env }> = async (
  c,
  next,
) => {
  const header = c.req.header("Authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (
    scheme !== "Bearer" ||
    !token ||
    !timingSafeEqual(token, c.env.ADMIN_PASSWORD)
  ) {
    return c.json({ error: "no_autorizado" }, 401);
  }

  await next();
};
