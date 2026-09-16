import { catalogSchema, type Catalog } from "@/schemas/catalog";

const CDN = "https://cdn-global.configcat.com/configuration-files";

// El catálogo cambia poco y se consulta en cada pedido; cachearlo evita pegarle
// a ConfigCat en cada compra. Se usa el caché del propio Worker, así que no hay
// estado que administrar.
const CACHE_SECONDS = 300;

export class CatalogUnavailableError extends Error {}
export class CatalogShapeError extends Error {}

/**
 * Trae el catálogo de productos del flag `storeProducts` y valida su forma.
 *
 * El valor del flag es un string con JSON adentro, así que hay dos capas de
 * parseo. Si ConfigCat cambia la estructura, esto falla con el campo que no
 * cuadra en vez de dejar pasar precios incorrectos.
 */
export const fetchCatalog = async (sdkKey: string): Promise<Catalog> => {
  let response: Response;
  try {
    response = await fetch(`${CDN}/${sdkKey}/config_v6.json`, {
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
    });
  } catch (cause) {
    throw new CatalogUnavailableError("no se pudo contactar a ConfigCat", {
      cause,
    });
  }

  if (!response.ok) {
    throw new CatalogUnavailableError(`ConfigCat respondió ${response.status}`);
  }

  const config = (await response.json()) as {
    f?: Record<string, { v?: { s?: string } | string }>;
  };

  const flag = config.f?.storeProducts;
  const raw = typeof flag?.v === "string" ? flag.v : flag?.v?.s;

  if (typeof raw !== "string") {
    throw new CatalogShapeError(
      "el flag storeProducts no trae un string con el catálogo",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new CatalogShapeError("storeProducts no contiene JSON válido", {
      cause,
    });
  }

  const result = catalogSchema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new CatalogShapeError(`catálogo con forma inesperada — ${detail}`);
  }

  return result.data;
};
