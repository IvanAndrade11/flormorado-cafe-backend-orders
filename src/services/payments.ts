import type { Env } from "@/types/env";

export interface BreBInstructions {
  llave: string;
  titular: string;
}

/**
 * A dónde transferir, para los pedidos que se pagan por BRE-B. La página de
 * confirmación y el correo lo toman de aquí, así nunca muestran datos
 * distintos.
 */
export const breBInstructions = (
  env: Pick<Env, "BREB_KEY" | "BREB_HOLDER">,
  paymentMethod: string,
): BreBInstructions | undefined =>
  paymentMethod === "bre_b"
    ? { llave: env.BREB_KEY, titular: env.BREB_HOLDER }
    : undefined;
