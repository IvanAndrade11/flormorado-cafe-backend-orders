import { describe, expect, it } from "vitest";

import { verifyWebhookSignature } from "./whatsapp";

const appSecret = "shhh-secreto-de-prueba";

const sign = async (body: string, secret = appSecret) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
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

describe("verifyWebhookSignature", () => {
  it("acepta una firma calculada con el secreto correcto", async () => {
    const body = '{"entry":[]}';
    const signature = await sign(body);

    await expect(
      verifyWebhookSignature(appSecret, body, signature),
    ).resolves.toBe(true);
  });

  it("rechaza una firma calculada con otro secreto", async () => {
    const body = '{"entry":[]}';
    const signature = await sign(body, "otro-secreto");

    await expect(
      verifyWebhookSignature(appSecret, body, signature),
    ).resolves.toBe(false);
  });

  it("rechaza cuando el cuerpo fue alterado después de firmarlo", async () => {
    const signature = await sign('{"entry":[]}');

    await expect(
      verifyWebhookSignature(appSecret, '{"entry":["manipulado"]}', signature),
    ).resolves.toBe(false);
  });

  it("rechaza cuando falta el encabezado de firma", async () => {
    await expect(
      verifyWebhookSignature(appSecret, "{}", undefined),
    ).resolves.toBe(false);
  });

  it("rechaza un encabezado sin el prefijo sha256=", async () => {
    await expect(
      verifyWebhookSignature(appSecret, "{}", "abc123"),
    ).resolves.toBe(false);
  });
});
