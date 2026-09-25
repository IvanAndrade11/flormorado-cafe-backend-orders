import type { Context, MiddlewareHandler } from "hono";

import type { Env } from "@/types/env";

type Limiter = RateLimit | undefined;

/** IP del visitante según Cloudflare. Sin ella (p. ej. `wrangler dev`) no hay a quién limitar. */
export const clientIp = (c: Context): string | undefined =>
  c.req.header("CF-Connecting-IP") ?? undefined;

/**
 * Consume un cupo del limitador. Devuelve `false` solo cuando el limitador
 * responde explícitamente que se excedió.
 *
 * Falla abierto a propósito: el binding es "permisivo y eventualmente
 * consistente" según Cloudflare, así que es una capa contra el abuso y no un
 * control de acceso. Si falta el binding o el servicio de límites falla, perder
 * una venta es peor que dejar pasar tráfico sin contar.
 */
export const withinLimit = async (
  limiter: Limiter,
  key: string | undefined,
): Promise<boolean> => {
  if (!limiter || !key) return true;

  try {
    const { success } = await limiter.limit({ key });
    return success;
  } catch (error) {
    console.error("rate_limit_no_disponible", {
      message: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
};

export const tooManyRequests = (c: Context) => {
  c.header("Retry-After", "60");
  return c.json({ error: "demasiadas_peticiones" }, 429);
};

/**
 * Limita las peticiones por IP con uno de los limitadores de `wrangler.toml`.
 * Se monta antes de leer el cuerpo o tocar D1, para que una ráfaga de
 * peticiones rechazadas no cueste nada.
 */
export const rateLimitByIp =
  (
    pick: (env: Env) => Limiter,
    scope: string,
  ): MiddlewareHandler<{ Bindings: Env }> =>
  async (c, next) => {
    const ip = clientIp(c);
    const allowed = await withinLimit(
      pick(c.env),
      ip ? `${scope}:${ip}` : undefined,
    );

    if (!allowed) return tooManyRequests(c);

    await next();
  };
