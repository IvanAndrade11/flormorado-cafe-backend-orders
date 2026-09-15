import { describe, expect, it } from "vitest";

import app from "@/index";
import { SERVICE_NAME } from "@/utils/constants";

describe("GET /health", () => {
  it("responde ok e identifica el servicio", async () => {
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      status: "ok",
      service: SERVICE_NAME,
    });
  });

  it("responde 404 en una ruta que no existe", async () => {
    const res = await app.request("/ruta-inexistente");

    expect(res.status).toBe(404);
  });
});
