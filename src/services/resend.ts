const API = "https://api.resend.com/emails";

export interface SendArgs {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export type SendResult =
  { ok: true; id: string } | { ok: false; error: string };

/**
 * Envía un correo por la API HTTP de Resend.
 *
 * Nunca lanza: un fallo de correo no puede tumbar un pedido que ya está
 * guardado. Devuelve el resultado para que quien llama lo registre y el panel
 * pueda mostrar qué salió y qué no.
 */
export const sendEmail = async (args: SendArgs): Promise<SendResult> => {
  try {
    const response = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: args.from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        error: `resend ${response.status}: ${detail.slice(0, 200)}`,
      };
    }

    const body = (await response.json()) as { id?: string };
    return { ok: true, id: body.id ?? "" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "fallo de red",
    };
  }
};
