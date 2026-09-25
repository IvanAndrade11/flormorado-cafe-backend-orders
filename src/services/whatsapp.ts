import { safeEqual } from "@/utils/security";

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

// Meta firma cada POST del webhook con HMAC-SHA256 usando el secreto de la
// app como llave (encabezado X-Hub-Signature-256). Sin verificar esto,
// cualquiera que adivine la URL pública podría mandar eventos falsos.
export const verifyWebhookSignature = async (
  appSecret: string,
  rawBody: string,
  signatureHeader: string | undefined | null,
): Promise<boolean> => {
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expected = toHex(mac);

  return safeEqual(expected, signatureHeader.slice("sha256=".length));
};
