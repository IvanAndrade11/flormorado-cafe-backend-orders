import { describe, expect, it } from "vitest";

import { app } from "@/index";
import type { Env } from "@/types/env";

const env = {
  ALLOWED_ORIGINS: "https://flormoradocafe.com",
  WHATSAPP_VERIFY_TOKEN: "el-token-secreto",
  WHATSAPP_APP_SECRET: "el-app-secret",
} as unknown as Env;

const sign = async (body: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.WHATSAPP_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  const hex = [...new Uint8Array(mac)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `sha256=${hex}`;
};

describe("GET /webhooks/whatsapp", () => {
  it("responde el hub.challenge cuando el modo y el token son correctos", async () => {
    const res = await app.request(
      "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=el-token-secreto&hub.challenge=1158201444",
      {},
      env,
    );

    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe("1158201444");
  });

  it("rechaza un verify token incorrecto", async () => {
    const res = await app.request(
      "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1158201444",
      {},
      env,
    );

    expect(res.status).toBe(403);
  });

  it("rechaza cuando falta hub.mode", async () => {
    const res = await app.request(
      "/webhooks/whatsapp?hub.verify_token=el-token-secreto&hub.challenge=1158201444",
      {},
      env,
    );

    expect(res.status).toBe(403);
  });
});

describe("POST /webhooks/whatsapp", () => {
  it("acepta un evento con firma válida", async () => {
    const body = JSON.stringify({ entry: [] });
    const signature = await sign(body);

    const res = await app.request(
      "/webhooks/whatsapp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": signature,
        },
        body,
      },
      env,
    );

    expect(res.status).toBe(200);
  });

  it("rechaza un evento sin firma", async () => {
    const res = await app.request(
      "/webhooks/whatsapp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry: [] }),
      },
      env,
    );

    expect(res.status).toBe(403);
  });

  it("rechaza un evento con firma inválida", async () => {
    const res = await app.request(
      "/webhooks/whatsapp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": "sha256=deadbeef",
        },
        body: JSON.stringify({ entry: [] }),
      },
      env,
    );

    expect(res.status).toBe(403);
  });
});
