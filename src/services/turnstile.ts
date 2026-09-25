import type { Env } from "@/types/env";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Errores de Cloudflare que no dependen de lo que hizo el visitante sino de
// cómo está configurado el servicio o de una falla de su lado. Rechazar por
// ellos dejaría sin poder comprar a todo el mundo.
const SERVICE_ERRORS = new Set([
  "missing-input-secret",
  "invalid-input-secret",
  "internal-error",
  "bad-request",
]);

export type TurnstileResult =
  { ok: true } | { ok: false; reason: "falta_token" | "rechazado" };

interface SiteverifyResponse {
  success: boolean;
  action?: string;
  "error-codes"?: string[];
}

export interface VerifyArgs {
  /** Token que generó el widget en el navegador, o `undefined` si no llegó. */
  token: string | undefined;
  ip: string | undefined;
  /**
   * Un token solo se valida una vez, pero el frontend reintenta con el mismo
   * cuando la red falla. Con la misma llave de idempotencia, Cloudflare
   * devuelve el resultado original en vez de "token ya usado".
   */
  idempotencyKey: string;
  /** Debe coincidir con el `action` del widget: un token del checkout no sirve en contacto. */
  action: "checkout" | "contact";
}

/**
 * Verifica el token de Turnstile contra Cloudflare.
 *
 * Solo se exige cuando `TURNSTILE_SECRET_KEY` existe. Así el backend puede
 * desplegarse antes que el frontend (se publican por separado) sin rechazar
 * los pedidos de la tienda que todavía no manda token.
 *
 * Falla abierto si Cloudflare no responde o el problema es de configuración:
 * el límite de tasa sigue protegiendo, y perder una venta es peor que dejar
 * pasar tráfico sin verificar durante una caída. Un token ausente, vencido,
 * reutilizado o inválido sí se rechaza.
 */
export const verifyTurnstile = async (
  env: Env,
  args: VerifyArgs,
): Promise<TurnstileResult> => {
  if (!env.TURNSTILE_SECRET_KEY) return { ok: true };

  if (!args.token) return { ok: false, reason: "falta_token" };

  try {
    const response = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: args.token,
        idempotency_key: args.idempotencyKey,
        ...(args.ip ? { remoteip: args.ip } : {}),
      }),
    });

    if (!response.ok) {
      console.error("turnstile_no_disponible", { status: response.status });
      return { ok: true };
    }

    const body = (await response.json()) as SiteverifyResponse;
    const errors = body["error-codes"] ?? [];

    if (!body.success) {
      if (errors.some((code) => SERVICE_ERRORS.has(code))) {
        console.error("turnstile_mal_configurado", { errors });
        return { ok: true };
      }
      return { ok: false, reason: "rechazado" };
    }

    if (body.action && body.action !== args.action) {
      return { ok: false, reason: "rechazado" };
    }

    return { ok: true };
  } catch (error) {
    console.error("turnstile_no_disponible", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: true };
  }
};
