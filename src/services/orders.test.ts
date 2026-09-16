import { describe, expect, it } from "vitest";

import type { Catalog } from "@/schemas/catalog";
import type { OrderRequest } from "@/schemas/order";

import { colombianDayStamp, priceFromClient, priceOrder } from "./orders";

// Estructura y valores tomados del flag storeProducts real (2026-09-15).
const catalog: Catalog = {
  products: [
    {
      id: "FLORMORADO500",
      stock: true,
      name: "FLORMORADO CAFÉ 500 G",
      brand: "flormorado",
      grinding: "Gruesa",
      size: "500",
      price: "45.000",
      shippingPrice: 7000,
    },
    {
      id: "FLORMORADO340",
      stock: false,
      name: "FLORMORADO CAFÉ 340 G",
      brand: "flormorado",
      grinding: "Gruesa",
      size: "340",
      price: "35.000",
      shippingPrice: 7000,
    },
  ],
};

const request = (overrides: Partial<OrderRequest> = {}): OrderRequest =>
  ({
    idempotencyKey: "3f6d6d3e-8a6e-4d5e-9c7a-1b2c3d4e5f60",
    contact: {
      name: "María",
      surname: "Restrepo",
      email: "maria@example.com",
      phone: "3001234567",
      whatsappOptIn: false,
    },
    delivery: {
      city: "chia",
      neighborhood: "Centro",
      address: "Calle 12 # 4-56",
    },
    payment: {
      method: "cash_on_delivery",
      documentType: "CC",
      documentNumber: "1012345678",
      notifyByWhatsApp: false,
    },
    items: [
      {
        productId: "FLORMORADO500",
        quantity: 1,
        grinding: "Prensa francesa",
        unitPrice: 45000,
      },
    ],
    declaredTotal: 52000,
    ...overrides,
  }) as OrderRequest;

describe("priceOrder", () => {
  it("cotiza con los precios del catálogo y conserva la molienda elegida", () => {
    const result = priceOrder(request(), catalog);

    expect("failures" in result).toBe(false);
    if ("failures" in result) return;

    expect(result.totals).toEqual({
      subtotal: 45000,
      shipping: 7000,
      total: 52000,
    });
    expect(result.lines[0].grinding).toBe("Prensa francesa");
    expect(result.lines[0].name).toBe("FLORMORADO CAFÉ 500 G");
  });

  it("rechaza un producto que no existe en el catálogo", () => {
    const result = priceOrder(
      request({
        items: [
          {
            productId: "NO_EXISTE",
            quantity: 1,
            grinding: "Gruesa",
            unitPrice: 45000,
          },
        ],
      }),
      catalog,
    );

    expect(result).toEqual({
      failures: [{ code: "producto_inexistente", productId: "NO_EXISTE" }],
    });
  });

  it("rechaza un producto agotado", () => {
    const result = priceOrder(
      request({
        items: [
          {
            productId: "FLORMORADO340",
            quantity: 1,
            grinding: "Gruesa",
            unitPrice: 35000,
          },
        ],
      }),
      catalog,
    );

    expect(result).toEqual({
      failures: [{ code: "producto_agotado", productId: "FLORMORADO340" }],
    });
  });

  // El carrito vive 14 días en localStorage, así que este es el caso realista:
  // el cliente vuelve con precios viejos y no se le puede cobrar otra cosa.
  it("rechaza un carrito con precios desactualizados", () => {
    const result = priceOrder(
      request({
        items: [
          {
            productId: "FLORMORADO500",
            quantity: 1,
            grinding: "Gruesa",
            unitPrice: 40000,
          },
        ],
        declaredTotal: 47000,
      }),
      catalog,
    );

    expect(result).toEqual({
      failures: [
        {
          code: "precio_desactualizado",
          productId: "FLORMORADO500",
          actual: 45000,
        },
      ],
    });
  });

  it("rechaza cuando el total declarado no coincide con el calculado", () => {
    const result = priceOrder(request({ declaredTotal: 1 }), catalog);

    expect(result).toEqual({
      failures: [{ code: "total_no_coincide", actual: 52000 }],
    });
  });

  it("ignora el precio del navegador para cobrar, no solo para comparar", () => {
    const result = priceOrder(
      request({
        items: [
          {
            productId: "FLORMORADO500",
            quantity: 2,
            grinding: "Gruesa",
            unitPrice: 45000,
          },
        ],
        declaredTotal: 97000,
      }),
      catalog,
    );

    if ("failures" in result) throw new Error("no debía fallar");
    expect(result.lines[0].unitPrice).toBe(45000);
    expect(result.totals.subtotal).toBe(90000);
    expect(result.totals.total).toBe(97000);
  });
});

describe("colombianDayStamp", () => {
  it("usa la fecha de Colombia, no la UTC", () => {
    // 00:36 UTC del 16 son las 19:36 del 15 en Colombia: el pedido es del 15.
    expect(colombianDayStamp(new Date("2026-09-16T00:36:46.757Z"))).toBe(
      "20260915",
    );
  });

  it("no cambia de día hasta la medianoche colombiana", () => {
    expect(colombianDayStamp(new Date("2026-09-16T04:59:59Z"))).toBe(
      "20260915",
    );
    expect(colombianDayStamp(new Date("2026-09-16T05:00:00Z"))).toBe(
      "20260916",
    );
  });

  it("mantiene la fecha durante el día laboral", () => {
    expect(colombianDayStamp(new Date("2026-09-15T14:00:00Z"))).toBe(
      "20260915",
    );
  });
});

describe("priceFromClient", () => {
  it("acepta el pedido con lo que mandó el navegador cuando no hay catálogo", () => {
    const result = priceFromClient(request());

    expect(result.totals.total).toBe(52000);
    // Sin catálogo no conocemos los nombres; el panel muestra el id.
    expect(result.lines[0].name).toBeNull();
    expect(result.lines[0].productId).toBe("FLORMORADO500");
  });
});
