import { afterEach, describe, expect, it, vi } from "vitest";

import { app } from "@/index";
import type { Env } from "@/types/env";

// FMC-0030: el único test que cruza los dos repos de verdad. No valida un
// contrato copiado a mano: llama al `buildOrderPayload` real del frontend
// para armar el cuerpo exactamente como lo manda el checkout, y lo manda al
// `app.request()` real de este backend (D1/ConfigCat/Resend mockeados, mismo
// patrón que `src/routes/contact.test.ts`). Si cualquiera de los dos lados
// cambia el contrato de forma incompatible, este test lo nota. Ver
// `docs/pruebas-cruzadas.md` para por qué vive fuera de `npm test`/CI y cómo
// correrlo (`npm run test:contract`, con el repo del frontend clonado al
// lado de este).
// eslint-disable-next-line import/no-unresolved -- resuelto por vitest.contract.config.mts, no por `npm test`
import { buildOrderPayload } from "../../../flormorado-cafe-frontend-react-app/src/services/orders/orders";

const PRODUCT_ID = "cafe-test-contrato";
const PRODUCT_PRICE = "45.000";
const SHIPPING_PRICE = 7000;

const fakeDb = (): D1Database => {
  const statement = {
    bind: () => statement,
    first: async () => null,
    run: async () => ({
      success: true,
      meta: { last_row_id: 1, changes: 1 },
    }),
  };
  return {
    prepare: () => statement,
    batch: async (statements: unknown[]) =>
      statements.map(() => ({ success: true })),
  } as unknown as D1Database;
};

const env = {
  DB: fakeDb(),
  CONFIGCAT_SDK_KEY: "test-sdk-key",
  ALLOWED_ORIGINS: "https://flormoradocafe.com",
  RESEND_API_KEY: "re_test",
  ORDERS_EMAIL_FROM: "info@flormoradocafe.com",
  ORDERS_EMAIL_TO: "negocio@flormoradocafe.com",
  BREB_KEY: "0093613415",
  BREB_HOLDER: "Flormorado Cafe",
} as unknown as Env;

const executionCtx = {
  waitUntil: (promise: Promise<unknown>) => {
    promise.catch(() => {});
  },
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const catalogFetchResponse = () =>
  new Response(
    JSON.stringify({
      f: {
        storeProducts: {
          v: {
            s: JSON.stringify({
              products: [
                {
                  id: PRODUCT_ID,
                  stock: true,
                  name: "Café de prueba",
                  brand: "Flormorado",
                  grinding: "Grano entero",
                  size: "500g",
                  price: PRODUCT_PRICE,
                  shippingPrice: SHIPPING_PRICE,
                },
              ],
            }),
          },
        },
      },
    }),
    { status: 200 },
  );

const stubFetch = () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("cdn-global.configcat.com")) {
        return Promise.resolve(catalogFetchResponse());
      }
      // Resend: la respuesta real no importa, el pedido ya quedó guardado.
      return Promise.resolve(
        new Response(JSON.stringify({ id: "email_test" }), { status: 200 }),
      );
    }),
  );
};

// Form plano como lo deja el checkout (`src/pages/Checkout`), con los
// nombres de campo que `buildOrderPayload` lee.
const checkoutForm = (paymentMethod: "cash_on_delivery" | "bre_b") => ({
  name: "María",
  surname: "Pérez",
  email: "maria@example.com",
  phone: "3001234567",
  whtsppOptIn: true,
  documentType: "CC",
  documentNumber: "123456789",
  city: "bogota",
  neighborhood: "Chapinero",
  address: "Calle 10A # 72C-88",
  additionalInfo: "Torre 2, apto 301",
  paymentMethod,
});

// Carrito real (`ICoffeeProduct[]`): el id de la línea es
// `${productId}-${grinding}`, como lo arma `ProductConfigurator`.
const cart = [
  {
    id: `${PRODUCT_ID}-media`,
    stock: true,
    brand: "Flormorado",
    name: "Café de prueba",
    imageUrl: "",
    shortDescription: "",
    grinding: "media",
    roastOptions: "",
    variety: "",
    size: "500g",
    price: PRODUCT_PRICE,
    shippingPrice: SHIPPING_PRICE,
    process: { benefit: "", drying: "", controlledFermentation: "" },
    productDescription: "",
    tags: [],
    category: "",
    type: "",
    origin: "",
    quantity: 2,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tipo real vive en el frontend
  } as any,
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("contrato POST /orders entre frontend y backend", () => {
  it("un pedido contraentrega armado por el frontend real pasa la validación real del backend", async () => {
    stubFetch();
    const payload = buildOrderPayload(
      checkoutForm("cash_on_delivery"),
      cart,
      crypto.randomUUID(),
    );

    expect(payload.declaredTotal).toBe(97000); // 2 x 45.000 + envío 7.000

    const res = await app.request(
      "/orders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      env,
      executionCtx,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      orderId: string;
      total: number;
      preciosVerificados: boolean;
      instruccionesPago?: unknown;
    };
    expect(body.total).toBe(97000);
    expect(body.preciosVerificados).toBe(true);
    expect(body.instruccionesPago).toBeUndefined();
  });

  it("un pedido BRE-B armado por el frontend real recibe la llave de pago", async () => {
    stubFetch();
    const payload = buildOrderPayload(
      checkoutForm("bre_b"),
      cart,
      crypto.randomUUID(),
    );

    const res = await app.request(
      "/orders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      env,
      executionCtx,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      instruccionesPago?: { llave: string; titular: string };
    };
    expect(body.instruccionesPago).toEqual({
      llave: "0093613415",
      titular: "Flormorado Cafe",
    });
  });
});
