import { afterEach, describe, expect, it, vi } from "vitest";

import { app } from "@/index";
import type { Env } from "@/types/env";

const env = {
  ALLOWED_ORIGINS: "https://flormoradocafe.com",
  RESEND_API_KEY: "re_test",
  ORDERS_EMAIL_FROM: "info@flormoradocafe.com",
  ORDERS_EMAIL_TO: "negocio@flormoradocafe.com",
} as unknown as Env;

const valid = {
  name: "María",
  email: "maria@example.com",
  subject: "producto",
  message: "Quisiera saber si tienen café descafeinado disponible.",
};

const post = (body: unknown) =>
  app.request(
    "/contact",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /contact", () => {
  it("envía el correo al negocio y responde 201 cuando Resend confirma", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "email_123" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const res = await post(valid);

    expect(res.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.to).toEqual(["negocio@flormoradocafe.com"]);
    expect(sent.reply_to).toBe("maria@example.com");
  });

  it("responde 400 con el detalle de campos cuando los datos son inválidos", async () => {
    const res = await post({ ...valid, email: "no-es-un-correo" });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { campos: { campo: string }[] };
    expect(body.campos.some((c) => c.campo === "email")).toBe(true);
  });

  it("responde 400 con json inválido", async () => {
    const res = await app.request(
      "/contact",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      },
      env,
    );

    expect(res.status).toBe(400);
  });

  // No hay dónde más quede el mensaje: si Resend falla hay que decirle al
  // frontend que reintente en vez de responder como si se hubiera enviado.
  it("responde 502 cuando Resend falla, para que el frontend reintente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 500 })),
    );

    const res = await post(valid);

    expect(res.status).toBe(502);
  });
});
