import { describe, expect, it } from "vitest";

import { app } from "@/index";
import type { Env } from "@/types/env";

const env = {
  ALLOWED_ORIGINS: "https://flormoradocafe.com,https://www.flormoradocafe.com",
} as unknown as Env;

const preflight = (path: string, origin: string) =>
  app.request(
    path,
    {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
      },
    },
    env,
  );

describe.each(["/orders", "/contact"])("CORS en %s", (path) => {
  it("autoriza el origen de la tienda", async () => {
    const res = await preflight(path, "https://flormoradocafe.com");

    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://flormoradocafe.com",
    );
  });

  it("autoriza también el subdominio www", async () => {
    const res = await preflight(path, "https://www.flormoradocafe.com");

    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://www.flormoradocafe.com",
    );
  });

  it("no autoriza un origen ajeno", async () => {
    const res = await preflight(path, "https://sitio-ajeno.example");

    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

// Sin esto no se puede verificar el servicio desde fuera de la red del
// negocio, que es justamente cómo se comprueba que está arriba.
describe("GET /health", () => {
  it("queda abierto a cualquier origen", async () => {
    const res = await app.request("/health", {}, env);

    expect(res.status).toBe(200);
  });
});
