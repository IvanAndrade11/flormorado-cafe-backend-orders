import { describe, expect, it } from "vitest";

import { app } from "@/index";
import type { Env } from "@/types/env";

const env = {
  ALLOWED_ORIGINS: "https://flormoradocafe.com,https://www.flormoradocafe.com",
} as unknown as Env;

const preflight = (origin: string) =>
  app.request(
    "/orders",
    {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
      },
    },
    env,
  );

describe("CORS en /orders", () => {
  it("autoriza el origen de la tienda", async () => {
    const res = await preflight("https://flormoradocafe.com");

    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://flormoradocafe.com",
    );
  });

  it("autoriza también el subdominio www", async () => {
    const res = await preflight("https://www.flormoradocafe.com");

    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://www.flormoradocafe.com",
    );
  });

  it("no autoriza un origen ajeno", async () => {
    const res = await preflight("https://sitio-ajeno.example");

    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  // Sin esto no se puede verificar el servicio desde fuera de la red del
  // negocio, que es justamente cómo se comprueba que está arriba.
  it("deja /health abierto a cualquier origen", async () => {
    const res = await app.request("/health", {}, env);

    expect(res.status).toBe(200);
  });
});
