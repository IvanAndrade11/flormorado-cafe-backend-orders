const encoder = new TextEncoder();

/**
 * Comparación en tiempo constante de dos cadenas cualesquiera.
 *
 * Comparar con `===` deja deducir el secreto carácter por carácter midiendo
 * cuánto tarda cada intento. Un `if (a.length !== b.length) return false` previo
 * arregla eso pero filtra el largo del secreto; por eso ambas cadenas se
 * reducen primero a un SHA-256 (siempre 32 bytes) y se comparan esos resúmenes.
 */
export const safeEqual = async (a: string, b: string): Promise<boolean> => {
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);

  const bytesA = new Uint8Array(digestA);
  const bytesB = new Uint8Array(digestB);

  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }

  return diff === 0;
};

const toHex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

/**
 * Deriva un UUID determinista (con forma de v4) a partir de un texto. Sirve
 * cuando una API exige un UUID como llave de idempotencia pero el dato de
 * origen no lo es.
 */
export const uuidFromText = async (text: string): Promise<string> => {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(text)),
  );
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = toHex(bytes);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};
